import type { EmailCampaign, Subscriber } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getDayBounds,
  getRunDateInTimezone,
  renderEmailTemplate,
  runScheduledSlot,
} from "./scheduler.server";

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
  campaignFindMany: vi.fn(),
  subscriberFindMany: vi.fn(),
  sendLogFindFirst: vi.fn(),
  sendLogCreate: vi.fn(),
}));

vi.mock("../alerting.server", () => ({
  maybeSendFailureAlert: vi.fn().mockResolvedValue(false),
}));

vi.mock("./provider.server", () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock("../../db.server", () => ({
  default: {
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
    emailCampaign: {
      findMany: mocks.campaignFindMany,
    },
    subscriber: {
      findMany: mocks.subscriberFindMany,
    },
    emailSendLog: {
      findFirst: mocks.sendLogFindFirst,
      create: mocks.sendLogCreate,
    },
  },
}));

const campaign: EmailCampaign = {
  id: "campaign_1",
  name: "Evening promo",
  subject: "Hello",
  htmlTemplate: "<p>Hi {{email}}</p>",
  scheduleSlot: "SIX_PM",
  active: true,
  createdAt: new Date("2026-06-29T10:00:00.000Z"),
};

const subscriber: Subscriber = {
  id: "sub_1",
  email: "user@example.com",
  shopDomain: "shop.myshopify.com",
  source: "popup",
  status: "ACTIVE",
  shopifyCustomerId: null,
  createdAt: new Date("2026-06-29T09:00:00.000Z"),
};

describe("scheduler helpers", () => {
  it("formats run date in timezone", () => {
    const runDate = getRunDateInTimezone(
      "Asia/Ho_Chi_Minh",
      new Date("2026-06-29T12:00:00.000Z"),
    );
    expect(runDate).toBe("2026-06-29");
  });

  it("renders template placeholders", () => {
    expect(renderEmailTemplate("<p>{{email}} @ {{shopDomain}}</p>", subscriber)).toBe(
      "<p>user@example.com @ shop.myshopify.com</p>",
    );
  });

  it("creates day bounds for timezone", () => {
    const { start, end } = getDayBounds("2026-06-29", "Asia/Ho_Chi_Minh");
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("runScheduledSlot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryRaw.mockResolvedValue([{ pg_try_advisory_lock: true }]);
    mocks.executeRaw.mockResolvedValue(1);
    mocks.campaignFindMany.mockResolvedValue([campaign]);
    mocks.subscriberFindMany.mockResolvedValue([subscriber]);
    mocks.sendLogFindFirst.mockResolvedValue(null);
    mocks.sendLogCreate.mockResolvedValue({});
    mocks.sendEmail.mockResolvedValue({ id: "email_1" });
  });

  it("sends emails for active campaigns and subscribers", async () => {
    const result = await runScheduledSlot("SIX_PM", {
      timezone: "Asia/Ho_Chi_Minh",
      now: new Date("2026-06-29T12:00:00.000Z"),
    });

    expect(result).toEqual({
      slot: "SIX_PM",
      runDate: "2026-06-29",
      campaignsProcessed: 1,
      sent: 1,
      queued: 0,
      skipped: 0,
      failed: 0,
    });
    expect(mocks.sendEmail).toHaveBeenCalledWith({
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hi user@example.com</p>",
    });
    expect(mocks.sendLogCreate).toHaveBeenCalledWith({
      data: {
        campaignId: "campaign_1",
        subscriberEmail: "user@example.com",
        status: "SENT",
      },
    });
  });

  it("skips subscribers already sent today", async () => {
    mocks.sendLogFindFirst.mockResolvedValue({ id: "log_1" });

    const result = await runScheduledSlot("SIX_PM", {
      timezone: "Asia/Ho_Chi_Minh",
      now: new Date("2026-06-29T12:00:00.000Z"),
    });

    expect(result?.sent).toBe(0);
    expect(result?.skipped).toBe(1);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("returns null when slot lock is not acquired", async () => {
    mocks.queryRaw.mockResolvedValue([{ pg_try_advisory_lock: false }]);

    const result = await runScheduledSlot("EIGHT_PM", {
      timezone: "Asia/Ho_Chi_Minh",
      now: new Date("2026-06-29T12:00:00.000Z"),
    });

    expect(result).toBeNull();
    expect(mocks.campaignFindMany).not.toHaveBeenCalled();
  });

  it("logs failed sends without throwing", async () => {
    mocks.sendEmail.mockRejectedValue(new Error("Provider down"));

    const result = await runScheduledSlot("SIX_PM", {
      timezone: "Asia/Ho_Chi_Minh",
      now: new Date("2026-06-29T12:00:00.000Z"),
    });

    expect(result?.failed).toBe(1);
    expect(mocks.sendLogCreate).toHaveBeenCalledWith({
      data: {
        campaignId: "campaign_1",
        subscriberEmail: "user@example.com",
        status: "FAILED",
        error: "Provider down",
      },
    });
  });
});
