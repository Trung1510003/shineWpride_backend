import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { z } from "zod";

import {
  POPUP_DISCOUNT_CODE,
  registerPopupSubscriber,
} from "../services/subscriber.server";
import { authenticate } from "../shopify.server";

const subscribeSchema = z.object({
  email: z.string().trim().email(),
});

async function parseSubscribeInput(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const body = await request.json();
      return subscribeSchema.safeParse(body);
    }

    const formData = await request.formData();
    return subscribeSchema.safeParse({
      email: formData.get("email"),
    });
  } catch {
    return subscribeSchema.safeParse({});
  }
}

export const loader = async () =>
  json({ ok: false, error: "Method not allowed" }, { status: 405 });

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  const { admin, session } = await authenticate.public.appProxy(request);

  if (!session || !admin) {
    return json(
      { ok: false, error: "App is not installed on this shop" },
      { status: 503 },
    );
  }

  const parsed = await parseSubscribeInput(request);
  if (!parsed.success) {
    return json({ ok: false, error: "Invalid email" }, { status: 400 });
  }

  await registerPopupSubscriber(admin, session.shop, parsed.data.email);

  return json({ ok: true, code: POPUP_DISCOUNT_CODE });
};
