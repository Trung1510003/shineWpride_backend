import type { ActionFunctionArgs } from "@remix-run/node";

import { authenticate } from "../shopify.server";
import { scheduleProductWatermarkProcessing } from "../services/watermark-queue.server";
import { resolveProductId } from "../services/watermark-product-media.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, payload, session, topic, shop } =
    await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (!session || !admin) {
    return new Response();
  }

  const productId = resolveProductId(payload);
  if (!productId) {
    return new Response();
  }

  scheduleProductWatermarkProcessing(admin, productId, shop);

  return new Response();
};
