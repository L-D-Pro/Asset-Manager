import { smartApi } from "@/lib/smart-ai-api";

export interface ChatAttachment {
  kind: "base_resume" | "job" | "claims";
  refId?: number;
  snapshot: Record<string, unknown>;
}

export interface ChatThread {
  id: number;
  userId: number;
  title: string;
  modelScope: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  attachments: ChatAttachment[];
  runId: string | null;
  promptVersionId: number | null;
  modelName: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  createdAt: string;
}

export const chatApi = {
  listThreads: () => smartApi<ChatThread[]>("/chat/threads"),
  createThread: (body: { title?: string } = {}) =>
    smartApi<ChatThread>("/chat/threads", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateThread: (id: number, body: { title?: string; archived?: boolean }) =>
    smartApi<ChatThread>(`/chat/threads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteThread: (id: number) =>
    smartApi<void>(`/chat/threads/${id}`, { method: "DELETE" }),
  listMessages: (id: number) => smartApi<ChatMessage[]>(`/chat/threads/${id}/messages`),
  postFeedback: (messageId: number, outcome: "approved" | "rejected", notes?: string) =>
    smartApi(`/chat/messages/${messageId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ outcome, notes }),
    }),
};
