import { sendEmail } from "./email/provider.server";
import { emailLogger } from "./logger.server";

export type FailureAlertInput = {
  domain: "watermark" | "email";
  failed: number;
  total: number;
};

const alertCooldownMs = Number(process.env.ALERT_COOLDOWN_MS ?? 3_600_000);
const alertState = new Map<string, number>();

export function getFailureRate(failed: number, total: number): number {
  if (total <= 0) return 0;
  return failed / total;
}

export function shouldTriggerFailureAlert(
  failed: number,
  total: number,
  threshold = Number(process.env.ALERT_FAILURE_RATE_THRESHOLD ?? 0.5),
  minSamples = Number(process.env.ALERT_MIN_SAMPLES ?? 5),
): boolean {
  if (total < minSamples) return false;
  return getFailureRate(failed, total) >= threshold;
}

function alertCooldownKey(domain: string): string {
  const hour = new Date().toISOString().slice(0, 13);
  return `${domain}:${hour}`;
}

export function isAlertCoolingDown(domain: string, now = Date.now()): boolean {
  const lastSentAt = alertState.get(alertCooldownKey(domain));
  if (!lastSentAt) return false;
  return now - lastSentAt < alertCooldownMs;
}

export function resetAlertStateForTests(): void {
  alertState.clear();
}

export async function maybeSendFailureAlert(
  input: FailureAlertInput,
): Promise<boolean> {
  const alertEmail = process.env.ALERT_EMAIL?.trim();
  if (!alertEmail) return false;
  if (!shouldTriggerFailureAlert(input.failed, input.total)) return false;
  if (isAlertCoolingDown(input.domain)) return false;

  const failureRate = Math.round(getFailureRate(input.failed, input.total) * 100);

  try {
    await sendEmail({
      to: alertEmail,
      subject: `[ShineW Pride] High ${input.domain} failure rate`,
      html: `<p>The <strong>${input.domain}</strong> pipeline reported a high failure rate.</p>
<ul>
  <li>Failed: ${input.failed}</li>
  <li>Total: ${input.total}</li>
  <li>Failure rate: ${failureRate}%</li>
</ul>`,
    });

    alertState.set(alertCooldownKey(input.domain), Date.now());
    emailLogger.warn(
      { ...input, failureRate, alertEmail },
      "failure alert email sent",
    );
    return true;
  } catch (error) {
    emailLogger.error({ ...input, error }, "failed to send failure alert email");
    return false;
  }
}
