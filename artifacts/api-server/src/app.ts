import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

/**
 * Configured Express 5 application.
 *
 * Middleware stack (in order):
 * 1. `pino-http` — structured HTTP request/response logging (redacts query strings from URL logs)
 * 2. `cors` — allows cross-origin requests (required for Replit preview proxy)
 * 3. `express.json()` — parses JSON request bodies
 * 4. `express.urlencoded()` — parses URL-encoded form bodies
 *
 * All API routes are mounted under `/api` via the router in `./routes/index.ts`.
 *
 * Express 5 propagates async errors automatically — no explicit `try/catch` wrappers
 * are needed in route handlers for unexpected errors.
 */
const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
