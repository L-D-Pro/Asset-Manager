#!/usr/bin/env node
// One-shot chat MVP seed runner. Uses pg directly so it doesn't need any
// TypeScript-loader plumbing.
//
// Usage (from repo root):
//   node --env-file=.env lib/db/seed-chat.mjs
//
// Idempotent — safe to re-run. Inserts rows only when a (taskScope='chat', ...)
// row with the same identity doesn't already exist.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set. Did you forget `node --env-file=.env`?");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
// Skills live alongside the api-server code; this script is in lib/db so we
// walk up to the repo root.
const skillsDir = join(here, "..", "..", "artifacts", "api-server", "src", "lib", "chat", "skills");

const SKILL_FILES = [
  { slug: "resume-ats-optimizer", file: "resume-ats-optimizer.md" },
  { slug: "cover-letter-generator", file: "cover-letter-generator.md" },
  { slug: "tailored-resume-generator", file: "tailored-resume-generator.md" },
];

const SONNET_MODEL = "anthropic/claude-sonnet-4.6";
const OPUS_MODEL = "anthropic/claude-opus-4-7";

function parseFrontmatter(source) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: source };
  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) frontmatter[key] = value;
  }
  return { frontmatter, body: match[2].trimStart() };
}

function resolveSsl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    const mode = url.searchParams.get("sslmode")?.toLowerCase();
    if (mode === "require") return { rejectUnauthorized: false };
    if (mode === "verify-ca" || mode === "verify-full") return { rejectUnauthorized: true };
    return undefined;
  } catch {
    return undefined;
  }
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSsl(process.env.DATABASE_URL),
});

try {
  await client.connect();
  console.log("Connected. Seeding chat runtime…");

  // 1) Prompt versions per skill. The DB has a unique constraint on
  //    (task_scope, version) so each chat-scoped skill gets its own version
  //    number — there's no semantic ordering, the version slot is just an id.
  let nextVersion = 1;
  const { rows: existingVersions } = await client.query(
    `SELECT max(version) AS max FROM ai_prompt_versions WHERE task_scope = 'chat'`,
  );
  if (existingVersions[0].max != null) {
    nextVersion = existingVersions[0].max + 1;
  }

  for (const { slug, file } of SKILL_FILES) {
    const raw = readFileSync(join(skillsDir, file), "utf8");
    const { frontmatter, body } = parseFrontmatter(raw);
    const name = frontmatter.name || slug;
    const description = frontmatter.description || "";

    const { rows } = await client.query(
      `SELECT id FROM ai_prompt_versions WHERE task_scope = 'chat' AND label = $1 LIMIT 1`,
      [slug],
    );
    if (rows.length > 0) {
      console.log(`· ai_prompt_versions(chat, ${slug}) already present (id=${rows[0].id})`);
      continue;
    }

    const inserted = await client.query(
      `INSERT INTO ai_prompt_versions
         (task_scope, label, version, system_prompt, is_active, role_label, skill_tags, notes)
       VALUES ('chat', $1, $2, $3, true, $4, ARRAY[$1]::text[], $5)
       RETURNING id`,
      [slug, nextVersion, body, name, `Vendored from skills.sh on chat MVP bootstrap. Description: ${description}`],
    );
    console.log(`+ ai_prompt_versions(chat, ${slug}) inserted (id=${inserted.rows[0].id}, version=${nextVersion})`);
    nextVersion += 1;
  }

  // 2) Model configs — Opus fallback first so Sonnet can reference its id.
  async function ensureModel({ taskScope, modelName, priority, fallbackModelId, maxTokens, costIn, costOut }) {
    const existing = await client.query(
      `SELECT id FROM ai_model_configs WHERE task_scope = $1 AND model_name = $2 LIMIT 1`,
      [taskScope, modelName],
    );
    if (existing.rows.length > 0) {
      console.log(`· ai_model_configs(${taskScope}, ${modelName}) already present (id=${existing.rows[0].id})`);
      return existing.rows[0].id;
    }
    const inserted = await client.query(
      `INSERT INTO ai_model_configs
         (task_scope, provider, model_name, is_active, priority, fallback_model_id, max_tokens, cost_per_input_token, cost_per_output_token)
       VALUES ($1, 'openrouter', $2, true, $3, $4, $5, $6, $7)
       RETURNING id`,
      [taskScope, modelName, priority, fallbackModelId, maxTokens, costIn, costOut],
    );
    console.log(`+ ai_model_configs(${taskScope}, ${modelName}) inserted (id=${inserted.rows[0].id})`);
    return inserted.rows[0].id;
  }

  const opusId = await ensureModel({
    taskScope: "chat",
    modelName: OPUS_MODEL,
    priority: 2,
    fallbackModelId: null,
    maxTokens: 4096,
    costIn: "0.000015",
    costOut: "0.000075",
  });

  await ensureModel({
    taskScope: "chat",
    modelName: SONNET_MODEL,
    priority: 1,
    fallbackModelId: opusId,
    maxTokens: 4096,
    costIn: "0.000003",
    costOut: "0.000015",
  });

  console.log("✓ chat runtime seed complete");
} catch (err) {
  console.error("✗ Seed failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
