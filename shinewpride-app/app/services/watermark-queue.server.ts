import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

import { watermarkLogger } from "./logger.server";
import { getWatermarkQueue, isQueueEnabled } from "./queue.server";
import { processProductWatermarkMedia } from "./watermark-product-media.server";

export type WatermarkJobData = {
  shop: string;
  productId: string;
};

export async function enqueueProductWatermarkJob(
  shop: string,
  productId: string,
): Promise<void> {
  const queue = getWatermarkQueue();
  if (!queue) {
    throw new Error("Watermark queue is not available");
  }

  await queue.add(
    "watermark-product",
    { shop, productId } satisfies WatermarkJobData,
    {
      jobId: `${shop}:${productId}`,
    },
  );

  watermarkLogger.info({ shop, productId }, "watermark job queued");
}

export function scheduleProductWatermarkProcessing(
  admin: AdminApiContext,
  productId: string,
  shop: string,
): void {
  if (isQueueEnabled()) {
    void enqueueProductWatermarkJob(shop, productId).catch((error) => {
      watermarkLogger.error({ shop, productId, error }, "failed to enqueue watermark job");
    });
    return;
  }

  void processProductWatermarkMedia(admin, productId).catch((error) => {
    watermarkLogger.error({ shop, productId, error }, "watermark processing failed");
  });
}
