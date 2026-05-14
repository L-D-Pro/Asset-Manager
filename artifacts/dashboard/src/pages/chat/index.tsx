import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { smartApi } from "@/lib/smart-ai-api";
import { toast } from "@/hooks/use-toast";
import {
  ArrowUp,
  CheckSquare,
  FileText,
  Loader2,
  MessageSquarePlus,
  Plus,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";

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

  // Auto-scroll on new content.
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
        toast({ title: "Couldn't attach base resume", description: (err as Error).message, variant: "destructive" });
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
    // Optimistically render the user's turn until the stream's done event
    // reloads from the server.
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

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden">
      <ThreadRail
        threads={threads}
        activeId={activeThread?.id ?? null}
        onPick={openThread}
        onNew={handleNewChat}
        onDelete={handleDeleteThread}
      />

      <div className="flex flex-1 flex-col bg-[hsl(var(--background))]">
        {activeThread ? (
          <>
            <header className="border-b border-[hsl(var(--border))] px-6 py-3">
              <div className="text-sm font-semibold">{activeThread.title}</div>
              <div className="text-xs text-[hsl(var(--muted))]">scope: {activeThread.modelScope}</div>
            </header>

            <ScrollArea className="flex-1">
              <div ref={scrollRef} className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-6">
                {loadingMessages && <Loader2 className="mx-auto h-4 w-4 animate-spin opacity-60" />}
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} onFeedback={handleFeedback} />
                ))}
                {stream.state.active && stream.state.text.length === 0 && (
                  <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted))]">
                    <Loader2 className="h-3 w-3 animate-spin" /> thinking…
                  </div>
                )}
                {stream.state.active && stream.state.text.length > 0 && (
                  <Card className="max-w-full self-start whitespace-pre-wrap p-4 text-sm">
                    {stream.state.text}
                    <span className="ml-1 inline-block h-3 w-2 animate-pulse bg-[hsl(var(--primary))] align-middle" />
                  </Card>
                )}
                {stream.state.error && (
                  <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500">
                    {stream.state.error}
                  </div>
                )}
              </div>
            </ScrollArea>

            <Composer
              input={input}
              setInput={setInput}
              onSend={handleSend}
              onStop={stream.stop}
              streaming={stream.state.active}
              attachBaseResume={attachBaseResume}
              setAttachBaseResume={setAttachBaseResume}
              attachedJobs={attachedJobs}
              setAttachedJobs={setAttachedJobs}
              attachedClaims={attachedClaims}
              setAttachedClaims={setAttachedClaims}
            />
          </>
        ) : (
          <EmptyState onNew={handleNewChat} />
        )}
      </div>
    </div>
  );
}

// ─── Thread rail ────────────────────────────────────────────────────────────

