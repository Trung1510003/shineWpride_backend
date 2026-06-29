export const DEFAULT_EMAIL_SCHEDULER_TIMEZONE = "Asia/Ho_Chi_Minh";

export function getSchedulerTimezone(): string {
  return process.env.EMAIL_SCHEDULER_TIMEZONE || DEFAULT_EMAIL_SCHEDULER_TIMEZONE;
}

export function getRunDateInTimezone(
  timezone = getSchedulerTimezone(),
  now = new Date(),
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function getDayBounds(
  runDate: string,
  timezone = getSchedulerTimezone(),
): { start: Date; end: Date } {
  const [year, month, day] = runDate.split("-").map(Number);
  const reference = new Date(Date.UTC(year, month - 1, day, 12));
  const offsetMs = getTimezoneOffsetMs(timezone, reference);
  const start = new Date(Date.UTC(year, month - 1, day) - offsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function getTimezoneOffsetMs(timezone: string, date: Date): number {
  const utc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const localized = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  return localized.getTime() - utc.getTime();
}
