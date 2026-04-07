import app from "./app";
import { logger } from "./lib/logger";

/**
 * API server entry point.
 *
 * Reads the `PORT` environment variable and starts the Express HTTP server.
 * Throws immediately on startup if `PORT` is absent or not a positive integer —
 * a missing port is a misconfiguration that should surface loudly rather than
 * silently binding to a default.
 *
 * The Replit workflow system injects `PORT` automatically for each registered artifact.
 */
const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
