import { useCallback, useRef, useState } from "react";

import type { ChatAttachment } from "./api";

export interface StreamingTurn {
  /** Live token-accumulated text while streaming. */
  text: string;
  /** Final message id after the stream's done event fires. */
  messageId: number | null;
  /** Whether a stream is currently in-flight. */
  active: boolean;
  /** Error message if the stream failed; otherwise null. */
  error: string | null;
  /** Set when the server fell back to a secondary model mid-request. */
  fallbackModel: string | null;
  /** True while the JD pre-parse (haiku) is running. */
  jdParsing: boolean;
  /** True once the JD pre-parse completed successfully. */
  jdParsed: boolean;
  /** Populated when the server emits a skill-routing decision. */
  skillRouting: { selectedSlugs: string[]; reason?: string } | null;
}

const INITIAL: StreamingTurn = { text: "", messageId: null, active: false, error: null, fallbackModel: null, jdParsing: false, jdParsed: false, skillRouting: null };

/**
 * SSE chat stream hook.
 *
 * Calls `POST /api/chat/threads/:id/messages` and reads the streamed response
 * via `fetch` + `ReadableStream`. EventSource isn't used because it doesn't
 * support POST + credentials cleanly.
 */
export function useChatStream(opts: { onDone?: () => void } = {}): {
  state: StreamingTurn;
  send: (threadId: number, content: string, attachments: ChatAttachment[], modelConfigId?: number, jdParseEnabled?: boolean, explicitSkillSlugs?: string[]) => Promise<void>;
  stop: () => void;
  reset: () => void;
} {
  const [state, setState] = useState<StreamingTurn>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => setState(INITIAL), []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((s) => ({ ...s, active: false }));
  }, []);

  const send = useCallback(
    async (threadId: number, content: string, attachments: ChatAttachment[], modelConfigId?: number, jdParseEnabled?: boolean, explicitSkillSlugs?: string[]) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ text: "", messageId: null, active: true, error: null, fallbackModel: null, jdParsing: false, jdParsed: false, skillRouting: null });

      let response: Response;
      try {
        response = await fetch(`/api/chat/threads/${threadId}/messages`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, attachments, modelConfigId, jdParseEnabled, explicitSkillSlugs }),
          signal: controller.signal,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState((s) => ({ ...s, active: false, error: (err as Error).message }));
        return;
      }

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        setState((s) => ({
          ...s,
          active: false,
          error: body?.error ?? `Request failed (${response.status})`,
        }));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let frameEnd = buffer.indexOf("\n\n");
          while (frameEnd >= 0) {
            const frame = buffer.slice(0, frameEnd);
            buffer = buffer.slice(frameEnd + 2);
            handleFrame(frame);
            frameEnd = buffer.indexOf("\n\n");
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setState((s) => ({ ...s, active: false, error: (err as Error).message }));
        }
      } finally {
        abortRef.current = null;
      }

      function handleFrame(frame: string) {
        let event = "message";
        const dataLines: string[] = [];
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        const dataRaw = dataLines.join("\n");
        if (!dataRaw) return;
        let data: { token?: string; messageId?: number; message?: string; fallbackModel?: string; originalModel?: string; selectedSlugs?: string[]; reason?: string };
        try {
          data = JSON.parse(dataRaw);
        } catch {
          return;
        }

        if (event === "error") {
          setState((s) => ({ ...s, active: false, error: data.message ?? "Stream error" }));
          return;
        }
        if (event === "done") {
          setState((s) => ({
            ...s,
            active: false,
            messageId: typeof data.messageId === "number" ? data.messageId : s.messageId,
          }));
          opts.onDone?.();
          return;
        }
        if (event === "fallback") {
          setState((s) => ({ ...s, fallbackModel: data.fallbackModel ?? null }));
          return;
        }
        if (event === "jd-parsing") {
          setState((s) => ({ ...s, jdParsing: true }));
          return;
        }
        if (event === "jd-parsed") {
          setState((s) => ({ ...s, jdParsing: false, jdParsed: true }));
          return;
        }
        if (event === "jd-parse-failed") {
          setState((s) => ({ ...s, jdParsing: false }));
          return;
        }
        if (event === "skill-routing") {
          setState((s) => ({ ...s, skillRouting: { selectedSlugs: data.selectedSlugs ?? [], reason: data.reason } }));
          return;
        }
        if (event === "user-message") {
          return;
        }
        // default "message" event = token
        if (typeof data.token === "string") {
          setState((s) => ({ ...s, text: s.text + data.token }));
        }
      }
    },
    [opts],
  );

  return { state, send, stop, reset };
}
