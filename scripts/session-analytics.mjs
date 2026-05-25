#!/usr/bin/env node
// Claude Code session-usage analyzer.
//
// Scrapes local Claude session transcripts (~/.claude/projects/**/*.jsonl),
// aggregates work themes, prompt keywords, tool usage, and skill invocations,
// and prints a usage breakdown. Read-only; no network, no writes.
//
// Usage:
//   node scripts/session-analytics.mjs               # all projects
//   node scripts/session-analytics.mjs <dir>         # a specific project dir
//   node scripts/session-analytics.mjs --json        # raw JSON instead of report

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const jsonOut = args.includes("--json");
const dirArg = args.find((a) => !a.startsWith("--"));
const root = dirArg ?? join(homedir(), ".claude", "projects");
if (!existsSync(root)) {
  console.error(`No transcripts found at ${root}`);
  process.exit(1);
}

function walk(d) {
  let out = [];
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) out = out.concat(walk(p));
    else if (e.endsWith(".jsonl")) out.push(p);
  }
  return out;
}

const KW = {
  commit: /\bcommit\b/i, merge: /\bmerge\b/i, push: /\bpush\b/i,
  test: /test|vitest|playwright/i, fix_bug: /\bfix\b|\bbug\b|broken|\berror\b/i,
  cleanup: /cleanup|clean up|dead code|refactor|redundan|consolidat/i,
  audit: /audit|analyze|review|inspect/i, plan: /\bplan\b|roadmap|phase/i,
  docs: /\bdoc|document|readme|md file/i, skill_plugin: /skill|plugin|agent|subagent/i,
  run_build: /\brun\b|\bbuild\b|\bstart\b|launch/i, search: /search|find|grep|where is/i,
  schema_db: /schema|drizzle|migration|database|\bdb\b/i,
  chat_ai: /chat|prompt|model|openrouter|pipeline/i, git: /\bgit\b|branch|stage/i,
};

function text(c) {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.filter((b) => b && b.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n");
  return "";
}

const titles = {}, tools = {}, slash = {}, kw = {}, skills = {};
let realPrompts = 0;
const files = walk(root);

for (const f of files) {
  let s;
  try { s = readFileSync(f, "utf8"); } catch { continue; }
  for (const line of s.split("\n")) {
    if (!line.trim()) continue;
    let j;
    try { j = JSON.parse(line); } catch { continue; }
    if (j.type === "ai-title" && j.aiTitle) { titles[j.aiTitle] = (titles[j.aiTitle] || 0) + 1; continue; }
    if (j.type === "user" && j.message && j.message.role === "user") {
      const clean = text(j.message.content).replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, "").replace(/<[^>]+>/g, "").trim();
      if (!clean || clean.length < 2) continue;
      if (/CAVEMAN MODE|SessionStart|hook additional context|Tool loaded/i.test(clean) && clean.length < 120) continue;
      realPrompts++;
      if (clean.startsWith("/")) { const cmd = clean.split(/\s+/)[0]; slash[cmd] = (slash[cmd] || 0) + 1; }
      for (const [k, re] of Object.entries(KW)) if (re.test(clean)) kw[k] = (kw[k] || 0) + 1;
    }
    if (j.type === "assistant" && j.message && Array.isArray(j.message.content)) {
      for (const b of j.message.content) {
        if (b && b.type === "tool_use") {
          tools[b.name] = (tools[b.name] || 0) + 1;
          if (b.name === "Skill" && b.input && b.input.skill) skills[b.input.skill] = (skills[b.input.skill] || 0) + 1;
        }
      }
    }
  }
}

const top = (o, n = 25) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
const summary = {
  files: files.length, realPrompts,
  titles: top(titles, 40), tools: top(tools), slash: top(slash), kw: top(kw, 20), skills: top(skills, 20),
};

if (jsonOut) { console.log(JSON.stringify(summary, null, 2)); process.exit(0); }

const section = (label, rows) => {
  console.log(`\n${label}`);
  for (const [k, v] of rows) console.log(`  ${String(v).padStart(5)}  ${k}`);
};
console.log(`Claude session analytics — ${root}`);
console.log(`${summary.files} transcripts · ${summary.realPrompts} real prompts`);
section("WORK THEMES (session titles)", summary.titles);
section("TOOL USAGE", summary.tools);
section("PROMPT KEYWORDS", summary.kw);
section("SKILLS INVOKED", summary.skills);
if (summary.slash.length) section("SLASH COMMANDS", summary.slash);
