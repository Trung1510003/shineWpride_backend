import { startEmailScheduler } from "./services/email/scheduler.server";

const shouldStartScheduler =
  process.env.NODE_ENV !== "test" &&
  process.env.VITEST !== "true" &&
  process.env.APP_PROCESS_ROLE !== "web" &&
  process.env.EMAIL_SCHEDULER_ENABLED !== "false";

if (shouldStartScheduler) {
  startEmailScheduler();
}
