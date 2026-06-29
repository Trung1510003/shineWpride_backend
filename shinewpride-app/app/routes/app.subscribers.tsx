import { useCallback, useMemo } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { TitleBar } from "@shopify/app-bridge-react";
import type { SubscriberStatus } from "@prisma/client";
import {
  BlockStack,
  Card,
  DataTable,
  Layout,
  Page,
  Select,
  Text,
} from "@shopify/polaris";

import prisma from "../db.server";
import { authenticate } from "../shopify.server";

const STATUS_OPTIONS = [
  { label: "All subscribers", value: "all" },
  { label: "Active", value: "ACTIVE" },
  { label: "Unsubscribed", value: "UNSUBSCRIBED" },
];

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status") ?? "all";

  const subscriberWhere =
    statusParam === "all"
      ? { shopDomain: session.shop }
      : {
          shopDomain: session.shop,
          status: statusParam as SubscriberStatus,
        };

  const subscribers = await prisma.subscriber.findMany({
    where: subscriberWhere,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const subscriberEmails = subscribers.map((subscriber) => subscriber.email);

  const sendLogs =
    subscriberEmails.length === 0
      ? []
      : await prisma.emailSendLog.findMany({
          where: {
            subscriberEmail: { in: subscriberEmails },
          },
          include: {
            campaign: {
              select: { name: true },
            },
          },
          orderBy: { sentAt: "desc" },
          take: 200,
        });

  return json({
    subscribers,
    sendLogs,
    statusFilter: statusParam,
  });
};

export default function SubscribersPage() {
  const { subscribers, sendLogs, statusFilter } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleStatusChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams);
      if (value === "all") {
        params.delete("status");
      } else {
        params.set("status", value);
      }
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const subscriberRows = useMemo(
    () =>
      subscribers.map((subscriber) => [
        subscriber.email,
        subscriber.source,
        subscriber.status,
        subscriber.shopifyCustomerId ?? "—",
        formatDate(subscriber.createdAt),
      ]),
    [subscribers],
  );

  const sendLogRows = useMemo(
    () =>
      sendLogs.map((log) => [
        log.subscriberEmail,
        log.campaign.name,
        log.status,
        log.error ?? "—",
        formatDate(log.sentAt),
      ]),
    [sendLogs],
  );

  return (
    <Page>
      <TitleBar title="Subscribers & send logs" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Subscribers
                </Text>
                <Select
                  label="Filter by status"
                  options={STATUS_OPTIONS}
                  value={statusFilter}
                  onChange={handleStatusChange}
                />
                {subscriberRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text"]}
                    headings={[
                      "Email",
                      "Source",
                      "Status",
                      "Shopify customer",
                      "Subscribed at",
                    ]}
                    rows={subscriberRows}
                  />
                ) : (
                  <Text as="p" tone="subdued" variant="bodyMd">
                    No subscribers match this filter.
                  </Text>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Send logs
                </Text>
                {sendLogRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text"]}
                    headings={[
                      "Email",
                      "Campaign",
                      "Status",
                      "Error",
                      "Sent at",
                    ]}
                    rows={sendLogRows}
                  />
                ) : (
                  <Text as="p" tone="subdued" variant="bodyMd">
                    No send logs yet for the current subscriber list.
                  </Text>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
