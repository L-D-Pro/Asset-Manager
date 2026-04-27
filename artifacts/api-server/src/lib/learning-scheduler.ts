import { db, aiLearningConfigTable } from "@workspace/db";
import { logger } from "./logger";

let cron: ((expression: string, fn: () => void) => void) | null = null;
let currentJob: unknown = null;

async function tryLoadCron(): Promise<boolean> {
  if (cron) return true;
  try {
    const mod = await import("node-cron");
    cron = mod.schedule;
    return true;
  } catch {
    logger.warn("node-cron not available; learning scheduler disabled");
    return false;
  }
}

async function loadConfig() {
  const [config] = await db.select().from(aiLearningConfigTable).limit(1);
  return config;
}

async function runRecompute() {
  try {
    logger.info("Learning scheduler: starting recompute cycle");
    const response = await fetch("http://localhost:" + (process.env.PORT || "5000") + "/api/ai-learning/recompute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      logger.warn({ status: response.status }, "Learning scheduler: recompute returned non-OK");
      return;
    }
    const data = (await response.json()) as { ok: boolean; statsCount: number };
    logger.info({ statsCount: data.statsCount }, "Learning scheduler: recompute completed");
  } catch (error) {
    logger.error({ error }, "Learning scheduler: recompute failed");
  }
}

export async function startLearningScheduler(): Promise<void> {
  const available = await tryLoadCron();
  if (!available || !cron) return;

  const config = await loadConfig();
  if (!config) {
    logger.info("Learning scheduler: no config found, skipping startup");
    return;
  }

  const expression = config.recomputeScheduleCron || "0 2 * * *";
  logger.info({ expression }, "Learning scheduler: starting with cron expression");

  currentJob = cron(expression, () => {
    runRecompute().catch((err) => {
      logger.error({ error: String(err) }, "Learning scheduler: scheduled recompute threw");
    });
  });
}

export function stopLearningScheduler(): void {
  if (currentJob && typeof (currentJob as { stop?: () => void }).stop === "function") {
    (currentJob as { stop: () => void }).stop();
    currentJob = null;
    logger.info("Learning scheduler: stopped");
  }
}
