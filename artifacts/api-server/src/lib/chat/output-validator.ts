/**
 * Light output validator for chat completions.
 *
 * Runs AFTER the stream finishes, so it is non-blocking — the user has already
 * seen the text. Its job is to surface warnings into observability
 * (`event_logs.metadata.validation`) so we can spot empty/oversized/malformed
 * outputs without gating the response.
 */

/** Hard ceiling — outputs longer than this are flagged (not truncated). */
const MAX_OUTPUT_CHARS = 32_000;

export interface OutputValidation {
  /** Output is non-empty and within the length ceiling. */
  lengthOk: boolean;
  /** No obvious markdown/structure problems. */
  formatOk: boolean;
  /** Human-readable list of issues found (empty when clean). */
  warnings: string[];
}

/** Validate an assistant message body. Pure — no I/O. */
export function validateChatOutput(text: string): OutputValidation {
  const warnings: string[] = [];

  const trimmed = text.trim();
  let lengthOk = true;
  if (trimmed.length === 0) {
    lengthOk = false;
    warnings.push("Output is empty.");
  } else if (text.length > MAX_OUTPUT_CHARS) {
    lengthOk = false;
    warnings.push(`Output exceeds ${MAX_OUTPUT_CHARS} characters (${text.length}).`);
  }

  let formatOk = true;

  // Unbalanced fenced code blocks.
  const fenceCount = (text.match(/```/g) ?? []).length;
  if (fenceCount % 2 !== 0) {
    formatOk = false;
    warnings.push("Unbalanced code fences (```).");
  }

  // Leaked prompt scaffolding markers.
  if (/##\s*Skill:|##\s*Available skills|<!-- compressed/i.test(text)) {
    formatOk = false;
    warnings.push("Output appears to leak system-prompt scaffolding.");
  }

  return { lengthOk, formatOk, warnings };
}
