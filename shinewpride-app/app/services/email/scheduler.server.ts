import type { EmailCampaign, ScheduleSlot, Subscriber } from "@prisma/client";
import cron from "node-cron";

import prisma from "../../db.server";
import { maybeSendFailureAlert } from "../alerting.server";
import { dispatchCampaignEmailSend } from "../email-send-queue.server";
import { renderEmailTemplate } from "./template.server";
import {
  getRunDateInTimezone,
  getSchedulerTimezone,
} from "./schedule-time.server";
import { emailLogger } from "../logger.server";

const SLOT_CRON: Record<ScheduleSlot, string> = {
  SIX_PM: "0 18 * * *",
  EIGHT_PM: "0 20 * * *",
};

const schedulerState = globalThis as typeof globalThis & {
  emailSchedulerStarted?: boolean;
};

export type SchedulerRunResult = {
  slot: ScheduleSlot;
  runDate: string;
  campaignsProcessed: number;
  sent: number;
  queued: number;
  skipped: number;
  failed: number;
};

export { getRunDateInTimezone, getSchedulerTimezone };
export { getDayBounds } from "./schedule-time.server";
export { renderEmailTemplate } from "./template.server";

function lockIdFromKey(key: string): bigint {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return BigInt(hash);
}

async function tryAcquireSlotLock(lockKey: string): Promise<boolean> {
  const lockId = lockIdFromKey(lockKey);
  const result = await prisma.$queryRaw<[{ pg_try_advisory_lock: boolean }]>`
    SELECT pg_try_advisory_lock(${lockId})
  `;
  return result[0]?.pg_try_advisory_lock === true;
}

async function releaseSlotLock(lockKey: string): Promise<void> {
  const lockId = lockIdFromKey(lockKey);
  await prisma.$executeRaw`SELECT pg_advisory_unlock(${lockId})`;
}

async function sendCampaignEmail(
  campaign: EmailCampaign,
  subscriber: Subscriber,
  runDate: string,
  timezone: string,
): Promise<"sent" | "queued" | "skipped" | "failed"> {
  try {
    return await dispatchCampaignEmailSend({
      campaign,
      subscriber,
      runDate,
      timezone,
      html: renderEmailTemplate(campaign.htmlTemplate, subscriber),
    });
  } catch (error) {
    emailLogger.error(
      { campaignId: campaign.id, email: subscriber.email, error },
      "email dispatch failed",
    );
    return "failed";
  }
}

export async function runScheduledSlot(
  slot: ScheduleSlot,
  options: {
    timezone?: string;
    now?: Date;
  } = {},
): Promise<SchedulerRunResult | null> {
  const timezone = options.timezone ?? getSchedulerTimezone();
  const runDate = getRunDateInTimezone(timezone, options.now);
  const lockKey = `email-scheduler:${slot}:${runDate}`;

  const acquired = await tryAcquireSlotLock(lockKey);
  if (!acquired) {
    emailLogger.info({ slot, runDate }, "email scheduler slot already running");
    return null;
  }

  const result: SchedulerRunResult = {
    slot,
    runDate,
    campaignsProcessed: 0,
    sent: 0,
    queued: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    const campaigns = await prisma.emailCampaign.findMany({
      where: {
        active: true,
        scheduleSlot: slot,
      },
    });
    const subscribers = await prisma.subscriber.findMany({
      where: { status: "ACTIVE" },
    });

    result.campaignsProcessed = campaigns.length;

    for (const campaign of campaigns) {
      for (const subscriber of subscribers) {
        const outcome = await sendCampaignEmail(
          campaign,
          subscriber,
          runDate,
          timezone,
        );

        if (outcome === "sent") result.sent += 1;
        if (outcome === "queued") result.queued += 1;
        if (outcome === "skipped") result.skipped += 1;
        if (outcome === "failed") result.failed += 1;
      }
    }

    const attempted = result.sent + result.queued + result.failed;
    await maybeSendFailureAlert({
      domain: "email",
      failed: result.failed,
      total: attempted,
    });

    emailLogger.info(result, "email scheduler slot completed");
    return result;
  } finally {
    await releaseSlotLock(lockKey);
  }
}

export function startEmailScheduler(): void {
  if (schedulerState.emailSchedulerStarted) return;
  if (process.env.EMAIL_SCHEDULER_ENABLED === "false") return;

  const timezone = getSchedulerTimezone();

  for (const slot of Object.keys(SLOT_CRON) as ScheduleSlot[]) {
    cron.schedule(
      SLOT_CRON[slot],
      () => {
        void runScheduledSlot(slot, { timezone }).catch((error) => {
          emailLogger.error({ slot, error }, "email scheduler run failed");
        });
      },
      { timezone },
    );
  }

  schedulerState.emailSchedulerStarted = true;
  emailLogger.info({ timezone, slots: SLOT_CRON }, "email scheduler started");
}

export function resetEmailSchedulerForTests(): void {
  schedulerState.emailSchedulerStarted = false;
}
