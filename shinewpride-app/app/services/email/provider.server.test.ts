import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ResendEmailProvider,
  resetEmailProvider,
  sendEmail,
  setEmailProvider,
} from "./provider.server";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn(function MockResend() {
    return {
      emails: {
        send: mocks.send,
      },
    };
  }),
}));

describe("ResendEmailProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns id when Resend succeeds", async () => {
    mocks.send.mockResolvedValue({
      data: { id: "email_123" },
      error: null,
    });

    const provider = new ResendEmailProvider("re_test_key", "Test <test@example.com>");
    const result = await provider.send({
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
    });

    expect(result).toEqual({ id: "email_123" });
    expect(mocks.send).toHaveBeenCalledWith({
      from: "Test <test@example.com>",
      to: ["user@example.com"],
      subject: "Hello",
      html: "<p>Hi</p>",
    });
  });

  it("throws when Resend returns an error", async () => {
    mocks.send.mockResolvedValue({
      data: null,
      error: { message: "Invalid recipient" },
    });

    const provider = new ResendEmailProvider("re_test_key", "Test <test@example.com>");

    await expect(
      provider.send({
        to: "bad-email",
        subject: "Hello",
        html: "<p>Hi</p>",
      }),
    ).rejects.toThrow("Invalid recipient");
  });

  it("throws when api key is missing", () => {
    expect(() => new ResendEmailProvider(undefined, "Test <test@example.com>")).toThrow(
      "RESEND_API_KEY is not configured",
    );
  });

  it("throws when from address is missing", () => {
    expect(() => new ResendEmailProvider("re_test_key", undefined)).toThrow(
      "RESEND_FROM_EMAIL is not configured",
    );
  });
});

describe("sendEmail", () => {
  beforeEach(() => {
    resetEmailProvider();
    vi.clearAllMocks();
  });

  it("delegates to the configured provider", async () => {
    const send = vi.fn().mockResolvedValue({ id: "email_456" });
    setEmailProvider({ send });

    const result = await sendEmail({
      to: "user@example.com",
      subject: "Welcome",
      html: "<p>Welcome</p>",
    });

    expect(result).toEqual({ id: "email_456" });
    expect(send).toHaveBeenCalledWith({
      to: "user@example.com",
      subject: "Welcome",
      html: "<p>Welcome</p>",
    });
  });
});
