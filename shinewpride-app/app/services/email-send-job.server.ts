import type { EmailCampaign, Subscriber } from "@prisma/client";
import { EmailSendStatus } from "@prisma/client";

import prisma from "../db.server";
import { emailLogger } from "./logger.server";
import { sendEmail } from "./email/provider.server";
import { getDayBounds } from "./email/schedule-time.server";

export type CampaignEmailSendInput = {
  campaign: Pick<EmailCampaign, "id" | "subject" | "htmlTemplate">;
  subscriber: Pick<Subscriber, "email" | "shopDomain">;
  runDate: string;
  timezone: string;
  html: string;
};

export type EmailSendOutcome = "sent" | "skipped" | "failed";

export async function wasEmailAlreadySentToday(
  campaignId: string,
  subscriberEmail: string,
  runDate: string,
  timezone: string,
): Promise<boolean> {
  const { start, end } = getDayBounds(runDate, timezone);
  const existing = await prisma.emailSendLog.findFirst({
    where: {
      campaignId,
      subscriberEmail,
      status: EmailSendStatus.SENT,
      sentAt: {
        gte: start,
        lt: end,
      },
    },
    select: { id: true },
  });

  return Boolean(existing);
}

export async function logEmailSendFailure(
  campaignId: string,
  subscriberEmail: string,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : "Unknown error";

  await prisma.emailSendLog.create({
    data: {
      campaignId,
      subscriberEmail,
      status: EmailSendStatus.FAILED,
      error: message,
    },
  });
}

export async function processCampaignEmailSend(
  input: CampaignEmailSendInput,
  options: { logFailure?: boolean } = {},
): Promise<EmailSendOutcome> {
  const { campaign, subscriber, runDate, timezone, html } = input;

  if (
    await wasEmailAlreadySentToday(
      campaign.id,
      subscriber.email,
      runDate,
      timezone,
    )
  ) {
    emailLogger.info(
      { campaignId: campaign.id, email: subscriber.email },
      "email send skipped (already sent today)",
    );
    return "skipped";
  }

  try {
    await sendEmail({
      to: subscriber.email,
      subject: campaign.subject,
      html,
    });

    await prisma.emailSendLog.create({
      data: {
        campaignId: campaign.id,
        subscriberEmail: subscriber.email,
        status: EmailSendStatus.SENT,
      },
    });

    emailLogger.info(
      { campaignId: campaign.id, email: subscriber.email },
      "email sent",
    );
    return "sent";
  } catch (error) {
    emailLogger.error(
      { campaignId: campaign.id, email: subscriber.email, error },
      "email send failed",
    );

    if (options.logFailure !== false) {
      await logEmailSendFailure(campaign.id, subscriber.email, error);
    }

    throw error;
  }
}
