import {
  getSchedulerTimezone,
  startEmailScheduler,
} from "./services/email/scheduler.server";
import { queueLogger } from "./services/logger.server";
import { startQueueWorkers } from "./services/queue-workers.server";

queueLogger.info(
  { timezone: getSchedulerTimezone() },
  "starting background worker",
);

startQueueWorkers();
startEmailScheduler();
