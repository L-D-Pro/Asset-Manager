import type { MessageAttachment } from "@workspace/db";
import { buildParsedJdBlock, type ParsedJd } from "./context-builder";
import { resolveChatPrompt, type ResolveChatPromptParams } from "./resolve-system-prompt";
import type { LeverConfigInput, PromptSection } from "./system-prompt";
import type { RoutingDecision } from "./skill-router";

export interface BuildFinalChatPayloadArgs {
  userId: number;
  userMessage: { content: string; attachments: MessageAttachment[] };
  /** Pre-loaded conversation history to include in messages. Caller owns loading from DB. */
  history: Array<{ role: "user" | "assistant"; content: string }>;
  explicitSlugs?: string[];
  /** Pre-parsed JD — appended to system prompt and shown as a section if non-null. */
  parsedJd?: ParsedJd | null;
  overrides?: ResolveChatPromptParams["overrides"];
}

export interface FinalChatPayloadMetadata {
  selectedSkillCount: number;
  historyMessageCount: number;
  /** True if the full skill catalog was injected — should always be false. */
  fullSkillCatalogPresent: boolean;
  /** True if parsedJd was appended but not represented as a section — should always be false. */
  parsedJdPresentButNotSectioned: boolean;
  /** Whether a best_practices section is present in the prompt. */
  bestPracticesEnabled: boolean;
  /** Non-empty means an invariant violation was detected. */
  warnings: string[];
}

export interface FinalChatPayloadInspect {
  /** Exact messages array sent to the model: [{role:'system'}, ...history]. */
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  /** The full assembled system prompt string (messages[0].content). */
  systemPrompt: string;
  /** Labeled sections of the system prompt, including parsed_jd if present. */
  sections: PromptSection[];
  /** The raw JD block text if parsedJd was provided, null otherwise. */
  parsedJdBlock: string | null;
  routingDecision: RoutingDecision;
  routingMode: string;
  metadata: FinalChatPayloadMetadata;
}

const CATALOG_SENTINEL = "## Available skills\n\nYou have these specialized skills";
const OLD_SKILL_SLUGS = ["resume-ats-optimizer", "tailored-resume-generator"];

/**
 * Canonical function that builds the exact payload sent to the chat model.
 *
 * Both the live streaming path and the Inspect preview path MUST go through
 * this function so they are guaranteed to produce identical message arrays.
 * The caller is responsible for providing history (loaded from DB).
 */
export async function buildFinalChatPayload(
  args: BuildFinalChatPayloadArgs,
): Promise<FinalChatPayloadInspect> {
  const resolved = await resolveChatPrompt({
    userMessage: args.userMessage.content,
    attachments: args.userMessage.attachments,
    explicitSlugs: args.explicitSlugs,
    userId: args.userId,
    overrides: args.overrides,
  });

  const parsedJdBlock = args.parsedJd ? buildParsedJdBlock(args.parsedJd) : null;
  const fullSystemPrompt = parsedJdBlock
    ? `${resolved.systemPrompt}\n\n${parsedJdBlock}`
    : resolved.systemPrompt;

  // Add parsed_jd as its own labeled section so the inspector can display it.
  const sections: PromptSection[] = [
    ...(resolved.sections ?? []),
    ...(parsedJdBlock
      ? [{ lever: "parsed_jd" as const, label: "Parsed JD", content: parsedJdBlock }]
      : []),
  ];

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: fullSystemPrompt },
    ...args.history,
  ];

  // ── Leakage checks ──────────────────────────────────────────────────────────
  const warnings: string[] = [];

  const fullSkillCatalogPresent = fullSystemPrompt.includes(CATALOG_SENTINEL);
  if (fullSkillCatalogPresent) {
    warnings.push("Full skill catalog injected into system prompt — this should never happen.");
  }

  const parsedJdPresentButNotSectioned =
    parsedJdBlock !== null && !sections.some((s) => s.lever === "parsed_jd");
  if (parsedJdPresentButNotSectioned) {
    warnings.push("Parsed JD is in system prompt but missing from sections — inspect is incomplete.");
  }

  const bestPracticesEnabled = (resolved.sections ?? []).some((s) => s.lever === "best_practices");
  const bpInPrompt = fullSystemPrompt.toLowerCase().includes("best practices");
  if (!bestPracticesEnabled && bpInPrompt) {
    warnings.push("Best practices section is disabled but 'best practices' text appears in system prompt.");
  }

  for (const slug of OLD_SKILL_SLUGS) {
    if (
      !resolved.decision.selectedSlugs.includes(slug) &&
      fullSystemPrompt.includes(slug)
    ) {
      warnings.push(`Old skill slug '${slug}' appears in system prompt but was not selected.`);
    }
  }

  return {
    messages,
    systemPrompt: fullSystemPrompt,
    sections,
    parsedJdBlock,
    routingDecision: resolved.decision,
    routingMode: resolved.mode,
    metadata: {
      selectedSkillCount: resolved.decision.selectedSlugs.length,
      historyMessageCount: args.history.length,
      fullSkillCatalogPresent,
      parsedJdPresentButNotSectioned,
      bestPracticesEnabled,
      warnings,
    },
  };
}
