import { Queue } from "bullmq";

import { getRedisConnection, isQueueEnabled } from "./redis.server";

export const WATERMARK_QUEUE_NAME = "watermark-product";
export const EMAIL_SEND_QUEUE_NAME = "email-send";

const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: "exponential" as const,
    delay: 5000,
  },
  removeOnComplete: 100,
  removeOnFail: 200,
};

const EMAIL_JOB_OPTIONS = {
  attempts: 4,
  backoff: {
    type: "exponential" as const,
    delay: 10000,
  },
  removeOnComplete: 100,
  removeOnFail: 200,
};

const queueState = globalThis as typeof globalThis & {
  watermarkQueue?: Queue;
  emailSendQueue?: Queue;
};

export function getWatermarkQueue(): Queue | null {
  const connection = getRedisConnection();
  if (!connection) return null;

  if (!queueState.watermarkQueue) {
    queueState.watermarkQueue = new Queue(WATERMARK_QUEUE_NAME, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }

  return queueState.watermarkQueue;
}

export function getEmailSendQueue(): Queue | null {
  const connection = getRedisConnection();
  if (!connection) return null;

  if (!queueState.emailSendQueue) {
    queueState.emailSendQueue = new Queue(EMAIL_SEND_QUEUE_NAME, {
      connection,
      defaultJobOptions: EMAIL_JOB_OPTIONS,
    });
  }

  return queueState.emailSendQueue;
}

export function getQueueJobOptions(queueName: string) {
  if (queueName === EMAIL_SEND_QUEUE_NAME) {
    return EMAIL_JOB_OPTIONS;
  }

  return DEFAULT_JOB_OPTIONS;
}

export { isQueueEnabled };
