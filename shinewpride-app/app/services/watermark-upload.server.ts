import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { WatermarkStatus } from "@prisma/client";

import prisma from "../db.server";
import { uploadWatermarkedMedia } from "./shopify-media.server";
import { watermarkImage } from "./watermark.server";

export type ManualUploadFile = {
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type ManualUploadResult = {
  name: string;
  status: "success" | "failed";
  imageUrl?: string;
  mediaId?: string;
  error?: string;
};

function outputFilename(originalName: string): string {
  const baseName = originalName.replace(/\.[^.]+$/, "") || "image";
  return `${baseName}-watermarked.webp`;
}

async function logWatermarkFailure(
  productId: string,
  originalUrl: string,
): Promise<void> {
  await prisma.watermarkLog.create({
    data: {
      shopifyMediaId: "unknown",
      productId,
      status: WatermarkStatus.FAILED,
      originalUrl,
    },
  });
}

export async function processManualWatermarkUpload(
  admin: AdminApiContext,
  productId: string,
  files: ManualUploadFile[],
): Promise<ManualUploadResult[]> {
  const results: ManualUploadResult[] = [];

  for (const file of files) {
    const name = file.name || "unnamed-image";

    try {
      const buffer = Buffer.from(await file.arrayBuffer());

      let watermarked: Buffer;
      try {
        watermarked = await watermarkImage(buffer);
      } catch (error) {
        await logWatermarkFailure(productId, name).catch(() => undefined);
        throw error;
      }

      const filename = outputFilename(name);
      const upload = await uploadWatermarkedMedia(
        admin,
        productId,
        watermarked,
        filename,
      );

      results.push({
        name,
        status: "success",
        imageUrl: upload.imageUrl,
        mediaId: upload.mediaId,
      });
    } catch (error) {
      results.push({
        name,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}
