import type { MessageAttachment } from "@workspace/db";

import { buildAttachmentsBlock } from "./context-builder";
import { loadSkills, type LoadedSkill } from "./skill-loader";

const IDENTITY_BLOCK = `You are a job-application copilot for a single user. You have access to specialized skills documented below. Apply them when the user's request matches their triggers. Be concise, evidence-based, and never invent verified credentials or claims. When the user attaches read-only context (resume, job description, claims), treat it as authoritative for that turn.`;

interface BuildSystemPromptOptions {
  /** Snapshots the user attached to the *current* user message. */
  attachments?: MessageAttachment[];
  /** Override the skills loaded into the prompt (tests only). */
  skills?: LoadedSkill[];
}

/**
 * Compose the system prompt sent to OpenRouter for one chat turn.
 *
 * Order (deterministic — verified by `system-prompt.test.ts`):
 *   1. Identity block
 *   2. Each vendored skill body, prefixed with a `## Skill: <slug>` divider
 *   3. The attachments block (only when attachments exist on the current turn)
 *
 * Both vendored skill bodies are always included so the model can pick the
 * right one mid-conversation without a router round-trip.
 */
export function buildSystemPrompt(opts: BuildSystemPromptOptions = {}): string {
  const skills = opts.skills ?? loadSkills();

  const skillBlocks = skills.map(
    (s) => `## Skill: ${s.slug}\n\n${s.body.trim()}`,
  );

  const attachmentsBlock = buildAttachmentsBlock(opts.attachments ?? []);

  return [IDENTITY_BLOCK, ...skillBlocks, attachmentsBlock]
    .filter((part) => part.length > 0)
    .join("\n\n---\n\n");
}
