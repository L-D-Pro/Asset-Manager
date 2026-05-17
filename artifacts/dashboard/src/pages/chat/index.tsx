import { useCallback, useEffect, useRef, useState } from "react";

import { smartApi } from "@/lib/smart-ai-api";
import { toast } from "@/hooks/use-toast";
import { Plus, X, Sparkles, Check, FileText, Briefcase, Shield, Send, MessageCircle, Pencil, Paperclip, ChevronDown, Eye } from "lucide-react";
import { useListAiModelConfigs, usePreviewChatPrompt, type AiModelConfig, type PromptSection } from "@workspace/api-client-react";

import { chatApi, type ChatAttachment, type ChatMessage, type ChatThread } from "./api";
import { useChatStream } from "./use-chat-stream";

interface BaseResume { id: number; contentText: string; label: string; }
interface Job { id: number; title: string; company?: string | null; location?: string | null; description?: string | null; }
interface Claim { id: number; text: string; verified: boolean; }

const VENDORED_SKILLS = ["resume-ats-optimizer", "tailored-resume-generator", "cover-letter-generator"] as const;

export default function ChatPage() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [attachBaseResume, setAttachBaseResume] = useState(false);
  const [attachedJobs, setAttachedJobs] = useState<Job[]>([]);
  const [attachedClaims, setAttachedClaims] = useState<Claim[]>([]);
  const [attachedDocs, setAttachedDocs] = useState<{ filename: string; contentText: string }[]>([]);
  const [jdParseEnabled, setJdParseEnabled] = useState(false);
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const [claimsPickerOpen, setClaimsPickerOpen] = useState(false);
  // selectedConfigId[threadId] = the modelConfigId the user picked for that thread
  const [selectedConfigId, setSelectedConfigId] = useState<Record<number, number>>({});
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const { data: chatConfigs = [] } = useListAiModelConfigs({ taskScope: "chat", isActive: true });

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
    if (activeThread?.id === thread.id) { setActiveThread(null); setMessages([]); }
    refreshThreads();
  }

  function clearStagedAttachments() {
    setAttachBaseResume(false);
    setAttachedJobs([]);
    setAttachedClaims([]);
    setAttachedDocs([]);
  }

  function handleEditMessage(msg: ChatMessage) {
    setInput(msg.content);
    setTimeout(() => composerRef.current?.focus(), 0);
  }

  async function buildAttachmentsPayload(): Promise<ChatAttachment[]> {
    const out: ChatAttachment[] = [];
    if (attachBaseResume) {
      try {
        const br = await smartApi<BaseResume | undefined>("/base-resume");
        if (br?.contentText) {
          out.push({ kind: "base_resume", refId: br.id, snapshot: { contentText: br.contentText, capturedAt: new Date().toISOString() } });
        } else {
          setAttachBaseResume(false);
          toast({ title: "No base resume found", description: "Upload one on the Base Resume page first.", variant: "destructive" });
        }
      } catch (err) {
        toast({ title: "Couldn't attach base resume", description: (err as Error).message, variant: "destructive" });
      }
    }
    for (const job of attachedJobs) {
      out.push({ kind: "job", refId: job.id, snapshot: { title: job.title, company: job.company ?? undefined, location: job.location ?? undefined, jdText: job.description ?? "" } });
    }
    if (attachedClaims.length > 0) {
      out.push({ kind: "claims", snapshot: { claims: attachedClaims.map((c) => ({ text: c.text, verified: c.verified })) } });
    }
    for (const doc of attachedDocs) {
      out.push({ kind: "document", snapshot: { filename: doc.filename, contentText: doc.contentText } });
    }
    return out;
  }

  async function handleSend() {
    if (!activeThread || !input.trim() || stream.state.active) return;
    const text = input.trim();
    const attachments = await buildAttachmentsPayload();
    setInput("");
    clearStagedAttachments();
    setMessages((prev) => [...prev, {
      id: -Date.now(), conversationId: activeThread.id, role: "user", content: text,
      attachments, runId: null, promptVersionId: null, modelName: null,
      promptTokens: null, completionTokens: null, createdAt: new Date().toISOString(),
    }]);
    const modelConfigId = selectedConfigId[activeThread.id];
    await stream.send(activeThread.id, text, attachments, modelConfigId, jdParseEnabled);
  }

  async function handleFeedback(message: ChatMessage, outcome: "approved" | "rejected") {
    try {
      await chatApi.postFeedback(message.id, outcome);
      toast({ title: outcome === "approved" ? "Thanks — marked helpful" : "Marked unhelpful" });
    } catch (err) {
      toast({ title: "Feedback not saved", description: (err as Error).message, variant: "destructive" });
    }
  }

  const stagedCount = (attachBaseResume ? 1 : 0) + attachedJobs.length + (attachedClaims.length > 0 ? 1 : 0) + attachedDocs.length;

  return (
    <div className="page fade-up" style={{ maxWidth: 1320, padding: "20px 32px 0", height: "calc(100% - 20px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, flexShrink: 0 }}>
        <div>
          <h1 className="h-display">Chat <em>· copilot</em></h1>
          <div className="dim" style={{ fontSize: 13, marginTop: 6 }}>
            Attach a job, your base resume, or claims. Citations resolve to your ledger.
          </div>
        </div>
        <button className="btn primary" type="button" onClick={handleNewChat}>
          <Plus size={13} strokeWidth={1.8} /> New thread
          <span className="kbd">&#x2318;N</span>
        </button>
      </div>

      {/* 3-col shell */}
      <div className="chat-shell">
        {/* Threads rail */}
        <div className="card chat-thread-rail">
          <div className="card-h" style={{ padding: "10px 14px" }}>
            <span className="label">Threads</span>
            <span className="dim mono" style={{ fontSize: 11 }}>{threads.length}</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {threads.length === 0 && (
              <div className="dim" style={{ padding: "24px 14px", fontSize: 12.5, textAlign: "center" }}>
                No chats yet. Start a new thread.
              </div>
            )}
            {threads.map((t) => (
              <div key={t.id} className={`chat-thread-item${t.id === activeThread?.id ? " active" : ""}`} onClick={() => openThread(t)}>
                <div className="chat-thread-scope">{t.modelScope}</div>
                <div className="chat-thread-title">{t.title}</div>
                <div className="chat-thread-date">{new Date(t.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                <button type="button" className="chat-thread-del" aria-label="Delete thread" onClick={(e) => { e.stopPropagation(); handleDeleteThread(t); }}>
                  <X size={12} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Conversation */}
        <div className="card chat-convo">
          {activeThread ? (
            <>
              {/* Convo header */}
              <div className="card-h">
                <div>
                  <div className="eyebrow" style={{ marginBottom: 2 }}>thread #{activeThread.id} · scope: {activeThread.modelScope}</div>
                  <h2 className="card-title">{activeThread.title}</h2>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    className={`btn ghost sm${inspectorOpen ? " accent" : ""}`}
                    onClick={() => setInspectorOpen((v) => !v)}
                    title="Inspect the system prompt for this thread"
                  >
                    <Eye size={12} strokeWidth={1.8} /> Inspect
                  </button>
                  {chatConfigs.length > 0 && (
                    <ModelPicker
                      configs={chatConfigs}
                      selectedId={selectedConfigId[activeThread.id]}
                      onChange={(id) => setSelectedConfigId((prev) => ({ ...prev, [activeThread.id]: id }))}
                    />
                  )}
                </div>
              </div>

              {inspectorOpen && <ThreadInspector messages={messages} />}

              {/* Messages */}
              <div ref={scrollRef} className="chat-messages">
                {loadingMessages && (
                  <div className="dim" style={{ fontSize: 13, textAlign: "center", padding: "24px 0" }}>Loading…</div>
                )}
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} onFeedback={handleFeedback} onEdit={handleEditMessage} />
                ))}
                {stream.state.active && <StreamingBubble text={stream.state.text} fallbackModel={stream.state.fallbackModel} />}
                {stream.state.error && (
                  <div className="chip danger" style={{ alignSelf: "center" }}>{stream.state.error}</div>
                )}
              </div>

              {/* Composer */}
              <Composer
                input={input}
                setInput={setInput}
                onSend={handleSend}
                onStop={stream.stop}
                streaming={stream.state.active}
                stagedCount={stagedCount}
                attachBaseResume={attachBaseResume}
                setAttachBaseResume={setAttachBaseResume}
                attachedJobs={attachedJobs}
                setAttachedJobs={setAttachedJobs}
                attachedClaims={attachedClaims}
                setAttachedClaims={setAttachedClaims}
                attachedDocs={attachedDocs}
                setAttachedDocs={setAttachedDocs}
                jdParseEnabled={jdParseEnabled}
                setJdParseEnabled={setJdParseEnabled}
                onOpenJobPicker={() => setJobPickerOpen(true)}
                onOpenClaimsPicker={() => setClaimsPickerOpen(true)}
                textareaRef={composerRef}
              />
            </>
          ) : (
            <EmptyState onNew={handleNewChat} />
          )}
        </div>

        {/* Context rail */}
        <ContextRail
          attachBaseResume={attachBaseResume}
          attachedJobs={attachedJobs}
          attachedClaims={attachedClaims}
        />
      </div>

      {jobPickerOpen && (
        <JobPickerDialog attached={attachedJobs} setAttached={setAttachedJobs} onClose={() => setJobPickerOpen(false)} />
      )}
      {claimsPickerOpen && (
        <ClaimsPickerDialog attached={attachedClaims} setAttached={setAttachedClaims} onClose={() => setClaimsPickerOpen(false)} />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConversationHeader({ thread }: { thread: ChatThread }) {
  return (
    <div className="card-h">
      <div>
        <div className="eyebrow" style={{ marginBottom: 2 }}>thread #{thread.id} · scope: {thread.modelScope}</div>
        <h2 className="card-title">{thread.title}</h2>
      </div>
    </div>
  );
}

function ThreadRail({ threads, activeId, onPick, onDelete }: {
  threads: ChatThread[]; activeId: number | null;
  onPick: (t: ChatThread) => void; onDelete: (t: ChatThread) => void;
}) {
  return (
    <div className="card chat-thread-rail">
      <div className="card-h" style={{ padding: "10px 14px" }}>
        <span className="label">Threads</span>
        <span className="dim mono" style={{ fontSize: 11 }}>{threads.length}</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {threads.length === 0 && (
          <div className="dim" style={{ padding: "24px 14px", fontSize: 12.5, textAlign: "center" }}>No chats yet.</div>
        )}
        {threads.map((t) => (
          <div key={t.id} className={`chat-thread-item${t.id === activeId ? " active" : ""}`} onClick={() => onPick(t)}>
            <div className="chat-thread-scope">{t.modelScope}</div>
            <div className="chat-thread-title">{t.title}</div>
            <div className="chat-thread-date">{new Date(t.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
            <button type="button" className="chat-thread-del" aria-label="Delete" onClick={(e) => { e.stopPropagation(); onDelete(t); }}>
              <X size={12} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message, onFeedback, onEdit }: {
  message: ChatMessage;
  onFeedback: (m: ChatMessage, outcome: "approved" | "rejected") => void;
  onEdit: (m: ChatMessage) => void;
}) {
  const isUser = message.role === "user";
  const time = new Date(message.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  if (isUser) {
    return (
      <div className="msg-user">
        {message.attachments.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {message.attachments.map((a, i) => (
              <AttachChip key={i} icon={a.kind === "base_resume" ? "resume" : a.kind === "job" ? "briefcase" : a.kind === "document" ? "file" : "shield"} label={attachmentLabel(a)} />
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
          <button
            type="button"
            title="Edit and re-send"
            onClick={() => onEdit(message)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "3px 5px", color: "var(--ink-4)", borderRadius: 6, flexShrink: 0, alignSelf: "flex-start", marginTop: 2, opacity: 0 }}
            className="msg-edit-btn"
          >
            <Pencil size={12} strokeWidth={2} />
          </button>
          <div className="msg-user-bubble">{message.content}</div>
        </div>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)", fontWeight: 600 }}>{time}</span>
      </div>
    );
  }

  return (
    <div className="msg-ai">
      <div className="msg-ai-avatar"><Sparkles size={14} strokeWidth={1.8} /></div>
      <div className="msg-ai-body">
        <div className="msg-ai-bubble">{message.content}</div>
        <div className="msg-meta">
          <span>{time}</span>
          {message.modelName && <span>· <span style={{ color: "var(--ink-3)" }}>{message.modelName}</span></span>}
          {message.completionTokens != null && <span>· <span className="mono">{message.completionTokens} tok</span></span>}
          {message.runId && (
            <>
              <span style={{ flex: 1 }} />
              <button type="button" className="btn ghost" style={{ padding: "2px 6px", fontSize: 11 }} title="Helpful" onClick={() => onFeedback(message, "approved")}>👍</button>
              <button type="button" className="btn ghost" style={{ padding: "2px 6px", fontSize: 11 }} title="Not helpful" onClick={() => onFeedback(message, "rejected")}>👎</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StreamingBubble({ text, fallbackModel }: { text: string; fallbackModel: string | null }) {
  return (
    <div className="msg-ai">
      <div className="msg-ai-avatar"><Sparkles size={14} strokeWidth={1.8} /></div>
      <div className="msg-ai-body">
        {fallbackModel && (
          <div className="dim" style={{ fontSize: 11, marginBottom: 6, fontStyle: "italic" }}>
            ↩ switched to fallback: {fallbackModel}
          </div>
        )}
        <div className="msg-ai-bubble">
          {text || <span className="dim" style={{ fontStyle: "italic" }}>thinking…</span>}
          {text && <span className="stream-cursor" />}
        </div>
      </div>
    </div>
  );
}

function ModelPicker({ configs, selectedId, onChange }: {
  configs: AiModelConfig[];
  selectedId: number | undefined;
  onChange: (id: number) => void;
}) {
  const selected = configs.find((c) => c.id === selectedId) ?? configs[0];
  if (!selected) return null;
  const label = selected.modelName.split("/").pop() ?? selected.modelName;
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <select
        value={selected.id}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          appearance: "none", WebkitAppearance: "none",
          background: "var(--paper-2)", border: "1px solid var(--line)",
          borderRadius: 8, padding: "5px 28px 5px 10px",
          fontFamily: "var(--font-mono)", fontSize: 11.5,
          color: "var(--ink-2)", cursor: "pointer",
        }}
        title="Switch model for this thread"
      >
        {configs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.modelName.split("/").pop()} {c.priority !== 1 ? `(p${c.priority})` : ""}
          </option>
        ))}
      </select>
      <ChevronDown size={11} strokeWidth={2} style={{ position: "absolute", right: 8, pointerEvents: "none", color: "var(--ink-4)" }} />
      {selected.id !== configs[0]?.id && (
        <span className="dim" style={{ fontSize: 10, marginLeft: 6, fontStyle: "italic" }}>custom</span>
      )}
    </div>
  );
}

const INSPECTOR_LEVER_COLOR: Record<string, string> = {
  identity: "var(--accent)",
  skill: "var(--accent)",
  best_practices: "var(--warn)",
  attachments: "var(--success)",
};

/**
 * Live per-thread prompt inspector — shows the exact system prompt that would
 * be assembled for this thread's next turn, section-labeled by lever.
 */
function ThreadInspector({ messages }: { messages: ChatMessage[] }) {
  const preview = usePreviewChatPrompt();
  const [sections, setSections] = useState<PromptSection[] | null>(null);

  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  useEffect(() => {
    const sampleMessage = lastUser?.content?.trim() || "Hello";
    preview
      .mutateAsync({
        data: {
          sampleMessage,
          attachments: (lastUser?.attachments ?? []) as never,
        },
      })
      .then((res) => setSections(res as PromptSection[]))
      .catch((err) =>
        toast({ title: "Inspector failed", description: (err as Error).message, variant: "destructive" }),
      );
    // Re-run when the latest user message changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUser?.id]);

  return (
    <div style={{ borderBottom: "1px solid var(--line)", background: "var(--paper-2)", padding: "12px 16px", maxHeight: 320, overflowY: "auto" }}>
      <div className="label" style={{ marginBottom: 8 }}>
        System prompt · what the model reads {preview.isPending && <span className="dim">— rebuilding…</span>}
      </div>
      {sections && sections.length === 0 && (
        <div className="dim" style={{ fontSize: 12 }}>Empty prompt — every lever is off.</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sections?.map((s, i) => (
          <div key={i} style={{ border: "1px solid var(--line-soft)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 8px", background: "var(--card)" }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: INSPECTOR_LEVER_COLOR[s.lever] ?? "var(--ink-4)" }} />
              <span className="mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-3)" }}>{s.lever}</span>
              <span className="dim" style={{ fontSize: 11 }}>{s.label}</span>
            </div>
            <pre style={{ margin: 0, padding: "7px 9px", fontSize: 11, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--font-mono)" }}>
              {s.content}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function Composer({ input, setInput, onSend, onStop, streaming, stagedCount, attachBaseResume, setAttachBaseResume, attachedJobs, setAttachedJobs, attachedClaims, setAttachedClaims, attachedDocs, setAttachedDocs, jdParseEnabled, setJdParseEnabled, onOpenJobPicker, onOpenClaimsPicker, textareaRef }: {
  input: string; setInput: (v: string) => void;
  onSend: () => void; onStop: () => void; streaming: boolean; stagedCount: number;
  attachBaseResume: boolean; setAttachBaseResume: (v: boolean) => void;
  attachedJobs: Job[]; setAttachedJobs: (v: Job[]) => void;
  attachedClaims: Claim[]; setAttachedClaims: (v: Claim[]) => void;
  attachedDocs: { filename: string; contentText: string }[]; setAttachedDocs: (v: { filename: string; contentText: string }[]) => void;
  jdParseEnabled: boolean; setJdParseEnabled: (v: boolean) => void;
  onOpenJobPicker: () => void; onOpenClaimsPicker: () => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

    setUploadingFile(true);
    try {
      if (ext === "txt" || ext === "md") {
        const contentText = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Could not read file"));
          reader.readAsText(file);
        });
        setAttachedDocs([...attachedDocs, { filename: file.name, contentText }]);
      } else {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/chat/parse-document", { method: "POST", body: form, credentials: "include" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          toast({ title: "File not attached", description: (err as { error?: string }).error ?? "Upload failed", variant: "destructive" });
          return;
        }
        const data = await res.json() as { filename: string; contentText: string };
        setAttachedDocs([...attachedDocs, data]);
      }
    } catch (err) {
      toast({ title: "File not attached", description: (err as Error).message, variant: "destructive" });
    } finally {
      setUploadingFile(false);
    }
  }

  const sendDisabled = !input.trim() || streaming;
  return (
    <div className="composer-wrap">
      <div className="composer-box">
        <div className="composer-attach-row">
          {attachBaseResume && (
            <AttachChip icon="resume" label="Base resume" onRemove={() => setAttachBaseResume(false)} />
          )}
          {attachedJobs.map((j) => (
            <AttachChip key={j.id} icon="briefcase" label={j.title} onRemove={() => setAttachedJobs(attachedJobs.filter((x) => x.id !== j.id))} />
          ))}
          {attachedClaims.length > 0 && (
            <AttachChip icon="shield" label={`${attachedClaims.length} claim${attachedClaims.length === 1 ? "" : "s"}`} onRemove={() => setAttachedClaims([])} />
          )}
          {attachedDocs.map((d, i) => (
            <AttachChip key={i} icon="file" label={d.filename} onRemove={() => setAttachedDocs(attachedDocs.filter((_, j) => j !== i))} />
          ))}
          <button type="button" className={`attach-btn${attachBaseResume ? " active" : ""}`} onClick={() => setAttachBaseResume(!attachBaseResume)}>
            <FileText size={11} strokeWidth={1.8} /> Resume
          </button>
          <button type="button" className="attach-btn" onClick={onOpenJobPicker}>
            <Briefcase size={11} strokeWidth={1.8} /> Job
          </button>
          <button type="button" className="attach-btn" onClick={onOpenClaimsPicker}>
            <Shield size={11} strokeWidth={1.8} /> Claims
          </button>
          <button type="button" className="attach-btn" disabled={uploadingFile} onClick={() => fileInputRef.current?.click()}>
            <Paperclip size={11} strokeWidth={1.8} /> {uploadingFile ? "Reading…" : "File"}
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md" style={{ display: "none" }} onChange={handleFileChange} />
        </div>
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          placeholder="Ask anything. Attach a resume, job, claims, or file above."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
          rows={3}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
        />
        <div className="composer-footer">
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={jdParseEnabled}
              onChange={(e) => setJdParseEnabled(e.target.checked)}
              style={{ accentColor: "var(--accent)" }}
            />
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)" }}>JD Parse</span>
          </label>
          <span className="composer-model-info">chat scope · {stagedCount} attached</span>
          {streaming ? (
            <button type="button" className="btn ghost sm" onClick={onStop}>
              <X size={12} strokeWidth={2} /> Stop
            </button>
          ) : (
            <button type="button" className="btn accent sm" onClick={onSend} disabled={sendDisabled}>
              <Send size={12} strokeWidth={1.8} /> Send
              <span className="kbd">⏎</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AttachChip({ icon, label, onRemove }: { icon: "briefcase" | "resume" | "shield" | "file"; label: string; onRemove?: () => void; }) {
  const Icon = icon === "briefcase" ? Briefcase : icon === "resume" ? FileText : icon === "file" ? Paperclip : Shield;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 9px", background: "var(--accent-bg)", color: "var(--accent-ink)",
      border: "1px solid var(--accent-line)", borderRadius: 99,
      fontSize: 11.5, fontWeight: 500,
    }}>
      <Icon size={11} strokeWidth={1.8} />
      <span>{label}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Remove" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "inherit", marginLeft: 2 }}>
          <X size={10} strokeWidth={2} />
        </button>
      )}
    </span>
  );
}

function ContextRail({ attachBaseResume, attachedJobs, attachedClaims }: { attachBaseResume: boolean; attachedJobs: Job[]; attachedClaims: Claim[]; }) {
  const anyAttached = attachBaseResume || attachedJobs.length > 0 || attachedClaims.length > 0;
  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
      <div className="card">
        <div className="card-h"><h2 className="card-title" style={{ fontSize: 15 }}>Attached context</h2></div>
        <div className="card-body" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {!anyAttached && (
            <div className="dim" style={{ fontSize: 12, textAlign: "center", padding: "12px 0" }}>
              Nothing attached. Use the buttons in the composer.
            </div>
          )}
          {attachBaseResume && <ContextBlock icon="resume" label="Base resume" title="Current version" meta="Captured on send" />}
          {attachedJobs.map((j) => (
            <ContextBlock key={j.id} icon="briefcase" label="Job" title={j.title} meta={[j.company, j.location].filter(Boolean).join(" · ")} />
          ))}
          {attachedClaims.length > 0 && (
            <ContextBlock icon="shield" label="Claims" title={`${attachedClaims.length} claim${attachedClaims.length === 1 ? "" : "s"}`} meta={`${attachedClaims.filter((c) => c.verified).length} verified`} />
          )}
        </div>
      </div>

      <div className="card flat">
        <div className="card-body" style={{ padding: 14, fontSize: 12.5, lineHeight: 1.55 }}>
          <div className="label" style={{ marginBottom: 8 }}>Vendored skills</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {VENDORED_SKILLS.map((s) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--accent)" }}><Sparkles size={12} strokeWidth={1.8} /></span>
                <span className="mono" style={{ fontSize: 11.5 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card flat">
        <div className="card-body" style={{ padding: 14, fontSize: 12, lineHeight: 1.5, color: "var(--ink-3)" }}>
          <Shield size={11} strokeWidth={1.8} style={{ display: "inline", verticalAlign: "-1px", marginRight: 5, color: "var(--accent)" }} />
          Claims cited in this thread resolve to your verified ledger. Hover any cite to see the source.
        </div>
      </div>
    </aside>
  );
}

function ContextBlock({ icon, label, title, meta }: { icon: "briefcase" | "resume" | "shield"; label: string; title: string; meta?: string; }) {
  const Icon = icon === "briefcase" ? Briefcase : icon === "resume" ? FileText : Shield;
  return (
    <div className="context-block">
      <div className="context-block-icon"><Icon size={13} strokeWidth={1.8} /></div>
      <div>
        <div className="context-block-label">{label}</div>
        <div className="context-block-title">{title}</div>
        {meta && <div className="context-block-meta">{meta}</div>}
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="chat-empty">
      <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--accent-bg)", border: "1px solid var(--accent-line)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
        <MessageCircle size={22} strokeWidth={1.8} />
      </div>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 18, letterSpacing: "-0.02em", color: "var(--ink)", marginBottom: 6 }}>No thread selected</div>
        <div className="dim" style={{ fontSize: 13, maxWidth: 280, margin: "0 auto" }}>
          Pick a conversation from the rail, or start a fresh one to tailor a resume or draft a cover letter.
        </div>
      </div>
      <button type="button" className="btn primary" onClick={onNew}>
        <Plus size={13} strokeWidth={1.8} /> New thread
      </button>
    </div>
  );
}

function attachmentLabel(a: ChatAttachment): string {
  switch (a.kind) {
    case "base_resume": return "Base resume";
    case "job": return `Job · ${(a.snapshot as { title?: string }).title ?? "—"}`;
    case "claims": return `${(a.snapshot as { claims?: unknown[] }).claims?.length ?? 0} claims`;
    case "document": return (a.snapshot as { filename?: string }).filename ?? "Document";
  }
}

// ── Pickers ────────────────────────────────────────────────────────────────

function JobPickerDialog({ attached, setAttached, onClose }: { attached: Job[]; setAttached: (v: Job[]) => void; onClose: () => void; }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    smartApi<Job[]>("/jobs").then(setJobs).catch((err) =>
      toast({ title: "Couldn't load jobs", description: (err as Error).message, variant: "destructive" })
    ).finally(() => setLoading(false));
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
          <button type="button" key={j.id} className={`row${checked ? " active" : ""}`} style={{ gridTemplateColumns: "20px 1fr", border: "none", borderRadius: 0 }} onClick={() => toggle(j)}>
            <span style={{ color: checked ? "var(--accent)" : "var(--ink-4)" }}>{checked ? <Check size={13} strokeWidth={2} /> : <Plus size={13} strokeWidth={2} />}</span>
            <span style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{j.title}</div>
              {j.company && <div className="dim" style={{ fontSize: 11.5 }}>{j.company}</div>}
            </span>
          </button>
        );
      })}
    </PickerSheet>
  );
}

function ClaimsPickerDialog({ attached, setAttached, onClose }: { attached: Claim[]; setAttached: (v: Claim[]) => void; onClose: () => void; }) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    smartApi<Claim[]>("/claims").then(setClaims).catch((err) =>
      toast({ title: "Couldn't load claims", description: (err as Error).message, variant: "destructive" })
    ).finally(() => setLoading(false));
  }, []);

  function toggle(claim: Claim) {
    const present = attached.some((c) => c.id === claim.id);
    setAttached(present ? attached.filter((c) => c.id !== claim.id) : [...attached, claim]);
  }

  return (
    <PickerSheet title="Attach claims" onClose={onClose} loading={loading} empty={!loading && claims.length === 0}>
      {claims.map((c) => {
        const checked = attached.some((a) => a.id === c.id);
        return (
          <button type="button" key={c.id} className="row" style={{ gridTemplateColumns: "20px 1fr auto", border: "none", borderRadius: 0 }} onClick={() => toggle(c)}>
            <span style={{ color: checked ? "var(--accent)" : "var(--ink-4)" }}>{checked ? <Check size={13} strokeWidth={2} /> : <Plus size={13} strokeWidth={2} />}</span>
            <span style={{ textAlign: "left", fontSize: 13, fontWeight: 600 }}>{c.text}</span>
            {!c.verified && <span className="chip warn" style={{ fontSize: 10 }}>unverified</span>}
          </button>
        );
      })}
    </PickerSheet>
  );
}

function PickerSheet({ title, onClose, loading, empty, children }: { title: string; onClose: () => void; loading: boolean; empty: boolean; children: React.ReactNode; }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center" }} onClick={onClose}>
      <div style={{ width: 420, maxHeight: "70vh", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="card-h">
          <h2 className="card-title">{title}</h2>
          <button type="button" className="settings-x" onClick={onClose} aria-label="Close"><X size={14} strokeWidth={2} /></button>
        </div>
        <div className="row-list" style={{ flex: 1, overflowY: "auto" }}>
          {loading && <div className="dim" style={{ padding: "24px", textAlign: "center", fontSize: 13 }}>Loading…</div>}
          {empty && <div className="dim" style={{ padding: "24px", textAlign: "center", fontSize: 13 }}>Nothing to attach yet.</div>}
          {!loading && !empty && children}
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn primary sm" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
