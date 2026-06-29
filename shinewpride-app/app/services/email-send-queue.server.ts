import type { EmailCampaign, Subscriber } from "@prisma/client";

import { emailLogger } from "./logger.server";
import { getEmailSendQueue, isQueueEnabled } from "./queue.server";
import {
  type CampaignEmailSendInput,
  type EmailSendOutcome,
  processCampaignEmailSend,
} from "./email-send-job.server";
import { renderEmailTemplate } from "./email/template.server";

export type EmailSendJobData = {
  campaignId: string;
  subscriberEmail: string;
  shopDomain: string;
  subject: string;
  html: string;
  runDate: string;
  timezone: string;
};

export function toEmailSendJobData(
  campaign: Pick<EmailCampaign, "id" | "subject" | "htmlTemplate">,
  subscriber: Pick<Subscriber, "email" | "shopDomain">,
  runDate: string,
  timezone: string,
): EmailSendJobData {
  return {
    campaignId: campaign.id,
    subscriberEmail: subscriber.email,
    shopDomain: subscriber.shopDomain,
    subject: campaign.subject,
    html: renderEmailTemplate(campaign.htmlTemplate, subscriber as Subscriber),
    runDate,
    timezone,
  };
}

export async function enqueueEmailSend(
  data: EmailSendJobData,
): Promise<void> {
  const queue = getEmailSendQueue();
  if (!queue) {
    throw new Error("Email send queue is not available");
  }

  await queue.add("send", data, {
    jobId: `${data.campaignId}:${data.subscriberEmail}:${data.runDate}`,
  });

  emailLogger.info(
    { campaignId: data.campaignId, email: data.subscriberEmail },
    "email send queued",
  );
}

export async function dispatchCampaignEmailSend(
  input: CampaignEmailSendInput,
): Promise<EmailSendOutcome | "queued"> {
  if (isQueueEnabled()) {
    await enqueueEmailSend(
      toEmailSendJobData(
        input.campaign,
        input.subscriber,
        input.runDate,
        input.timezone,
      ),
    );
    return "queued";
  }

  return processCampaignEmailSend(input);
}

export async function processEmailSendJobData(
  data: EmailSendJobData,
): Promise<EmailSendOutcome> {
  return processCampaignEmailSend(
    {
      campaign: {
        id: data.campaignId,
        subject: data.subject,
        htmlTemplate: data.html,
      },
      subscriber: {
        email: data.subscriberEmail,
        shopDomain: data.shopDomain,
      },
      runDate: data.runDate,
      timezone: data.timezone,
      html: data.html,
    },
    { logFailure: false },
  );
}
