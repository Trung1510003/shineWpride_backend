import type { Job, Worker } from "bullmq";
import { Worker as BullWorker } from "bullmq";

import { unauthenticated } from "../shopify.server";
import { logEmailSendFailure } from "./email-send-job.server";
import {
  type EmailSendJobData,
  processEmailSendJobData,
} from "./email-send-queue.server";
import { emailLogger, queueLogger, watermarkLogger } from "./logger.server";
import { processProductWatermarkMedia } from "./watermark-product-media.server";
import {
  EMAIL_SEND_QUEUE_NAME,
  getEmailSendQueue,
  getQueueJobOptions,
  getWatermarkQueue,
  WATERMARK_QUEUE_NAME,
} from "./queue.server";
import { getRedisConnection, isQueueEnabled } from "./redis.server";

export type WatermarkJobData = {
  shop: string;
  productId: string;
};

const workerState = globalThis as typeof globalThis & {
  queueWorkersStarted?: boolean;
  watermarkWorker?: Worker;
  emailWorker?: Worker;
};

async function processWatermarkJob(job: Job<WatermarkJobData>): Promise<void> {
  const { shop, productId } = job.data;
  watermarkLogger.info({ shop, productId, jobId: job.id }, "watermark job started");

  const { admin } = await unauthenticated.admin(shop);
  if (!admin) {
    throw new Error(`No offline session available for shop ${shop}`);
  }

  await processProductWatermarkMedia(admin, productId);
  watermarkLogger.info({ shop, productId, jobId: job.id }, "watermark job completed");
}

async function processEmailJob(job: Job<EmailSendJobData>): Promise<void> {
  const attempts = job.opts.attempts ?? 1;
  const isFinalAttempt = job.attemptsMade + 1 >= attempts;

  emailLogger.info(
    {
      campaignId: job.data.campaignId,
      email: job.data.subscriberEmail,
      jobId: job.id,
      attempt: job.attemptsMade + 1,
      attempts,
    },
    "email job started",
  );

  try {
    await processEmailSendJobData(job.data);
  } catch (error) {
    if (isFinalAttempt) {
      await logEmailSendFailure(
        job.data.campaignId,
        job.data.subscriberEmail,
        error,
      );
    }
    throw error;
  }
}

export function startQueueWorkers(): void {
  if (workerState.queueWorkersStarted) return;
  if (!isQueueEnabled()) {
    queueLogger.info("queue workers disabled (REDIS_URL not set)");
    return;
  }

  const connection = getRedisConnection();
  if (!connection) return;

  workerState.watermarkWorker = new BullWorker(
    WATERMARK_QUEUE_NAME,
    processWatermarkJob,
    { connection },
  );

  workerState.emailWorker = new BullWorker(
    EMAIL_SEND_QUEUE_NAME,
    processEmailJob,
    { connection },
  );

  attachWorkerListeners(workerState.watermarkWorker, "watermark");
  attachWorkerListeners(workerState.emailWorker, "email");

  workerState.queueWorkersStarted = true;
  queueLogger.info("queue workers started");
}

function attachWorkerListeners(worker: Worker, domain: string): void {
  worker.on("failed", (job, error) => {
    queueLogger.error(
      {
        domain,
        jobId: job?.id,
        data: job?.data,
        error,
      },
      "queue job failed",
    );
  });

  worker.on("completed", (job) => {
    queueLogger.info({ domain, jobId: job.id }, "queue job completed");
  });
}

export async function getFailedQueueJobs(limit = 50) {
  const watermarkQueue = getWatermarkQueue();
  const emailQueue = getEmailSendQueue();

  const [watermarkFailed, emailFailed] = await Promise.all([
    watermarkQueue ? watermarkQueue.getFailed(0, limit - 1) : Promise.resolve([]),
    emailQueue ? emailQueue.getFailed(0, limit - 1) : Promise.resolve([]),
  ]);

  return {
    watermark: watermarkFailed.map((job) => serializeFailedJob(job, WATERMARK_QUEUE_NAME)),
    email: emailFailed.map((job) => serializeFailedJob(job, EMAIL_SEND_QUEUE_NAME)),
  };
}

function serializeFailedJob(job: Job, queueName: string) {
  const options = getQueueJobOptions(queueName);

  return {
    id: job.id ?? "",
    queue: queueName,
    name: job.name,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts.attempts ?? options.attempts,
    failedReason: job.failedReason ?? "Unknown error",
    finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    data: job.data,
  };
}

export async function retryQueueJob(
  queueName: string,
  jobId: string,
): Promise<boolean> {
  const queue =
    queueName === EMAIL_SEND_QUEUE_NAME
      ? getEmailSendQueue()
      : queueName === WATERMARK_QUEUE_NAME
        ? getWatermarkQueue()
        : null;

  if (!queue) return false;

  const job = await queue.getJob(jobId);
  if (!job) return false;

  await job.retry();
  return true;
}

export function resetQueueWorkersForTests(): void {
  workerState.queueWorkersStarted = false;
}
