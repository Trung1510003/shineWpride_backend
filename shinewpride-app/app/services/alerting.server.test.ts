import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getFailureRate,
  isAlertCoolingDown,
  maybeSendFailureAlert,
  resetAlertStateForTests,
  shouldTriggerFailureAlert,
} from "./alerting.server";

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
}));

vi.mock("./email/provider.server", () => ({
  sendEmail: mocks.sendEmail,
}));

describe("alerting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAlertStateForTests();
    delete process.env.ALERT_EMAIL;
    delete process.env.ALERT_FAILURE_RATE_THRESHOLD;
    delete process.env.ALERT_MIN_SAMPLES;
  });

  it("calculates failure rate", () => {
    expect(getFailureRate(2, 10)).toBe(0.2);
    expect(getFailureRate(0, 0)).toBe(0);
  });

  it("requires minimum samples before alerting", () => {
    expect(shouldTriggerFailureAlert(5, 5, 0.5, 10)).toBe(false);
    expect(shouldTriggerFailureAlert(5, 10, 0.5, 5)).toBe(true);
  });

  it("sends alert email when threshold exceeded", async () => {
    process.env.ALERT_EMAIL = "ops@example.com";
    mocks.sendEmail.mockResolvedValue({ id: "email_1" });

    const sent = await maybeSendFailureAlert({
      domain: "email",
      failed: 8,
      total: 10,
    });

    expect(sent).toBe(true);
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ops@example.com",
        subject: expect.stringContaining("email"),
      }),
    );
  });

  it("respects alert cooldown", async () => {
    process.env.ALERT_EMAIL = "ops@example.com";
    mocks.sendEmail.mockResolvedValue({ id: "email_1" });

    await maybeSendFailureAlert({ domain: "watermark", failed: 6, total: 10 });
    const sentAgain = await maybeSendFailureAlert({
      domain: "watermark",
      failed: 7,
      total: 10,
    });

    expect(sentAgain).toBe(false);
    expect(isAlertCoolingDown("watermark")).toBe(true);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });
});
