import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { smartApi } from "@/lib/smart-ai-api";
import { toast } from "@/hooks/use-toast";
import { Icon } from "@/components/quiet/icon";

import { chatApi, type ChatAttachment, type ChatMessage, type ChatThread } from "./api";
import { useChatStream } from "./use-chat-stream";

interface BaseResume {
  id: number;
  contentText: string;
  label: string;
}
interface Job {
  id: number;
  title: string;
  company?: string | null;
  location?: string | null;
  description?: string | null;
}
interface Claim {
  id: number;
  text: string;
  verified: boolean;
}

const VENDORED_SKILLS = [
  "resume-ats-optimizer",
  "tailored-resume-generator",
  "cover-letter-generator",
] as const;

export default function ChatPage() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Attachments staged for the next user message.
  const [attachBaseResume, setAttachBaseResume] = useState(false);
  const [attachedJobs, setAttachedJobs] = useState<Job[]>([]);
  const [attachedClaims, setAttachedClaims] = useState<Claim[]>([]);
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const [claimsPickerOpen, setClaimsPickerOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshThreads = useCallback(async () => {
    const list = await chatApi.listThreads();
    setThreads(list);
    return list;
  }, []);

  useEffect(() => {
    refreshThreads().catch((err) =>
      toast({ title: "Couldn't load chats", description: (err as Error).message, variant: "destructive" }),
    );
  }, [refreshThreads]);

  const openThread = useCallback(async (thread: ChatThread) => {
    setActiveThread(thread);
    setLoadingMessages(true);
    try {
      const msgs = await chatApi.listMessages(thread.id);
      setMessages(msgs);
    } catch (err) {
      toast({ title: "Couldn't load messages", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const stream = useChatStream({
    onDone: async () => {
      if (activeThread) {
        const msgs = await chatApi.listMessages(activeThread.id);
        setMessages(msgs);
      }
      refreshThreads();
    },
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, stream.state.text]);

  async function handleNewChat() {
    const created = await chatApi.createThread({});
    await refreshThreads();
    openThread(created);
  }

  async function handleDeleteThread(thread: ChatThread) {
    if (!window.confirm(`Delete "${thread.title}"?`)) return;
    await chatApi.deleteThread(thread.id);
    if (activeThread?.id === thread.id) {
      setActiveThread(null);
      setMessages([]);
    }
    refreshThreads();
  }

  function clearStagedAttachments() {
    setAttachBaseResume(false);
    setAttachedJobs([]);
    setAttachedClaims([]);
  }

  async function buildAttachmentsPayload(): Promise<ChatAttachment[]> {
    const out: ChatAttachment[] = [];
    if (attachBaseResume) {
      try {
        const br = await smartApi<BaseResume | undefined>("/base-resume");
        if (br?.contentText) {
          out.push({
            kind: "base_resume",
            refId: br.id,
            snapshot: { contentText: br.contentText, capturedAt: new Date().toISOString() },
          });
        }
      } catch (err) {
        toast({
          title: "Couldn't attach base resume",
          description: (err as Error).message,
          variant: "destructive",
        });
      }
    }
    for (const job of attachedJobs) {
      out.push({
        kind: "job",
        refId: job.id,
        snapshot: {
          title: job.title,
          company: job.company ?? undefined,
          location: job.location ?? undefined,
          jdText: job.description ?? "",
        },
      });
    }
    if (attachedClaims.length > 0) {
      out.push({
        kind: "claims",
        snapshot: {
          claims: attachedClaims.map((c) => ({ text: c.text, verified: c.verified })),
        },
      });
    }
    return out;
  }

  async function handleSend() {
    if (!activeThread || !input.trim() || stream.state.active) return;
    const text = input.trim();
    const attachments = await buildAttachmentsPayload();
    setInput("");
    clearStagedAttachments();
    setMessages((prev) => [
      ...prev,
      {
        id: -Date.now(),
        conversationId: activeThread.id,
        role: "user",
        content: text,
        attachments,
        runId: null,
        promptVersionId: null,
        modelName: null,
        promptTokens: null,
        completionTokens: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    await stream.send(activeThread.id, text, attachments);
  }

  async function handleFeedback(message: ChatMessage, outcome: "approved" | "rejected") {
    try {
      await chatApi.postFeedback(message.id, outcome);
      toast({ title: outcome === "approved" ? "Thanks — marked helpful" : "Marked unhelpful" });
    } catch (err) {
      toast({ title: "Feedback not saved", description: (err as Error).message, variant: "destructive" });
    }
  }

  const stagedAttachmentCount =
    (attachBaseResume ? 1 : 0) + attachedJobs.length + (attachedClaims.length > 0 ? 1 : 0);

  return (
    <div
      className="page fade-up"
      style={{
        maxWidth: 1280,
        padding: "20px 24px 24px",
        height: "calc(100vh - 56px)",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <div>
          <h1 className="h-display">
            Chat <em>· copilot</em>
          </h1>
          <div className="dim" style={{ fontSize: 13, marginTop: 6 }}>
            Attach a job, your base resume, or claims. Citations resolve to your ledger.
          </div>
        </div>
        <button className="btn primary" onClick={handleNewChat}>
          <Icon name="plus" size={13} />
          New thread
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr 280px",
          gap: 14,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* ── Threads rail ────────────────────────────────────────── */}
        <ThreadRail
          threads={threads}
          activeId={activeThread?.id ?? null}
          onPick={openThread}
          onDelete={handleDeleteThread}
        />

        {/* ── Conversation pane ───────────────────────────────────── */}
        <div
          className="quiet-card"
          style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}
        >
          {activeThread ? (
            <>
              <ConversationHeader thread={activeThread} />

              <div
                ref={scrollRef}
                className="quiet-scroll"
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "14px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                }}
              >
                {loadingMessages && (
                  <div className="dim" style={{ display: "flex", justifyContent: "center", padding: 20 }}>
                    Loading…
                  </div>
                )}
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} onFeedback={handleFeedback} />
                ))}
                {stream.state.active && (
                  <StreamingBubble text={stream.state.text} />
                )}
                {stream.state.error && (
                  <div
                    style={{
                      alignSelf: "center",
                      padding: "8px 12px",
                      background: "var(--danger-bg)",
                      color: "var(--danger)",
                      border: "1px solid oklch(0.86 0.07 25)",
                      borderRadius: "var(--r-sm)",
                      fontSize: 12,
                    }}
                  >
                    {stream.state.error}
                  </div>
                )}
              </div>

              <Composer
                input={input}
                setInput={setInput}
                onSend={handleSend}
                onStop={stream.stop}
                streaming={stream.state.active}
                stagedCount={stagedAttachmentCount}
                attachBaseResume={attachBaseResume}
                setAttachBaseResume={setAttachBaseResume}
                attachedJobs={attachedJobs}
                setAttachedJobs={setAttachedJobs}
                attachedClaims={attachedClaims}
                setAttachedClaims={setAttachedClaims}
                onOpenJobPicker={() => setJobPickerOpen(true)}
                onOpenClaimsPicker={() => setClaimsPickerOpen(true)}
              />
            </>
          ) : (
            <EmptyState onNew={handleNewChat} />
          )}
        </div>

        {/* ── Context rail ────────────────────────────────────────── */}
        <ContextRail
          attachBaseResume={attachBaseResume}
          attachedJobs={attachedJobs}
          attachedClaims={attachedClaims}
        />
      </div>

      {jobPickerOpen && (
        <JobPickerDialog
          attached={attachedJobs}
          setAttached={setAttachedJobs}
          onClose={() => setJobPickerOpen(false)}
        />
      )}
      {claimsPickerOpen && (
        <ClaimsPickerDialog
          attached={attachedClaims}
          setAttached={setAttachedClaims}
          onClose={() => setClaimsPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ── Components ───────────────────────────────────────────────────────────

function ConversationHeader({ thread }: { thread: ChatThread }) {
  return (
    <div className="quiet-card-header">
      <div style={{ minWidth: 0 }}>
        <div className="eyebrow" style={{ marginBottom: 2 }}>
          thread #{thread.id} · scope: {thread.modelScope}
        </div>
        <h2 className="quiet-card-title">{thread.title}</h2>
      </div>
    </div>
  );
}

function ThreadRail({
  threads,
  activeId,
  onPick,
  onDelete,
}: {
  threads: ChatThread[];
  activeId: number | null;
  onPick: (t: ChatThread) => void;
  onDelete: (t: ChatThread) => void;
}) {
  return (
    <div className="quiet-card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="quiet-card-header" style={{ padding: "10px 14px" }}>
        <span className="label">Threads</span>
        <span className="dim mono" style={{ fontSize: 11 }}>
          {threads.length}
        </span>
      </div>
      <div className="quiet-scroll" style={{ flex: 1, overflowY: "auto" }}>
        {threads.length === 0 && (
          <div className="dim" style={{ padding: 16, fontSize: 12 }}>
            No chats yet. Click "New thread" to start.
          </div>
        )}
        {threads.map((t) => {
          const active = t.id === activeId;
          return (
            <div
              key={t.id}
              onClick={() => onPick(t)}
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid var(--line-soft)",
                cursor: "pointer",
                background: active ? "var(--paper-2)" : "transparent",
                borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                position: "relative",
              }}
              className="group"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span
                  className="dim mono"
                  style={{
                    fontSize: 10.5,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {t.modelScope}
                </span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  color: "var(--ink)",
                  lineHeight: 1.4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {t.title}
              </div>
              <div className="dim mono" style={{ fontSize: 11, marginTop: 4 }}>
                {new Date(t.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
              <button
                type="button"
                aria-label="Delete thread"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(t);
                }}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  border: "none",
                  background: "transparent",
                  color: "var(--ink-4)",
                  opacity: 0,
                  cursor: "pointer",
                  padding: 2,
                  borderRadius: 4,
                  transition: "opacity 0.12s",
                }}
                className="thread-delete"
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          );
        })}
      </div>
      <style>{`
        .group:hover .thread-delete { opacity: 1 !important; }
      `}</style>
    </div>
  );
}

function MessageBubble({
  message,
  onFeedback,
}: {
  message: ChatMessage;
  onFeedback: (m: ChatMessage, outcome: "approved" | "rejected") => void;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div
        style={{
          alignSelf: "flex-end",
          maxWidth: "75%",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          alignItems: "flex-end",
        }}
      >
        {message.attachments.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {message.attachments.map((a, i) => (
              <AttachChip
                key={i}
                icon={a.kind === "base_resume" ? "resume" : a.kind === "job" ? "briefcase" : "shield"}
                label={attachmentLabel(a)}
              />
            ))}
          </div>
        )}
        <div
          style={{
            background: "var(--ink)",
            color: "var(--paper)",
            padding: "10px 14px",
            borderRadius: 12,
            fontSize: 13.5,
            lineHeight: 1.55,
            borderBottomRightRadius: 4,
            whiteSpace: "pre-wrap",
          }}
        >
          {message.content}
        </div>
        <span className="dim mono" style={{ fontSize: 10.5 }}>
          {new Date(message.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </span>
      </div>
    );
  }

  return (
    <div style={{ alignSelf: "flex-start", maxWidth: "90%", display: "flex", gap: 10 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "var(--accent-bg)",
          color: "var(--accent-ink)",
          display: "grid",
          placeItems: "center",
          marginTop: 2,
          flexShrink: 0,
        }}
      >
        <Icon name="spark" size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            background: "var(--paper-2)",
            padding: "12px 16px",
            borderRadius: 12,
            borderBottomLeftRadius: 4,
            fontSize: 13.5,
            lineHeight: 1.6,
            color: "var(--ink)",
            whiteSpace: "pre-wrap",
            border: "1px solid var(--line-soft)",
          }}
        >
          {message.content}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 6,
            fontSize: 11,
            color: "var(--ink-4)",
          }}
        >
          <span className="mono">
            {new Date(message.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </span>
          {message.modelName && (
            <span>
              · <span className="mono">{message.modelName}</span>
            </span>
          )}
          {message.completionTokens != null && (
            <span>
              · <span className="mono">{message.completionTokens} tok</span>
            </span>
          )}
          <span style={{ flex: 1 }} />
          {message.runId && (
            <>
              <button
                type="button"
                onClick={() => onFeedback(message, "approved")}
                aria-label="Helpful"
                className="btn ghost"
                style={{ padding: "2px 6px", fontSize: 11, color: "var(--ink-3)" }}
              >
                <Icon name="check" size={12} />
              </button>
              <button
                type="button"
                onClick={() => onFeedback(message, "rejected")}
                aria-label="Not helpful"
                className="btn ghost"
                style={{ padding: "2px 6px", fontSize: 11, color: "var(--ink-3)" }}
              >
                <Icon name="x" size={12} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StreamingBubble({ text }: { text: string }) {
  return (
    <div style={{ alignSelf: "flex-start", maxWidth: "90%", display: "flex", gap: 10 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "var(--accent-bg)",
          color: "var(--accent-ink)",
          display: "grid",
          placeItems: "center",
          marginTop: 2,
          flexShrink: 0,
        }}
      >
        <Icon name="spark" size={14} />
      </div>
      <div
        style={{
          background: "var(--paper-2)",
          padding: "12px 16px",
          borderRadius: 12,
          borderBottomLeftRadius: 4,
          fontSize: 13.5,
          lineHeight: 1.6,
          color: "var(--ink)",
          whiteSpace: "pre-wrap",
          border: "1px solid var(--line-soft)",
          flex: 1,
        }}
      >
        {text || <span className="dim italic-display">thinking…</span>}
        {text && (
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 14,
              background: "var(--accent)",
              marginLeft: 2,
              verticalAlign: "middle",
              animation: "blink 1s steps(2) infinite",
            }}
          />
        )}
      </div>
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}

function Composer({
  input,
  setInput,
  onSend,
  onStop,
  streaming,
  stagedCount,
  attachBaseResume,
  setAttachBaseResume,
  attachedJobs,
  setAttachedJobs,
  attachedClaims,
  setAttachedClaims,
  onOpenJobPicker,
  onOpenClaimsPicker,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  stagedCount: number;
  attachBaseResume: boolean;
  setAttachBaseResume: (v: boolean) => void;
  attachedJobs: Job[];
  setAttachedJobs: (v: Job[]) => void;
  attachedClaims: Claim[];
  setAttachedClaims: (v: Claim[]) => void;
  onOpenJobPicker: () => void;
  onOpenClaimsPicker: () => void;
}) {
  const sendDisabled = !input.trim() || streaming;
  return (
    <div style={{ borderTop: "1px solid var(--line)", padding: 14 }}>
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 12,
          background: "var(--card)",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {attachBaseResume && (
            <AttachChip
              icon="resume"
              label="Base resume"
              onRemove={() => setAttachBaseResume(false)}
            />
          )}
          {attachedJobs.map((j) => (
            <AttachChip
              key={j.id}
              icon="briefcase"
              label={j.title}
              onRemove={() => setAttachedJobs(attachedJobs.filter((x) => x.id !== j.id))}
            />
          ))}
          {attachedClaims.length > 0 && (
            <AttachChip
              icon="shield"
              label={`${attachedClaims.length} claim${attachedClaims.length === 1 ? "" : "s"}`}
              onRemove={() => setAttachedClaims([])}
            />
          )}
          <button
            type="button"
            className="btn ghost"
            style={{ padding: "3px 9px", fontSize: 11.5 }}
            onClick={() => setAttachBaseResume(!attachBaseResume)}
          >
            <Icon name="resume" size={11} /> {attachBaseResume ? "Remove resume" : "Resume"}
          </button>
          <button
            type="button"
            className="btn ghost"
            style={{ padding: "3px 9px", fontSize: 11.5 }}
            onClick={onOpenJobPicker}
          >
            <Icon name="briefcase" size={11} /> Job
          </button>
          <button
            type="button"
            className="btn ghost"
            style={{ padding: "3px 9px", fontSize: 11.5 }}
            onClick={onOpenClaimsPicker}
          >
            <Icon name="shield" size={11} /> Claims
          </button>
        </div>
        <textarea
          placeholder="Ask anything. Drag in attachments above."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          style={{
            border: "none",
            outline: "none",
            resize: "none",
            minHeight: 56,
            fontFamily: "var(--font-ui)",
            fontSize: 13.5,
            color: "var(--ink)",
            background: "transparent",
            padding: 0,
            lineHeight: 1.55,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="dim mono" style={{ fontSize: 11 }}>
            chat scope · {stagedCount} attached
          </span>
          {streaming ? (
            <button type="button" className="btn" onClick={onStop} style={{ fontSize: 12 }}>
              <Icon name="x" size={12} />
              Stop
            </button>
          ) : (
            <button
              type="button"
              className="btn accent"
              onClick={onSend}
              disabled={sendDisabled}
              style={{ fontSize: 12, opacity: sendDisabled ? 0.5 : 1 }}
            >
              <Icon name="send" size={12} />
              Send
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  padding: "1px 5px",
                  borderRadius: 5,
                  background: "rgba(255,255,255,0.18)",
                  color: "rgba(255,255,255,0.85)",
                  marginLeft: 4,
                }}
              >
                ⏎
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AttachChip({
  icon,
  label,
  onRemove,
}: {
  icon: "briefcase" | "resume" | "shield";
  label: string;
  onRemove?: () => void;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        background: "var(--accent-bg)",
        color: "var(--accent-ink)",
        border: "1px solid var(--accent-line)",
        borderRadius: 99,
        fontSize: 11.5,
        fontWeight: 500,
      }}
    >
      <Icon name={icon} size={11} />
      <span
        style={{
          maxWidth: 180,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove attachment"
          style={{
            border: "none",
            background: "transparent",
            color: "var(--accent-ink)",
            display: "grid",
            placeItems: "center",
            padding: 0,
            cursor: "pointer",
          }}
        >
          <Icon name="x" size={10} />
        </button>
      )}
    </span>
  );
}

function ContextRail({
  attachBaseResume,
  attachedJobs,
  attachedClaims,
}: {
  attachBaseResume: boolean;
  attachedJobs: Job[];
  attachedClaims: Claim[];
}) {
  const anyAttached = attachBaseResume || attachedJobs.length > 0 || attachedClaims.length > 0;
  return (
    <aside
      className="quiet-scroll"
      style={{ display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", minHeight: 0 }}
    >
      <div className="quiet-card">
        <div className="quiet-card-header">
          <h2 className="quiet-card-title" style={{ fontSize: 15 }}>
            Attached context
          </h2>
        </div>
        <div
          className="quiet-card-body"
          style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}
        >
          {!anyAttached && (
            <div className="dim" style={{ fontSize: 12, padding: 8 }}>
              Nothing attached yet. Use the buttons in the composer to pull in your base
              resume, a saved job, or claims from the ledger.
            </div>
          )}
          {attachBaseResume && (
            <ContextBlock icon="resume" label="Base resume" title="Current version" meta="Captured on send" />
          )}
          {attachedJobs.map((j) => (
            <ContextBlock
              key={j.id}
              icon="briefcase"
              label="Job"
              title={j.title}
              meta={[j.company, j.location].filter(Boolean).join(" · ")}
            />
          ))}
          {attachedClaims.length > 0 && (
            <ContextBlock
              icon="shield"
              label="Claims"
              title={`${attachedClaims.length} claim${attachedClaims.length === 1 ? "" : "s"}`}
              meta={`${attachedClaims.filter((c) => c.verified).length} verified`}
            />
          )}
        </div>
      </div>

      <div className="quiet-card flat">
        <div
          className="quiet-card-body"
          style={{ padding: 14, fontSize: 12.5, lineHeight: 1.55 }}
        >
          <div className="label" style={{ marginBottom: 8 }}>
            Vendored skills
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {VENDORED_SKILLS.map((s) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--accent)", display: "inline-grid", placeItems: "center" }}>
                  <Icon name="spark" size={12} />
                </span>
                <span className="mono" style={{ fontSize: 11.5 }}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="quiet-card flat">
        <div
          className="quiet-card-body"
          style={{
            padding: 14,
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--ink-3)",
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
          }}
        >
          <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }}>
            <Icon name="shield" size={12} />
          </span>
          <span>
            Claims cited in this thread resolve to your verified ledger. Unverified claims
            are flagged and excluded from generated output.
          </span>
        </div>
      </div>
    </aside>
  );
}

function ContextBlock({
  icon,
  label,
  title,
  meta,
}: {
  icon: "briefcase" | "resume" | "shield";
  label: string;
  title: string;
  meta?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 8,
        background: "var(--paper-2)",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          background: "var(--accent-bg)",
          color: "var(--accent-ink)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={13} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="label" style={{ fontSize: 10, marginBottom: 2 }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        {meta && (
          <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
            {meta}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 40,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 11,
          background: "var(--accent-bg)",
          color: "var(--accent-ink)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon name="chat" size={20} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div className="h-section" style={{ marginBottom: 4 }}>
          No thread selected
        </div>
        <div className="dim" style={{ fontSize: 13, maxWidth: 320 }}>
          Pick a conversation from the rail, or start a fresh one to ask about a job,
          tailor a resume, or draft a cover letter.
        </div>
      </div>
      <button type="button" className="btn primary" onClick={onNew}>
        <Icon name="plus" size={13} />
        New thread
      </button>
    </div>
  );
}

function attachmentLabel(a: ChatAttachment): string {
  switch (a.kind) {
    case "base_resume":
      return "Base resume";
    case "job": {
      const s = a.snapshot as { title?: string };
      return s.title ? `Job · ${s.title}` : "Job";
    }
    case "claims": {
      const s = a.snapshot as { claims?: unknown[] };
      return `${s.claims?.length ?? 0} claim${s.claims?.length === 1 ? "" : "s"}`;
    }
  }
}

// ── Pickers ─────────────────────────────────────────────────────────────

function JobPickerDialog({
  attached,
  setAttached,
  onClose,
}: {
  attached: Job[];
  setAttached: (v: Job[]) => void;
  onClose: () => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    smartApi<Job[]>("/jobs")
      .then((list) => setJobs(list))
      .catch((err) =>
        toast({ title: "Couldn't load jobs", description: (err as Error).message, variant: "destructive" }),
      )
      .finally(() => setLoading(false));
  }, []);

  function toggle(job: Job) {
    const present = attached.some((j) => j.id === job.id);
    setAttached(present ? attached.filter((j) => j.id !== job.id) : [...attached, job]);
  }

  return (
    <PickerSheet title="Attach jobs" onClose={onClose} loading={loading} empty={!loading && jobs.length === 0}>
      {jobs.map((j) => {
        const checked = attached.some((a) => a.id === j.id);
        return (
          <button
            type="button"
            key={j.id}
            onClick={() => toggle(j)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              width: "100%",
              textAlign: "left",
              border: "none",
              background: checked ? "var(--accent-bg)" : "transparent",
              color: "var(--ink)",
              borderRadius: "var(--r-sm)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <span style={{ color: checked ? "var(--accent)" : "var(--ink-4)" }}>
              <Icon name={checked ? "check" : "plus"} size={13} />
            </span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {j.title}
            </span>
            {j.company && (
              <span className="dim mono" style={{ fontSize: 11 }}>
                {j.company}
              </span>
            )}
          </button>
        );
      })}
    </PickerSheet>
  );
}

function ClaimsPickerDialog({
  attached,
  setAttached,
  onClose,
}: {
  attached: Claim[];
  setAttached: (v: Claim[]) => void;
  onClose: () => void;
}) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    smartApi<Claim[]>("/claims")
      .then((list) => setClaims(list))
      .catch((err) =>
        toast({ title: "Couldn't load claims", description: (err as Error).message, variant: "destructive" }),
      )
      .finally(() => setLoading(false));
  }, []);

  function toggle(claim: Claim) {
    const present = attached.some((c) => c.id === claim.id);
    setAttached(present ? attached.filter((c) => c.id !== claim.id) : [...attached, claim]);
  }

  return (
    <PickerSheet
      title="Attach claims"
      onClose={onClose}
      loading={loading}
      empty={!loading && claims.length === 0}
    >
      {claims.map((c) => {
        const checked = attached.some((a) => a.id === c.id);
        return (
          <button
            type="button"
            key={c.id}
            onClick={() => toggle(c)}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "8px 12px",
              width: "100%",
              textAlign: "left",
              border: "none",
              background: checked ? "var(--accent-bg)" : "transparent",
              color: "var(--ink)",
              borderRadius: "var(--r-sm)",
              fontSize: 13,
              cursor: "pointer",
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: checked ? "var(--accent)" : "var(--ink-4)", marginTop: 2 }}>
              <Icon name={checked ? "check" : "plus"} size={13} />
            </span>
            <span style={{ flex: 1 }}>
              {c.text}
              {!c.verified && (
                <span className="chip warn dot" style={{ marginLeft: 8, fontSize: 10.5 }}>
                  unverified
                </span>
              )}
            </span>
          </button>
        );
      })}
    </PickerSheet>
  );
}

function PickerSheet({
  title,
  onClose,
  loading,
  empty,
  children,
}: {
  title: string;
  onClose: () => void;
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(40, 35, 30, 0.18)",
        display: "grid",
        placeItems: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="quiet-card"
        style={{
          width: "min(520px, 90vw)",
          maxHeight: "min(640px, 80vh)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "var(--shadow-pop)",
        }}
      >
        <div className="quiet-card-header">
          <h2 className="quiet-card-title">{title}</h2>
          <button type="button" className="btn ghost" onClick={onClose} aria-label="Close">
            <Icon name="x" size={13} />
          </button>
        </div>
        <div className="quiet-scroll" style={{ flex: 1, overflowY: "auto", padding: 6 }}>
          {loading && <div className="dim" style={{ padding: 24, textAlign: "center" }}>Loading…</div>}
          {empty && (
            <div className="dim" style={{ padding: 24, textAlign: "center", fontSize: 13 }}>
              Nothing to attach yet.
            </div>
          )}
          {!loading && !empty && children}
        </div>
        <div
          style={{
            padding: 12,
            borderTop: "1px solid var(--line)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button type="button" className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
