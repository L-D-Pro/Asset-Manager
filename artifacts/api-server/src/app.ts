import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

/**
 * Configured Express 5 application.
 *
 * Middleware stack (in order):
 * 1. `pino-http`        — structured HTTP request/response logging
 * 2. `cors`             — allows cross-origin requests with credentials (required for Replit proxy)
 * 3. `express-session`  — PostgreSQL-backed sessions for auth
 * 4. `express.json()`   — parses JSON request bodies
 * 5. `express.urlencoded()` — parses URL-encoded form bodies
 *
 * All API routes are mounted under `/api` via the router in `./routes/index.ts`.
 *
 * Express 5 propagates async errors automatically — no explicit `try/catch` wrappers
 * are needed in route handlers for unexpected errors.
 */

const PgSession = ConnectPgSimple(session);

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required but was not provided.");
}

const isProduction = process.env.NODE_ENV === "production";

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

/**
 * CORS with credentials — required for the browser to send session cookies.
 *
 * We dynamically allow the Replit dev domain and localhost origins.
 * In production (DigitalOcean), set ALLOWED_ORIGINS to your actual domain.
 */
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

// Always allow local development
allowedOrigins.push("http://localhost:23183", "http://localhost:5173");

// Add the Replit dev domain if running on Replit
const replitDomain = process.env.REPLIT_DEV_DOMAIN;
if (replitDomain) {
  allowedOrigins.push(`https://${replitDomain}`);
}

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (same-origin, curl, server-to-server)
      if (!origin) {
        callback(null, true);
        return;
      }
      // Allow any Replit subdomain
      if (origin.endsWith(".replit.dev") || origin.endsWith(".repl.co")) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

// PostgreSQL-backed session store — persists sessions across server restarts
app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "session",
    }),
    name: "jobops.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
