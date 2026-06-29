import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import type { ScheduleSlot } from "@prisma/client";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  DataTable,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { z } from "zod";

import prisma from "../db.server";
import { renderEmailTemplate } from "../services/email/scheduler.server";
import { sendEmail } from "../services/email/provider.server";
import { authenticate } from "../shopify.server";

const SLOT_LABELS: Record<ScheduleSlot, string> = {
  SIX_PM: "18:00",
  EIGHT_PM: "20:00",
};

const campaignSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  subject: z.string().trim().min(1, "Subject is required"),
  htmlTemplate: z.string().trim().min(1, "HTML template is required"),
  scheduleSlot: z.enum(["SIX_PM", "EIGHT_PM"]),
  active: z.boolean(),
});

const sendTestSchema = z.object({
  campaignId: z.string().trim().min(1),
  testEmail: z.string().trim().email("Enter a valid email"),
});

type ActionData = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function parseCampaignForm(formData: FormData) {
  return campaignSchema.safeParse({
    name: formData.get("name"),
    subject: formData.get("subject"),
    htmlTemplate: formData.get("htmlTemplate"),
    scheduleSlot: formData.get("scheduleSlot"),
    active: formData.get("active") === "on",
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const campaigns = await prisma.emailCampaign.findMany({
    orderBy: { createdAt: "desc" },
  });

  return json({ campaigns });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "delete") {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      return json<ActionData>({ error: "Campaign id is required" }, { status: 400 });
    }

    await prisma.emailCampaign.delete({ where: { id } });
    return json<ActionData>({ ok: true, message: "Campaign deleted" });
  }

  if (intent === "sendTest") {
    const parsed = sendTestSchema.safeParse({
      campaignId: formData.get("campaignId"),
      testEmail: formData.get("testEmail"),
    });

    if (!parsed.success) {
      return json<ActionData>(
        { error: parsed.error.issues[0]?.message ?? "Invalid test email" },
        { status: 400 },
      );
    }

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: parsed.data.campaignId },
    });

    if (!campaign) {
      return json<ActionData>({ error: "Campaign not found" }, { status: 404 });
    }

    const html = renderEmailTemplate(campaign.htmlTemplate, {
      email: parsed.data.testEmail,
      shopDomain: session.shop,
    });

    await sendEmail({
      to: parsed.data.testEmail,
      subject: `[TEST] ${campaign.subject}`,
      html,
    });

    return json<ActionData>({
      ok: true,
      message: `Test email sent to ${parsed.data.testEmail}`,
    });
  }

  const parsed = parseCampaignForm(formData);
  if (!parsed.success) {
    return json<ActionData>(
      { error: parsed.error.issues[0]?.message ?? "Invalid campaign data" },
      { status: 400 },
    );
  }

  if (intent === "create") {
    await prisma.emailCampaign.create({ data: parsed.data });
    return json<ActionData>({ ok: true, message: "Campaign created" });
  }

  if (intent === "update") {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      return json<ActionData>({ error: "Campaign id is required" }, { status: 400 });
    }

    await prisma.emailCampaign.update({
      where: { id },
      data: parsed.data,
    });
    return json<ActionData>({ ok: true, message: "Campaign updated" });
  }

  return json<ActionData>({ error: "Unknown action" }, { status: 400 });
};

const emptyForm = {
  name: "",
  subject: "",
  htmlTemplate: "",
  scheduleSlot: "SIX_PM" as ScheduleSlot,
  active: true,
};

