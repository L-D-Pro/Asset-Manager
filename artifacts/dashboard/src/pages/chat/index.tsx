import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { smartApi } from "@/lib/smart-ai-api";
import { toast } from "@/hooks/use-toast";
import { Plus, X, Sparkles, Check, FileText, Briefcase, Shield, Send, MessageCircle } from "lucide-react";

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
    >
      <div
      >
        <div>
          <h1>
            Chat <em>· copilot</em>
          </h1>
          <div>
            Attach a job, your base resume, or claims. Citations resolve to your ledger.
          </div>
        </div>
        <button onClick={handleNewChat}>
          <Plus size={13} />
          New thread
        </button>
      </div>

      <div
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
        >
          {activeThread ? (
            <>
              <ConversationHeader thread={activeThread} />

              <div
                ref={scrollRef}
              >
                {loadingMessages && (
                  <div>
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
    <div>
      <div>
        <div>
          thread #{thread.id} · scope: {thread.modelScope}
        </div>
        <h2>{thread.title}</h2>
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
    <div>
      <div>
        <span>Threads</span>
        <span>
          {threads.length}
        </span>
      </div>
      <div>
        {threads.length === 0 && (
          <div>
            No chats yet. Click "New thread" to start.
          </div>
        )}
        {threads.map((t) => {
          const active = t.id === activeId;
          return (
            <div
              key={t.id}
              onClick={() => onPick(t)}
            >
              <div>
                <span
                >
                  {t.modelScope}
                </span>
              </div>
              <div
              >
                {t.title}
              </div>
              <div>
                {new Date(t.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
              <button
                type="button"
                aria-label="Delete thread"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(t);
                }}
              >
                <X size={12} />
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
      >
        {message.attachments.length > 0 && (
          <div>
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
        >
          {message.content}
        </div>
        <span>
          {new Date(message.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </span>
      </div>
    );
  }

  return (
    <div>
      <div
      >
        <Sparkles size={14} />
      </div>
      <div>
        <div
        >
          {message.content}
        </div>
        <div
        >
          <span>
            {new Date(message.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </span>
          {message.modelName && (
            <span>
              · <span>{message.modelName}</span>
            </span>
          )}
          {message.completionTokens != null && (
            <span>
              · <span>{message.completionTokens} tok</span>
            </span>
          )}
          <span />
          {message.runId && (
            <>
              <button
                type="button"
                onClick={() => onFeedback(message, "approved")}
                aria-label="Helpful"
              >
                <Check size={12} />
              </button>
              <button
                type="button"
                onClick={() => onFeedback(message, "rejected")}
                aria-label="Not helpful"
              >
                <X size={12} />
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
    <div>
      <div
      >
        <Sparkles size={14} />
      </div>
      <div
      >
        {text || <span>thinking…</span>}
        {text && (
          <span
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
    <div>
      <div
      >
        <div>
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
            onClick={() => setAttachBaseResume(!attachBaseResume)}
          >
            <FileText size={11} /> {attachBaseResume ? "Remove resume" : "Resume"}
          </button>
          <button
            type="button"
            onClick={onOpenJobPicker}
          >
            <Briefcase size={11} /> Job
          </button>
          <button
            type="button"
            onClick={onOpenClaimsPicker}
          >
            <Shield size={11} /> Claims
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
        />
        <div>
          <span>
            chat scope · {stagedCount} attached
          </span>
          {streaming ? (
            <button type="button" onClick={onStop}>
              <X size={12} />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={sendDisabled}
            >
              <Send size={12} />
              Send
              <span
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
  const IconComponent = icon === "briefcase" ? Briefcase : icon === "resume" ? FileText : Shield;
  return (
    <span
    >
      <IconComponent size={11} />
      <span
      >
        {label}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove attachment"
        >
          <X size={10} />
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
    >
      <div>
        <div>
          <h2>
            Attached context
          </h2>
        </div>
        <div
        >
          {!anyAttached && (
            <div>
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

      <div>
        <div
        >
          <div>
            Vendored skills
          </div>
          <div>
            {VENDORED_SKILLS.map((s) => (
              <div key={s}>
                <span>
                  <Sparkles size={12} />
                </span>
                <span>
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div
        >
          <span>
            <Shield size={12} />
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
  const IconComponent = icon === "briefcase" ? Briefcase : icon === "resume" ? FileText : Shield;
  return (
    <div
    >
      <div
      >
        <IconComponent size={13} />
      </div>
      <div>
        <div>
          {label}
        </div>
        <div
        >
          {title}
        </div>
        {meta && (
          <div>
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
    >
      <div
      >
        <MessageCircle size={20} />
      </div>
      <div>
        <div>
          No thread selected
        </div>
        <div>
          Pick a conversation from the rail, or start a fresh one to ask about a job,
          tailor a resume, or draft a cover letter.
        </div>
      </div>
      <button type="button" onClick={onNew}>
        <Plus size={13} />
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
          >
            <span>
              {checked ? <Check size={13} /> : <Plus size={13} />}
            </span>
            <span>
              {j.title}
            </span>
            {j.company && (
              <span>
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
          >
            <span>
              {checked ? <Check size={13} /> : <Plus size={13} />}
            </span>
            <span>
              {c.text}
              {!c.verified && (
                <span>
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
    >
      <div
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>
        <div>
          {loading && <div>Loading…</div>}
          {empty && (
            <div>
              Nothing to attach yet.
            </div>
          )}
          {!loading && !empty && children}
        </div>
        <div
        >
          <button type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
