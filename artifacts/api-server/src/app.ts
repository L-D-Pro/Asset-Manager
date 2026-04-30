import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import { loginRateLimit, totpRateLimit, logoutRateLimit } from "./middlewares/rate-limit";
import { startLearningScheduler } from "./lib/learning-scheduler";
import { jobsAggregator } from "./lib/jobs-aggregator";
import type { SessionMiddlewareFactory } from "./lib/http-types";

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

const sessionMiddleware = session as unknown as SessionMiddlewareFactory;
const PgSession = ConnectPgSimple(sessionMiddleware);

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required but was not provided.");
}

const isProduction = process.env.NODE_ENV === "production";

const app: Express = express();

if (isProduction) {
  // Required so secure cookies work correctly behind App Platform's proxy.
  app.set("trust proxy", 1);
}

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
  sessionMiddleware({
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

// Rate limiting for auth endpoints — must be mounted BEFORE the router
app.use("/api/auth/login", loginRateLimit);
app.use("/api/auth/login/totp", totpRateLimit);
app.use("/api/auth/logout", logoutRateLimit);

app.use("/api", router);

// --- Diagnostic Dashboard ---

/** Cached OpenRouter health check to avoid hammering their API on every request. */
let orCache: { status: string; color: string; at: number } | null = null;
const OR_CACHE_TTL_MS = 60_000;

async function checkOpenRouter(): Promise<{ status: string; color: string }> {
  const now = Date.now();
  if (orCache && now - orCache.at < OR_CACHE_TTL_MS) {
    return { status: orCache.status, color: orCache.color };
  }

  const orKey = process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
  if (!orKey) {
    orCache = { status: "Not Configured ❌", color: "red", at: now };
    return { status: orCache.status, color: orCache.color };
  }

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5_000);
    const orRes = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${orKey}` },
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    if (orRes.ok) {
      orCache = { status: "Authenticated ✅", color: "green", at: now };
    } else {
      orCache = { status: `Auth Failed ❌ (${orRes.status})`, color: "red", at: now };
    }
  } catch {
    orCache = { status: "Network Error ❌", color: "red", at: now };
  }
  return { status: orCache.status, color: orCache.color };
}

app.get("/", async (_req, res) => {
  const secretOk = !!SESSION_SECRET && SESSION_SECRET.length > 8;

  // 1. Check Database
  let dbStatus = "Checking...";
  let dbColor = "gray";
  try {
    await pool.query('SELECT 1');
    dbStatus = "Connected ✅";
    dbColor = "green";
  } catch (err) {
    dbStatus = `Failed ❌ (${(err as Error).message})`;
    dbColor = "red";
  }

  // 2. Check OpenRouter (cached + timeout)
  const orKey = process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
  const orKeyOk = !!orKey && orKey.length > 8;
  const { status: orStatus, color: orColor } = await checkOpenRouter();

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Job Ops Diagnostic Dashboard</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; max-width: 800px; margin: 0 auto; }
        h1 { border-bottom: 1px solid #334155; padding-bottom: 0.5rem; }
        .card { background: #1e293b; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; border: 1px solid #334155; }
        .row { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #334155; }
        .row:last-child { border-bottom: none; }
        .label { font-weight: bold; color: #cbd5e1; }
        .status-green { color: #4ade80; font-weight: bold; }
        .status-red { color: #f87171; font-weight: bold; }
        .status-gray { color: #94a3b8; }
        .code { font-family: monospace; background: #0f172a; padding: 0.2rem 0.4rem; border-radius: 4px; color: #93c5fd; }
      </style>
    </head>
    <body>
      <h1>🚀 Job Ops Diagnostic Dashboard</h1>
      <p>System status and API connectivity checks.</p>
      
      <div class="card">
        <h2>Infrastructure</h2>
        <div class="row">
          <span class="label">PostgreSQL Database</span>
          <span class="status-${dbColor}">${dbStatus}</span>
        </div>
        <div class="row">
          <span class="label">Session Secret</span>
          <span class="code">${secretOk ? "Configured ✅" : "Not Configured ❌"}</span>
        </div>
      </div>

      <div class="card">
        <h2>API Integrations</h2>
        
        <div class="row">
          <span class="label">OpenRouter</span>
          <div>
            <span class="code" style="margin-right: 1rem;">${orKeyOk ? "Key Present ✅" : "Not Configured ❌"}</span>
            <span class="status-${orColor}">${orStatus}</span>
          </div>
        </div>

      </div>
      
      <p style="text-align: center; color: #64748b; font-size: 0.875rem;">
        API server is running locally on port ${process.env.PORT || 5000}. UI runs on port 5173.
      </p>
    </body>
    </html>
  `;

  res.send(html);
});

startLearningScheduler().catch((err) => {
  logger.error({ error: String(err) }, "Failed to start learning scheduler");
});

jobsAggregator.start();

export default app;