export default function CampaignsPage() {
  const { campaigns } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [testEmail, setTestEmail] = useState("");
  const [testCampaignId, setTestCampaignId] = useState(campaigns[0]?.id ?? "");

  const isSubmitting =
    fetcher.state === "submitting" || fetcher.state === "loading";

  const slotOptions = useMemo(
    () => [
      { label: "18:00 (SIX_PM)", value: "SIX_PM" },
      { label: "20:00 (EIGHT_PM)", value: "EIGHT_PM" },
    ],
    [],
  );

  const campaignOptions = useMemo(
    () =>
      campaigns.map((campaign) => ({
        label: campaign.name,
        value: campaign.id,
      })),
    [campaigns],
  );

  const resetForm = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
  }, []);

  const handleEdit = useCallback(
    (id: string) => {
      const campaign = campaigns.find((item) => item.id === id);
      if (!campaign) return;

      setEditingId(id);
      setForm({
        name: campaign.name,
        subject: campaign.subject,
        htmlTemplate: campaign.htmlTemplate,
        scheduleSlot: campaign.scheduleSlot,
        active: campaign.active,
      });
    },
    [campaigns],
  );

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.append("intent", editingId ? "update" : "create");
    if (editingId) formData.append("id", editingId);
    formData.append("name", form.name);
    formData.append("subject", form.subject);
    formData.append("htmlTemplate", form.htmlTemplate);
    formData.append("scheduleSlot", form.scheduleSlot);
    if (form.active) formData.append("active", "on");
    fetcher.submit(formData, { method: "post" });
  }, [editingId, fetcher, form]);

  const handleDelete = useCallback(
    (id: string) => {
      const formData = new FormData();
      formData.append("intent", "delete");
      formData.append("id", id);
      fetcher.submit(formData, { method: "post" });
    },
    [fetcher],
  );

  const handleSendTest = useCallback(() => {
    const formData = new FormData();
    formData.append("intent", "sendTest");
    formData.append("campaignId", testCampaignId);
    formData.append("testEmail", testEmail);
    fetcher.submit(formData, { method: "post" });
  }, [fetcher, testCampaignId, testEmail]);

  useEffect(() => {
    if (!fetcher.data || isSubmitting) return;

    if (fetcher.data.message) {
      shopify.toast.show(fetcher.data.message, {
        isError: Boolean(fetcher.data.error),
      });
    }

    if (
      fetcher.data.ok &&
      (fetcher.data.message === "Campaign created" ||
        fetcher.data.message === "Campaign updated")
    ) {
      resetForm();
    }
  }, [fetcher.data, isSubmitting, resetForm, shopify]);

  useEffect(() => {
    if (!testCampaignId && campaigns[0]?.id) {
      setTestCampaignId(campaigns[0].id);
    }
  }, [campaigns, testCampaignId]);

  const rows = campaigns.map((campaign) => [
    campaign.name,
    campaign.subject,
    SLOT_LABELS[campaign.scheduleSlot],
    campaign.active ? "Active" : "Inactive",
    <InlineStack key={`${campaign.id}-actions`} gap="200">
      <Button variant="plain" onClick={() => handleEdit(campaign.id)}>
        Edit
      </Button>
      <Button
        variant="plain"
        tone="critical"
        onClick={() => handleDelete(campaign.id)}
      >
        Delete
      </Button>
    </InlineStack>,
  ]);

  return (
    <Page>
      <TitleBar title="Email campaigns" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {fetcher.data?.error ? (
              <Banner tone="critical" title="Action failed">
                <p>{fetcher.data.error}</p>
              </Banner>
            ) : null}

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  {editingId ? "Edit campaign" : "Create campaign"}
                </Text>
                <TextField
                  label="Name"
                  value={form.name}
                  onChange={(value) => setForm((current) => ({ ...current, name: value }))}
                  autoComplete="off"
                />
                <TextField
                  label="Subject"
                  value={form.subject}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, subject: value }))
                  }
                  autoComplete="off"
                />
                <TextField
                  label="HTML template"
                  value={form.htmlTemplate}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, htmlTemplate: value }))
                  }
                  multiline={8}
                  autoComplete="off"
                  helpText="Supports {{email}} and {{shopDomain}} placeholders."
                />
                <Select
                  label="Schedule slot"
                  options={slotOptions}
                  value={form.scheduleSlot}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      scheduleSlot: value as ScheduleSlot,
                    }))
                  }
                />
                <Checkbox
                  label="Active"
                  checked={form.active}
                  onChange={(checked) =>
                    setForm((current) => ({ ...current, active: checked }))
                  }
                />
                <InlineStack gap="300">
                  <Button
                    variant="primary"
                    loading={isSubmitting}
                    onClick={handleSave}
                  >
                    {editingId ? "Save changes" : "Create campaign"}
                  </Button>
                  {editingId ? (
                    <Button onClick={resetForm}>Cancel edit</Button>
                  ) : null}
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Campaigns
                </Text>
                {campaigns.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text"]}
                    headings={["Name", "Subject", "Slot", "Status", "Actions"]}
                    rows={rows}
                  />
                ) : (
                  <Text as="p" tone="subdued" variant="bodyMd">
                    No campaigns yet. Create one to schedule emails at 18:00 or
                    20:00.
                  </Text>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Send test
                </Text>
                <Select
                  label="Campaign"
                  options={
                    campaignOptions.length > 0
                      ? campaignOptions
                      : [{ label: "No campaigns", value: "" }]
                  }
                  value={testCampaignId}
                  onChange={setTestCampaignId}
                  disabled={campaignOptions.length === 0}
                />
                <TextField
                  label="Recipient email"
                  type="email"
                  value={testEmail}
                  onChange={setTestEmail}
                  autoComplete="email"
                />
                <InlineStack align="end">
                  <Button
                    variant="primary"
                    loading={isSubmitting}
                    disabled={!testCampaignId || !testEmail}
                    onClick={handleSendTest}
                  >
                    Send test
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
