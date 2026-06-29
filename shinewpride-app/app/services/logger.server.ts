import pino from "pino";

const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: {
    service: "shinewpride-app",
  },
});

export function createLogger(domain: string) {
  return baseLogger.child({ domain });
}

export const watermarkLogger = createLogger("watermark");
export const emailLogger = createLogger("email");
export const queueLogger = createLogger("queue");
export const opsLogger = createLogger("ops");

export default baseLogger;