function ThreadRail(props: {
  threads: ChatThread[];
  activeId: number | null;
  onPick: (t: ChatThread) => void;
  onNew: () => void;
  onDelete: (t: ChatThread) => void;
}) {
  return (
    <aside className="flex w-60 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="border-b border-[hsl(var(--border))] p-3">
        <Button onClick={props.onNew} className="w-full" size="sm" variant="primary">
          <MessageSquarePlus className="h-3.5 w-3.5" /> New chat
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <ul className="space-y-0.5 p-2">
          {props.threads.length === 0 && (
            <li className="px-2 py-3 text-xs text-[hsl(var(--muted))]">No chats yet.</li>
          )}
          {props.threads.map((t) => {
            const active = t.id === props.activeId;
            return (
              <li key={t.id} className="group flex items-center gap-1">
                <button
                  className={
                    "flex-1 truncate rounded-md px-2 py-1.5 text-left text-xs " +
                    (active
                      ? "bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--foreground))]"
                      : "text-[hsl(var(--muted))] hover:bg-[hsl(var(--foreground)/0.04)]")
                  }
                  onClick={() => props.onPick(t)}
                >
                  {t.title}
                </button>
                <button
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => props.onDelete(t)}
                  aria-label="Delete chat"
                >
                  <Trash2 className="h-3.5 w-3.5 text-[hsl(var(--muted))] hover:text-red-500" />
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </aside>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState(props: { onNew: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <MessageSquarePlus className="h-8 w-8 opacity-60" />
      <div className="text-sm text-[hsl(var(--muted))]">Start a new chat to begin.</div>
      <Button onClick={props.onNew} size="sm" variant="primary">
        <Plus className="h-3.5 w-3.5" /> New chat
      </Button>
    </div>
  );
}

// ─── Message bubble ─────────────────────────────────────────────────────────

function MessageBubble(props: {
  message: ChatMessage;
  onFeedback: (m: ChatMessage, outcome: "approved" | "rejected") => void;
}) {
  const m = props.message;
  const isUser = m.role === "user";
  const attachmentLabels = useMemo(() => {
    return m.attachments.map((a) => {
      switch (a.kind) {
        case "base_resume":
          return "base resume";
        case "job": {
          const s = a.snapshot as { title?: string };
          return s.title ? `job: ${s.title}` : "job";
        }
        case "claims": {
          const s = a.snapshot as { claims?: unknown[] };
          return `${s.claims?.length ?? 0} claim(s)`;
        }
      }
    });
  }, [m.attachments]);

  return (
    <Card
      className={
        "max-w-full whitespace-pre-wrap p-4 text-sm " +
        (isUser
          ? "self-end border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.06)]"
          : "self-start")
      }
    >
      {attachmentLabels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1 text-[10px] uppercase tracking-wider text-[hsl(var(--muted))]">
          {attachmentLabels.map((l, i) => (
            <span key={i} className="rounded-full bg-[hsl(var(--foreground)/0.05)] px-2 py-0.5">
              {l}
            </span>
          ))}
        </div>
      )}
      <div>{m.content}</div>
      {!isUser && m.runId && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[hsl(var(--muted))]">
          <button onClick={() => props.onFeedback(m, "approved")} aria-label="Helpful">
            <ThumbsUp className="h-3.5 w-3.5 hover:text-green-500" />
          </button>
          <button onClick={() => props.onFeedback(m, "rejected")} aria-label="Not helpful">
            <ThumbsDown className="h-3.5 w-3.5 hover:text-red-500" />
          </button>
          {m.modelName && <span className="ml-auto">{m.modelName}</span>}
        </div>
      )}
    </Card>
  );
}

// ─── Composer + attachment chips ───────────────────────────────────────────

function Composer(props: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  attachBaseResume: boolean;
  setAttachBaseResume: (v: boolean) => void;
  attachedJobs: Job[];
  setAttachedJobs: (v: Job[]) => void;
  attachedClaims: Claim[];
  setAttachedClaims: (v: Claim[]) => void;
}) {
  const sendDisabled = !props.input.trim() || props.streaming;

  return (
    <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
      <div className="mx-auto max-w-3xl space-y-2">
        <AttachmentChips
          attachBaseResume={props.attachBaseResume}
          setAttachBaseResume={props.setAttachBaseResume}
          attachedJobs={props.attachedJobs}
          setAttachedJobs={props.setAttachedJobs}
          attachedClaims={props.attachedClaims}
          setAttachedClaims={props.setAttachedClaims}
        />
        <div className="flex items-end gap-2">
          <Textarea
            value={props.input}
            onChange={(e) => props.setInput(e.target.value)}
            placeholder="Ask the resume/cover-letter copilot…"
            className="min-h-[3rem] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                props.onSend();
              }
            }}
            disabled={props.streaming}
          />
          {props.streaming ? (
            <Button onClick={props.onStop} size="icon" variant="outline" aria-label="Stop">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={props.onSend} size="icon" variant="primary" disabled={sendDisabled} aria-label="Send">
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function AttachmentChips(props: {
  attachBaseResume: boolean;
  setAttachBaseResume: (v: boolean) => void;
  attachedJobs: Job[];
  setAttachedJobs: (v: Job[]) => void;
  attachedClaims: Claim[];
  setAttachedClaims: (v: Claim[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant={props.attachBaseResume ? "secondary" : "outline"}
        onClick={() => props.setAttachBaseResume(!props.attachBaseResume)}
      >
        <FileText className="h-3.5 w-3.5" />
        Base resume
        {props.attachBaseResume && <X className="ml-1 h-3 w-3" />}
      </Button>

      <JobPickerDialog attached={props.attachedJobs} setAttached={props.setAttachedJobs} />
      <ClaimsPickerDialog attached={props.attachedClaims} setAttached={props.setAttachedClaims} />
    </div>
  );
}

function JobPickerDialog(props: { attached: Job[]; setAttached: (v: Job[]) => void }) {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    smartApi<Job[]>("/jobs")
      .then((list) => setJobs(list))
      .catch((err) => toast({ title: "Couldn't load jobs", description: (err as Error).message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [open]);

  function toggle(job: Job) {
    const present = props.attached.some((j) => j.id === job.id);
    props.setAttached(present ? props.attached.filter((j) => j.id !== job.id) : [...props.attached, job]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={props.attached.length > 0 ? "secondary" : "outline"}>
          <Plus className="h-3.5 w-3.5" />
          Job{props.attached.length > 0 ? ` (${props.attached.length})` : ""}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Attach jobs</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[24rem]">
          {loading && <Loader2 className="m-4 h-4 w-4 animate-spin" />}
          {!loading && jobs.length === 0 && (
            <div className="p-4 text-sm text-[hsl(var(--muted))]">No saved jobs.</div>
          )}
          <ul className="space-y-1 p-1">
            {jobs.map((j) => {
              const checked = props.attached.some((a) => a.id === j.id);
              return (
                <li key={j.id}>
                  <button
                    className={
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs " +
                      (checked ? "bg-[hsl(var(--primary)/0.12)]" : "hover:bg-[hsl(var(--foreground)/0.04)]")
                    }
                    onClick={() => toggle(j)}
                  >
                    <CheckSquare
                      className={"h-3.5 w-3.5 " + (checked ? "text-[hsl(var(--primary))]" : "opacity-40")}
                    />
                    <span className="truncate">{j.title}</span>
                    {j.company && <span className="text-[hsl(var(--muted))]">· {j.company}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
        <DialogFooter>
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClaimsPickerDialog(props: { attached: Claim[]; setAttached: (v: Claim[]) => void }) {
  const [open, setOpen] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    smartApi<Claim[]>("/claims")
      .then((list) => setClaims(list))
      .catch((err) => toast({ title: "Couldn't load claims", description: (err as Error).message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [open]);

  function toggle(claim: Claim) {
    const present = props.attached.some((c) => c.id === claim.id);
    props.setAttached(present ? props.attached.filter((c) => c.id !== claim.id) : [...props.attached, claim]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={props.attached.length > 0 ? "secondary" : "outline"}>
          <Plus className="h-3.5 w-3.5" />
          Claims{props.attached.length > 0 ? ` (${props.attached.length})` : ""}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Attach claims</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[24rem]">
          {loading && <Loader2 className="m-4 h-4 w-4 animate-spin" />}
          {!loading && claims.length === 0 && (
            <div className="p-4 text-sm text-[hsl(var(--muted))]">No claims in the ledger yet.</div>
          )}
          <ul className="space-y-1 p-1">
            {claims.map((c) => {
              const checked = props.attached.some((a) => a.id === c.id);
              return (
                <li key={c.id}>
                  <button
                    className={
                      "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs " +
                      (checked ? "bg-[hsl(var(--primary)/0.12)]" : "hover:bg-[hsl(var(--foreground)/0.04)]")
                    }
                    onClick={() => toggle(c)}
                  >
                    <CheckSquare
                      className={"mt-0.5 h-3.5 w-3.5 shrink-0 " + (checked ? "text-[hsl(var(--primary))]" : "opacity-40")}
                    />
                    <span>
                      {c.text}
                      {!c.verified && (
                        <span className="ml-2 rounded bg-yellow-500/20 px-1 py-0.5 text-[10px] text-yellow-700">
                          unverified
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
        <DialogFooter>
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
