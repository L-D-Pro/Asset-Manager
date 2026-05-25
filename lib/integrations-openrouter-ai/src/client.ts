import OpenAI from "openai";

let instance: OpenAI | undefined;

/**
 * Lazily construct the OpenRouter client on first use. Env validation happens
 * here — not at module load — so importing this package is side-effect-free.
 * Tests and tooling that never make an AI call don't need the credentials set,
 * and a missing var fails at the first real call instead of crashing import of
 * the entire module graph.
 */
function getClient(): OpenAI {
  if (!instance) {
    const baseURL = process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL;
    const apiKey = process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
    if (!baseURL) {
      throw new Error(
        "AI_INTEGRATIONS_OPENROUTER_BASE_URL must be set. Did you forget to provision the OpenRouter AI integration?",
      );
    }
    if (!apiKey) {
      throw new Error(
        "AI_INTEGRATIONS_OPENROUTER_API_KEY must be set. Did you forget to provision the OpenRouter AI integration?",
      );
    }
    instance = new OpenAI({ baseURL, apiKey });
  }
  return instance;
}

/**
 * Proxy that defers client construction (and env validation) to the first
 * property access. Preserves the `openrouter.chat.completions.create(...)`
 * surface so consumers are unchanged, while keeping module import free of
 * side effects.
 */
export const openrouter: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
