import pino from "pino";

/**
 * Shared structured logger for the API server.
 *
 * Uses `pino` with JSON output in production and pretty-printing in development.
 * Sensitive fields (Authorization header, cookies) are automatically redacted.
 *
 * Log level is controlled via the `LOG_LEVEL` environment variable (default: `"info"`).
 *
 * Usage:
 * ```ts
 * import { logger } from "./lib/logger";
 * logger.info({ jobId: 42 }, "Starting JD parse");
 * logger.error({ err }, "Unexpected failure");
 * ```
 */
const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
