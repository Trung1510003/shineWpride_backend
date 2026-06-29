import { useCallback, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  InlineStack,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";

import prisma from "../db.server";
import { isQueueEnabled } from "../services/redis.server";
import { getFailedQueueJobs, retryQueueJob } from "../services/queue-workers.server";
import { authenticate } from "../shopify.server";

type LoaderData = {
  queueEnabled: boolean;
  failedWatermarkLogs: Array<{
    id: string;
    productId: string;
    shopifyMediaId: string;
    originalUrl: string;
    createdAt: string;
  }>;
  failedEmailLogs: Array<{
    id: string;
    subscriberEmail: string;
    campaignName: string;
    error: string | null;
    sentAt: string;
  }>;
  failedQueueJobs: {
    watermark: Array<{
      id: string;
      queue: string;
      failedReason: string;
      finishedOn: string | null;
      data: unknown;
    }>;
    email: Array<{
      id: string;
      queue: string;
      failedReason: string;
      finishedOn: string | null;
      data: unknown;
    }>;
  };
};

type ActionData = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const [failedWatermarkLogs, failedEmailLogs, failedQueueJobs] = await Promise.all([
    prisma.watermarkLog.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.emailSendLog.findMany({
      where: { status: "FAILED" },
      include: {
        campaign: {
          select: { name: true },
        },
      },
      orderBy: { sentAt: "desc" },
      take: 50,
    }),
    getFailedQueueJobs(50),
  ]);

  return json<LoaderData>({
    queueEnabled: isQueueEnabled(),
    failedWatermarkLogs: failedWatermarkLogs.map((log) => ({
      id: log.id,
      productId: log.productId,
      shopifyMediaId: log.shopifyMediaId,
      originalUrl: log.originalUrl,
      createdAt: log.createdAt.toISOString(),
    })),
    failedEmailLogs: failedEmailLogs.map((log) => ({
      id: log.id,
      subscriberEmail: log.subscriberEmail,
      campaignName: log.campaign.name,
      error: log.error,
      sentAt: log.sentAt.toISOString(),
    })),
    failedQueueJobs,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent !== "retryJob") {
    return json<ActionData>({ error: "Unknown action" }, { status: 400 });
  }

  const queueName = String(formData.get("queueName") ?? "");
  const jobId = String(formData.get("jobId") ?? "");

  if (!queueName || !jobId) {
    return json<ActionData>({ error: "Queue name and job id are required" }, { status: 400 });
  }

  const retried = await retryQueueJob(queueName, jobId);
  if (!retried) {
    return json<ActionData>({ error: "Failed to retry job" }, { status: 404 });
  }

  return json<ActionData>({ ok: true, message: `Retried job ${jobId}` });
};

export default function OpsPage() {
  const { queueEnabled, failedWatermarkLogs, failedEmailLogs, failedQueueJobs } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isSubmitting =
    fetcher.state === "submitting" || fetcher.state === "loading";

  const handleRetry = useCallback(
    (queueName: string, jobId: string) => {
      const formData = new FormData();
      formData.append("intent", "retryJob");
      formData.append("queueName", queueName);
      formData.append("jobId", jobId);
      fetcher.submit(formData, { method: "post" });
    },
    [fetcher],
  );

  useEffect(() => {
    if (!fetcher.data?.message || isSubmitting) return;
    shopify.toast.show(fetcher.data.message, {
      isError: Boolean(fetcher.data.error),
    });
  }, [fetcher.data, isSubmitting, shopify]);

  const watermarkQueueRows = failedQueueJobs.watermark.map((job) => [
    job.id,
    job.failedReason,
    job.finishedOn ? formatDate(job.finishedOn) : "—",
    <Button
      key={`retry-${job.id}`}
      variant="plain"
      onClick={() => handleRetry(job.queue, job.id)}
    >
      Retry
    </Button>,
  ]);

  const emailQueueRows = failedQueueJobs.email.map((job) => [
    job.id,
    job.failedReason,
    job.finishedOn ? formatDate(job.finishedOn) : "—",
    <Button
      key={`retry-${job.id}`}
      variant="plain"
      onClick={() => handleRetry(job.queue, job.id)}
    >
      Retry
    </Button>,
  ]);

  const watermarkLogRows = failedWatermarkLogs.map((log) => [
    log.productId,
    log.shopifyMediaId,
    log.originalUrl,
    formatDate(log.createdAt),
  ]);

  const emailLogRows = failedEmailLogs.map((log) => [
    log.subscriberEmail,
    log.campaignName,
    log.error ?? "—",
    formatDate(log.sentAt),
  ]);

  return (
    <Page>
      <TitleBar title="Ops & failed jobs" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {fetcher.data?.error ? (
              <Banner tone="critical" title="Action failed">
                <p>{fetcher.data.error}</p>
              </Banner>
            ) : null}

            {!queueEnabled ? (
              <Banner tone="warning" title="Redis queue disabled">
                <p>
                  Set <code>REDIS_URL</code> to enable BullMQ retry workers. Failed
                  jobs below are from database logs only.
                </p>
              </Banner>
            ) : null}

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Failed BullMQ jobs — watermark
                </Text>
                {watermarkQueueRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text"]}
                    headings={["Job ID", "Reason", "Finished", ""]}
                    rows={watermarkQueueRows}
                  />
                ) : (
                  <Text as="p" tone="subdued" variant="bodyMd">
                    No failed watermark queue jobs.
                  </Text>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Failed BullMQ jobs — email
                </Text>
                {emailQueueRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text"]}
                    headings={["Job ID", "Reason", "Finished", ""]}
                    rows={emailQueueRows}
                  />
                ) : (
                  <Text as="p" tone="subdued" variant="bodyMd">
                    No failed email queue jobs.
                  </Text>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Watermark failure logs
                  </Text>
                </InlineStack>
                {watermarkLogRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text"]}
                    headings={["Product", "Media", "Original URL", "When"]}
                    rows={watermarkLogRows}
                  />
                ) : (
                  <Text as="p" tone="subdued" variant="bodyMd">
                    No failed watermark logs.
                  </Text>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Email failure logs
                </Text>
                {emailLogRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text"]}
                    headings={["Email", "Campaign", "Error", "When"]}
                    rows={emailLogRows}
                  />
                ) : (
                  <Text as="p" tone="subdued" variant="bodyMd">
                    No failed email logs.
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
