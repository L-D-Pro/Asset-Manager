import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { logger } from "../logger";

/**
 * A SKILL.md file vendored from skills.sh. The body is everything after the
 * YAML frontmatter; it is injected verbatim into the chat system prompt.
 */
export interface LoadedSkill {
  /** Filename stem — used as the canonical id (matches `ai_prompt_versions.label`). */
  slug: string;
  /** Human-readable name from frontmatter. */
  name: string;
  /** Short description from frontmatter (used for intent routing / UI labels). */
  description: string;
  /** Full markdown body, frontmatter stripped. */
  body: string;
}

const SKILL_FILES: ReadonlyArray<{ slug: string; file: string }> = [
  { slug: "resume-ats-optimizer", file: "resume-ats-optimizer.md" },
  { slug: "cover-letter-generator", file: "cover-letter-generator.md" },
  { slug: "tailored-resume-generator", file: "tailored-resume-generator.md" },
];

let cache: LoadedSkill[] | null = null;

/**
 * Parse a minimal YAML frontmatter block. We only need `name` and `description`
 * keys for SKILL.md files — both are plain single-line scalars — so a 20-line
 * parser is enough and avoids pulling in a yaml dependency.
 */
function parseFrontmatter(source: string): { frontmatter: Record<string, string>; body: string } {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: source };
  }

  const frontmatter: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key.length > 0) frontmatter[key] = value;
  }
  return { frontmatter, body: match[2]!.trimStart() };
}

function loadFromDisk(): LoadedSkill[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const skillsDir = join(here, "skills");

  const skills: LoadedSkill[] = [];
  for (const { slug, file } of SKILL_FILES) {
    const path = join(skillsDir, file);
    try {
      const raw = readFileSync(path, "utf8");
      const { frontmatter, body } = parseFrontmatter(raw);
      skills.push({
        slug,
        name: frontmatter.name ?? slug,
        description: frontmatter.description ?? "",
        body,
      });
    } catch (err) {
      logger.error({ err, slug, path }, "Failed to load vendored chat skill");
      throw new Error(`Chat skill missing or unreadable: ${slug} (${path})`);
    }
  }
  return skills;
}

/**
 * Returns the vendored chat skills. Memoized on first call. Reads from
 * `./skills/*.md` relative to this module.
 *
 * `forceReload` exists for tests — production paths should never use it.
 */
export function loadSkills(forceReload = false): LoadedSkill[] {
  if (!cache || forceReload) {
    cache = loadFromDisk();
  }
  return cache;
}

/** Lookup a skill by its slug. Throws if the slug isn't a vendored skill. */
export function getSkillBySlug(slug: string): LoadedSkill {
  const found = loadSkills().find((s) => s.slug === slug);
  if (!found) throw new Error(`Unknown chat skill slug: ${slug}`);
  return found;
}
