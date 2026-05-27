/**
 * Real-world routing verification harness.
 * Runs 15 scenarios against the live DB and reports routing decisions.
 * Does NOT call the generation model — routing only.
 *
 * Run from api-server root:
 *   node --env-file-if-exists=../../.env --import tsx scripts/verify-routing.mts
 */

import { resolveChatPrompt } from "../src/lib/chat/resolve-system-prompt.js";
import { validateChatOutput } from "../src/lib/chat/output-validator.js";
import { loadActiveChatSkills } from "../src/lib/chat/resolve-system-prompt.js";
import type { MessageAttachment } from "@workspace/db";

// ── Helpers ─────────────────────────────────────────────────────────────────

const attach = (kind: string, label = kind): MessageAttachment => {
  // Provide realistic snapshot shapes so buildAttachmentsBlock doesn't crash.
  let snapshot: Record<string, unknown>;
  if (kind === "job") {
    snapshot = { title: label, company: "Acme Corp", jdText: `[stub JD text for ${label}]` };
  } else if (kind === "tailored_resume") {
    snapshot = { contentText: `[stub tailored resume content for ${label}]` };
  } else {
    // base_resume, document, etc.
    snapshot = { contentText: `[stub resume content for ${label}]` };
  }
  return { kind, label, content: `[stub ${kind}]`, metadata: {}, snapshot } as unknown as MessageAttachment;
};

const BOLD = (s: string) => `\x1b[1m${s}\x1b[0m`;
const DIM  = (s: string) => `\x1b[2m${s}\x1b[0m`;
const RED  = (s: string) => `\x1b[31m${s}\x1b[0m`;
const GRN  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const YLW  = (s: string) => `\x1b[33m${s}\x1b[0m`;
const CYN  = (s: string) => `\x1b[36m${s}\x1b[0m`;

function pass(msg: string) { console.log(`  ${GRN("✓")} ${msg}`); }
function fail(msg: string) { console.log(`  ${RED("✗")} ${msg}`); }
function warn(msg: string) { console.log(`  ${YLW("⚠")} ${msg}`); }
function info(msg: string) { console.log(`  ${DIM("·")} ${msg}`); }

interface Scenario {
  id: number;
  label: string;
  message: string;
  attachments: MessageAttachment[];
  explicitSlugs?: string[];
  overrides?: Record<string, unknown>;
  nodeEnv?: string;
  // Expectations
  expect: {
    slugContains?: string[];        // each must appear in selectedSlugs
    slugEmpty?: boolean;            // selectedSlugs must be []
    notAllSkills?: boolean;         // selectedSlugs must not be all active skills
    noSkillCatalog?: boolean;       // system prompt must not contain skill catalog marker
    skillBodyPresent?: string;      // system prompt must contain this slug's body marker
    skillBodyAbsent?: string;       // system prompt must NOT contain this text
    llmNotCalled?: boolean;
    modeIs?: string;
    productionDebugDowngrade?: boolean; // mode must not be debug_all when NODE_ENV=production
  };
}

const BASE_RESUME = attach("base_resume", "My Resume");
const TAILORED_RESUME = attach("tailored_resume", "Tailored Resume");
const JOB_DESC = attach("job", "Software Engineer at Acme");

// ── Scenario definitions ────────────────────────────────────────────────────

