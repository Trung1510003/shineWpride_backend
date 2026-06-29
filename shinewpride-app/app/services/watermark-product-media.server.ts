import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { WatermarkStatus } from "@prisma/client";

import prisma from "../db.server";
import { maybeSendFailureAlert } from "./alerting.server";
import { watermarkLogger } from "./logger.server";
import {
  deleteProductMedia,
  uploadWatermarkedMedia,
} from "./shopify-media.server";
import { watermarkImage } from "./watermark.server";

export type ProductMediaCandidate = {
  mediaId: string;
  imageUrl: string;
};

type ProductMediaQueryResponse = {
  data?: {
    product?: {
      id: string;
      media?: {
        nodes?: Array<{
          id: string;
          mediaContentType?: string;
          image?: { url?: string | null } | null;
          metafield?: { value?: string | null } | null;
        }>;
      };
    } | null;
  };
};

const PRODUCT_MEDIA_QUERY = `#graphql
  query productWatermarkCandidates($id: ID!) {
    product(id: $id) {
      id
      media(first: 100) {
        nodes {
          id
          mediaContentType
          ... on MediaImage {
            image {
              url
            }
            metafield(namespace: "custom", key: "watermarked") {
              value
            }
          }
        }
      }
    }
  }
`;

export function resolveProductId(payload: Record<string, unknown>): string | null {
  if (typeof payload.admin_graphql_api_id === "string") {
    return payload.admin_graphql_api_id;
  }

  if (typeof payload.id === "number") {
    return `gid://shopify/Product/${payload.id}`;
  }

  if (typeof payload.id === "string") {
    return payload.id.startsWith("gid://")
      ? payload.id
      : `gid://shopify/Product/${payload.id}`;
  }

  return null;
}

function isWatermarked(value: string | null | undefined): boolean {
  return value === "true";
}

function outputFilename(mediaId: string, imageUrl: string): string {
  const urlName = imageUrl.split("/").pop()?.split("?")[0] ?? "image";
  const baseName = urlName.replace(/\.[^.]+$/, "") || "image";
  const mediaSuffix = mediaId.split("/").pop() ?? "media";
  return `${baseName}-${mediaSuffix}-watermarked.webp`;
}

export async function fetchUnwatermarkedProductMedia(
  admin: AdminApiContext,
  productId: string,
): Promise<ProductMediaCandidate[]> {
  const response = await admin.graphql(PRODUCT_MEDIA_QUERY, {
    variables: { id: productId },
  });
  const json = (await response.json()) as ProductMediaQueryResponse;
  const nodes = json.data?.product?.media?.nodes ?? [];

  return nodes
    .filter((node) => node.mediaContentType === "IMAGE")
    .filter((node) => !isWatermarked(node.metafield?.value))
    .filter((node) => Boolean(node.image?.url))
    .map((node) => ({
      mediaId: node.id,
      imageUrl: node.image!.url!,
    }));
}

export async function downloadProductImage(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Failed to download image (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function watermarkAndReplaceProductMedia(
  admin: AdminApiContext,
  productId: string,
  media: ProductMediaCandidate,
): Promise<void> {
  const originalBuffer = await downloadProductImage(media.imageUrl);
  const watermarked = await watermarkImage(originalBuffer);
  const filename = outputFilename(media.mediaId, media.imageUrl);

  await uploadWatermarkedMedia(admin, productId, watermarked, filename);
  await deleteProductMedia(admin, productId, [media.mediaId]);

  await prisma.watermarkLog.create({
    data: {
      shopifyMediaId: media.mediaId,
      productId,
      status: WatermarkStatus.DONE,
      originalUrl: media.imageUrl,
    },
  });
}

export async function processProductWatermarkMedia(
  admin: AdminApiContext,
  productId: string,
): Promise<void> {
  const candidates = await fetchUnwatermarkedProductMedia(admin, productId);
  let failed = 0;

  for (const media of candidates) {
    try {
      await watermarkAndReplaceProductMedia(admin, productId, media);
    } catch (error) {
      failed += 1;

      await prisma.watermarkLog.create({
        data: {
          shopifyMediaId: media.mediaId,
          productId,
          status: WatermarkStatus.FAILED,
          originalUrl: media.imageUrl,
        },
      });

      watermarkLogger.error(
        { productId, mediaId: media.mediaId, error },
        "failed to watermark product media",
      );
    }
  }

  if (candidates.length > 0) {
    await maybeSendFailureAlert({
      domain: "watermark",
      failed,
      total: candidates.length,
    });
  }
}
