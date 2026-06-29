import type { Subscriber } from "@prisma/client";

export function renderEmailTemplate(
  template: string,
  subscriber: Pick<Subscriber, "email" | "shopDomain">,
): string {
  return template
    .replaceAll("{{email}}", subscriber.email)
    .replaceAll("{{shopDomain}}", subscriber.shopDomain);
}