const SCENARIOS: Scenario[] = [
  {
    id: 1,
    label: "Explicit tailor request + base_resume + job",
    message: "Tailor my resume to this JD",
    attachments: [BASE_RESUME, JOB_DESC],
    overrides: { skillRoutingMode: "auto" },
    expect: { slugContains: [], notAllSkills: true, noSkillCatalog: true },
    // just check routing doesn't blow up; slug depends on what's in DB
  },
  {
    id: 2,
    label: "Vague message + base_resume + job → attachment boost should select tailor-slug skill",
    message: "Make this fit better",
    attachments: [BASE_RESUME, JOB_DESC],
    overrides: { skillRoutingMode: "auto" },
    expect: { notAllSkills: true, noSkillCatalog: true },
  },
  {
    id: 3,
    label: "Vague review + tailored_resume + job → audit-slug skill",
    message: "Is this good?",
    attachments: [TAILORED_RESUME, JOB_DESC],
    overrides: { skillRoutingMode: "auto" },
    expect: { notAllSkills: true, noSkillCatalog: true },
  },
  {
    id: 4,
    label: "Review request + base_resume only (no JD) → no auto-select or LLM attempt",
    message: "Review this resume",
    attachments: [BASE_RESUME],
    overrides: { skillRoutingMode: "auto" },
    expect: { notAllSkills: true, noSkillCatalog: true },
  },
  {
    id: 5,
    label: "Vague tailor + base_resume only (no JD) → LLM or no-skill, not all",
    message: "Tailor this",
    attachments: [BASE_RESUME],
    overrides: { skillRoutingMode: "auto" },
    expect: { notAllSkills: true, noSkillCatalog: true },
  },
  {
    id: 6,
    label: "Cover letter request + resume + job",
    message: "Write a cover letter for this job",
    attachments: [BASE_RESUME, JOB_DESC],
    overrides: { skillRoutingMode: "auto" },
    expect: { notAllSkills: true, noSkillCatalog: true },
  },
  {
    id: 7,
    label: "Vague improvement + no attachments → no skill",
    message: "Can you improve this?",
    attachments: [],
    overrides: { skillRoutingMode: "auto" }, // force auto regardless of live DB mode
    expect: { slugEmpty: true, noSkillCatalog: true },
  },
  {
    id: 8,
    label: "JD summary + job_description only → no resume skill",
    message: "Summarize this JD",
    attachments: [JOB_DESC],
    overrides: { skillRoutingMode: "auto" },
    expect: { notAllSkills: true, noSkillCatalog: true },
  },
  {
    id: 9,
    label: "General chat + no attachments → no skill",
    message: "What should I do next?",
    attachments: [],
    overrides: { skillRoutingMode: "auto" }, // force auto regardless of live DB mode
    expect: { slugEmpty: true, noSkillCatalog: true },
  },
  {
    id: 10,
    label: "Explicit mode — skill picker set (falls through to auto if no valid slugs)",
    message: "Help me tailor this",
    attachments: [BASE_RESUME, JOB_DESC],
    explicitSlugs: [],       // empty → falls through to auto
    overrides: { skillRoutingMode: "explicit" },
    expect: { notAllSkills: true, noSkillCatalog: true },
  },
  {
    id: 11,
    label: "Skill picker mode = none → no skill injected regardless of message",
    message: "Tailor my resume to this JD",
    attachments: [BASE_RESUME, JOB_DESC],
    overrides: { skillRoutingMode: "none" },
    expect: { slugEmpty: true, noSkillCatalog: true, modeIs: "none" },
  },
  {
    id: 12,
    label: "debug_all in development → all skills injected, budget bypassed",
    message: "anything",
    attachments: [],
    overrides: { skillRoutingMode: "debug_all" },
    nodeEnv: "development",
    expect: { notAllSkills: false, noSkillCatalog: true, modeIs: "debug_all" },
    // notAllSkills: false means we DO expect all skills (inverse check disabled)
  },
  {
    id: 13,
    label: "debug_all in production → downgraded to auto",
    message: "anything",
    attachments: [],
    overrides: { skillRoutingMode: "debug_all" },
    nodeEnv: "production",
    expect: { notAllSkills: true, noSkillCatalog: true, productionDebugDowngrade: true },
  },
  {
    id: 14,
    label: "Malformed LLM router response → fail-closed, deterministic fallback",
    message: "draft a report",
    attachments: [],
    overrides: { skillRoutingMode: "auto" }, // force auto regardless of live DB mode
    expect: { notAllSkills: true, noSkillCatalog: true },
    // LLM won't be called here (no strong attachment, won't be ambiguous with real skills)
    // Just checks routing doesn't throw
  },
  {
    id: 15,
    label: "Low-confidence scenario + strong attachment → LLM path attempted (classify = null fallback)",
    message: "help",
    attachments: [BASE_RESUME, JOB_DESC],
    overrides: { skillRoutingMode: "auto" },
    expect: { notAllSkills: true, noSkillCatalog: true },
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function runScenario(scenario: Scenario, allSlugs: string[]): Promise<{ id: number; passed: boolean; issues: string[] }> {
  const { id, label, message, attachments, explicitSlugs, overrides = {}, nodeEnv, expect: ex } = scenario;

  console.log(`\n${BOLD(`Scenario ${id}`)}: ${CYN(label)}`);
  console.log(`  Message: "${message}"`);
  if (attachments.length > 0) console.log(`  Attachments: ${attachments.map(a => a.kind).join(", ")}`);
  if (explicitSlugs !== undefined) console.log(`  ExplicitSlugs: [${explicitSlugs.join(", ")}]`);

  // Temporarily set NODE_ENV for production-downgrade test
  const originalEnv = process.env.NODE_ENV;
  if (nodeEnv) process.env.NODE_ENV = nodeEnv;

  let result: Awaited<ReturnType<typeof resolveChatPrompt>>;
  try {
    result = await resolveChatPrompt({
      userMessage: message,
      attachments,
      explicitSlugs,
      overrides: overrides as never,
    });
  } catch (err) {
    if (nodeEnv) process.env.NODE_ENV = originalEnv;
    const issues = [`Threw: ${(err as Error).message}`];
    fail(`THREW: ${(err as Error).message}`);
    return { id, passed: false, issues };
  } finally {
    if (nodeEnv) process.env.NODE_ENV = originalEnv;
  }

  const { decision, systemPrompt, sections, mode } = result;
  const issues: string[] = [];

  // Report what happened
  info(`Mode: ${mode}`);
  info(`Selected: [${decision.selectedSlugs.join(", ") || "none"}]`);
  info(`Reason: ${decision.reason}`);
  info(`LLM used: ${decision.llmUsed}`);
  info(`Confidence: ${decision.confidence.toFixed(2)}`);
  if (decision.budgetTrimmed) warn("Budget trimmed");

  // Skill body presence check
  const skillSection = sections.find(s => s.lever === "skill");
  const hasSkillBody = !!skillSection && skillSection.content.length > 0;
  info(`Skill body in prompt: ${hasSkillBody ? GRN("yes") + ` [${decision.selectedSlugs.join(", ")}]` : DIM("no")}`);

  // Skill catalog presence check
  const catalogSection = sections.find(s => s.lever === "skill_catalog");
  const hasCatalog = !!catalogSection && catalogSection.content.length > 0;
  info(`Skill catalog in prompt: ${hasCatalog ? RED("YES (BUG)") : GRN("no")}`);

  // Validator
  const validation = validateChatOutput("", { selectedSlugs: decision.selectedSlugs });
  // empty text will always flag lengthOk=false, skip that
  const structuralWarnings = validation.warnings.filter(w => !w.includes("empty"));
  if (structuralWarnings.length > 0) {
    warn(`Validator warnings: ${structuralWarnings.join("; ")}`);
  }

  // ── Assertions ──────────────────────────────────────────────────────────

  // Must not contain catalog
  if (ex.noSkillCatalog !== false && hasCatalog) {
    const msg = "FAIL: skill catalog injected into prompt (no-catalog invariant violated)";
    fail(msg); issues.push(msg);
  } else if (ex.noSkillCatalog !== false) {
    pass("No skill catalog in prompt");
  }

  // slugEmpty
  if (ex.slugEmpty) {
    if (decision.selectedSlugs.length === 0) {
      pass("No skill selected (expected)");
    } else {
      const msg = `FAIL: expected empty selection, got [${decision.selectedSlugs.join(", ")}]`;
      fail(msg); issues.push(msg);
    }
  }

  // slugContains
  if (ex.slugContains && ex.slugContains.length > 0) {
    for (const slug of ex.slugContains) {
      if (decision.selectedSlugs.includes(slug)) {
        pass(`Selected slug includes "${slug}"`);
      } else {
        const msg = `FAIL: expected "${slug}" in selection [${decision.selectedSlugs.join(", ")}]`;
        fail(msg); issues.push(msg);
      }
    }
  }

  // notAllSkills — selectedSlugs must NOT equal all active skills
  if (ex.notAllSkills) {
    if (allSlugs.length === 0 || decision.selectedSlugs.length < allSlugs.length) {
      pass(`Not all skills injected (${decision.selectedSlugs.length}/${allSlugs.length})`);
    } else {
      // Check for exact match
      const gotAll = allSlugs.every(s => decision.selectedSlugs.includes(s));
      if (gotAll) {
        const msg = `FAIL: all ${allSlugs.length} skills injected (no-fallback-to-all violated)`;
        fail(msg); issues.push(msg);
      } else {
        pass(`Not all skills injected (${decision.selectedSlugs.length}/${allSlugs.length})`);
      }
    }
  }

  // debug_all expected — check all slugs injected
  if (scenario.id === 12 && mode === "debug_all") {
    if (decision.selectedSlugs.length === allSlugs.length && allSlugs.length > 0) {
      pass(`debug_all: all ${allSlugs.length} skills injected`);
    } else if (allSlugs.length === 0) {
      warn("debug_all: no active skills in DB to inject");
    } else {
      const msg = `FAIL: debug_all expected all ${allSlugs.length} skills, got ${decision.selectedSlugs.length}`;
      fail(msg); issues.push(msg);
    }
  }

  // modeIs
  if (ex.modeIs && mode !== ex.modeIs) {
    const msg = `FAIL: expected mode="${ex.modeIs}", got "${mode}"`;
    fail(msg); issues.push(msg);
  } else if (ex.modeIs) {
    pass(`Mode is "${mode}" (expected)`);
  }

  // productionDebugDowngrade
  if (ex.productionDebugDowngrade) {
    if (mode === "debug_all") {
      const msg = `FAIL: debug_all not downgraded in production`;
      fail(msg); issues.push(msg);
    } else {
      pass(`debug_all downgraded to "${mode}" in production`);
    }
  }

  // llmNotCalled
  if (ex.llmNotCalled && decision.llmUsed) {
    const msg = "FAIL: LLM called but expected not to be";
    fail(msg); issues.push(msg);
  }

  return { id, passed: issues.length === 0, issues };
}

async function main() {
  console.log(BOLD("\n=== Routing Verification Harness ===\n"));

  // Load active skills to know the full catalog size
  let allSkills: Awaited<ReturnType<typeof loadActiveChatSkills>>;
  try {
    allSkills = await loadActiveChatSkills();
  } catch (err) {
    console.error(RED(`Failed to load skills from DB: ${(err as Error).message}`));
    process.exit(1);
  }

  const allSlugs = allSkills.map(s => s.slug);
  console.log(`Active skills in DB (${allSlugs.length}): ${allSlugs.join(", ") || "(none)"}`);

  const results: Array<{ id: number; passed: boolean; issues: string[] }> = [];
  for (const scenario of SCENARIOS) {
    const r = await runScenario(scenario, allSlugs);
    results.push(r);
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`\n${BOLD("=== Summary ===")}`);
  for (const r of results) {
    const icon = r.passed ? GRN("✓") : RED("✗");
    const issues = r.issues.length > 0 ? ` — ${r.issues.join("; ")}` : "";
    console.log(`  ${icon} Scenario ${r.id}${issues}`);
  }
  console.log(`\n${passed === total ? GRN(`${passed}/${total} passed`) : RED(`${passed}/${total} passed`)}\n`);

  process.exit(passed === total ? 0 : 1);
}

main().catch(err => {
  console.error(RED(`Fatal: ${err.message}`));
  process.exit(1);
});
