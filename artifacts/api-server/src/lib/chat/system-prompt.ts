import type { MessageAttachment } from "@workspace/db";

import { buildAttachmentsBlock } from "./context-builder";

/**
 * Default identity/wrapper block. Used only to seed `ai_chat_lever_config`
 * on first startup — at runtime the identity text is read from that table so
 * it can be edited via the Chat Control Plane.
 */
export const IDENTITY_BLOCK = `You are a job-application copilot for a single user. You have access to specialized skills documented below. Apply them when the user's request matches their triggers. Be concise, evidence-based, and never invent verified credentials or claims. When the user attaches read-only context (resume, job description, claims), treat it as authoritative for that turn.`;

/** One vendored/active chat skill, reduced to what the prompt needs. */
export interface PromptSkill {
  slug: string;
  body: string;
}

/** Compact catalog entry — what the model sees about a skill it did NOT load. */
export interface CatalogEntry {
  slug: string;
  name: string;
  description: string;
}

/** Fully-resolved inputs for assembling a chat system prompt. */
export interface SystemPromptInputs {
  /** Identity/wrapper text. Empty string omits the identity section. */
  identityText: string;
  /** Compact metadata for ALL active skills — progressive-disclosure catalog. */
  catalog: CatalogEntry[];
  /** Selected chat skills whose FULL body is injected this turn. */
  skills: PromptSkill[];
  /** Pre-formatted best-practices block. Empty string omits the section. */
  bestPracticesText: string;
  /** Snapshots the user attached to the *current* user message. */
  attachments: MessageAttachment[];
}

/** Which lever produced a section — used by the inspector to label output. */
export type SectionLever =
  | "identity"
  | "skill_catalog"
  | "skill"
  | "best_practices"
  | "attachments"
  | "parsed_jd";

/** One labeled section of the assembled system prompt. */
export interface PromptSection {
  lever: SectionLever;
  /** Human-readable label (skill slug for skills). */
  label: string;
  /** The exact text contributed to the prompt. */
  content: string;
}

const SECTION_SEPARATOR = "\n\n---\n\n";

/**
 * Assemble the chat system prompt as an ordered list of labeled sections.
 *
 * Pure — no I/O. Order: identity → skills → best practices → attachments.
 * Empty inputs are skipped so the inspector and the joined prompt only ever
 * show levers that actually contributed.
 */
export function buildSystemPromptSections(
  inputs: SystemPromptInputs,
): PromptSection[] {
  const sections: PromptSection[] = [];

  const identity = inputs.identityText.trim();
  if (identity.length > 0) {
    sections.push({ lever: "identity", label: "Identity", content: identity });
  }

  if (inputs.catalog.length > 0) {
    const lines = inputs.catalog.map(
      (c) => `- \`${c.slug}\`${c.name ? ` (${c.name})` : ""} — ${c.description}`,
    );
    sections.push({
      lever: "skill_catalog",
      label: "Skill catalog",
      content:
        "## Available skills\n\nYou have these specialized skills. Full instructions for the relevant one(s) are included below; the rest are listed so you know they exist and can offer them.\n\n" +
        lines.join("\n"),
    });
  }

  for (const skill of inputs.skills) {
    const body = skill.body.trim();
    if (body.length === 0) continue;
    sections.push({
      lever: "skill",
      label: skill.slug,
      content: `## Skill: ${skill.slug}\n\n${body}`,
    });
  }

  const bestPractices = inputs.bestPracticesText.trim();
  if (bestPractices.length > 0) {
    sections.push({
      lever: "best_practices",
      label: "Best practices",
      content: bestPractices,
    });
  }

  const attachmentsBlock = buildAttachmentsBlock(inputs.attachments);
  if (attachmentsBlock.length > 0) {
    sections.push({
      lever: "attachments",
      label: "Attached context",
      content: attachmentsBlock,
    });
  }

  return sections;
}

/**
 * Assemble the chat system prompt as a single string — the value sent to the
 * model. Pure: just joins `buildSystemPromptSections()` with the separator.
 */
export function buildSystemPrompt(inputs: SystemPromptInputs): string {
  return buildSystemPromptSections(inputs)
    .map((s) => s.content)
    .join(SECTION_SEPARATOR);
}

/** Live lever state — the subset of `ai_chat_lever_config` the prompt needs. */
export interface LeverConfigInput {
  identityText: string;
  skillsEnabled: boolean;
  bestPracticesEnabled: boolean;
  /** `none` | `auto` | `explicit` | `debug_all`. */
  skillRoutingMode: string;
}
