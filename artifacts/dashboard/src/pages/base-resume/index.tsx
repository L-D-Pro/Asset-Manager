import {
  useListBaseResumeHistory,
  useCreateBaseResume,
  useImportBaseResume,
  useRestoreBaseResumeVersion,
  getListBaseResumeHistoryQueryKey,
} from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ExternalLink, Sparkles, Save, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/api-errors";
import { ScoreRing } from "@/components/quiet/score-ring";

export default function BaseResumePage() {
  const { data: history = [], isLoading: historyLoading } = useListBaseResumeHistory();
  const currentResume = history.find((v) => v.isCurrent);
  const saveResume = useCreateBaseResume();
  const importResume = useImportBaseResume();
  const restoreResume = useRestoreBaseResumeVersion();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    if (currentResume && selectedId === null) {
      setSelectedId(currentResume.id);
    }
  }, [currentResume?.id]);

  useEffect(() => {
    if (editing && currentResume) {
      setEditText(currentResume.contentText ?? "");
    }
  }, [editing, currentResume?.id]);

  const selectedVersion = history.find((v) => v.id === selectedId) ?? currentResume;
  const isCurrent = selectedVersion?.isCurrent ?? false;

  const refreshQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: getListBaseResumeHistoryQueryKey() });
  };

  const handleSave = () => {
    saveResume.mutate(
      { data: { contentText: editText.trim() } },
      {
        onSuccess: async () => {
          setEditing(false);
          await refreshQueries();
          toast({ title: "Base resume saved" });
        },
        onError: (error) =>
          toast({ title: "Failed to save", description: getErrorMessage(error, "Please try again."), variant: "destructive" }),
      },
    );
  };

  const handleRestore = (id: number) => {
    restoreResume.mutate(
      { id },
      {
        onSuccess: async () => {
          await refreshQueries();
          toast({ title: "Restored as new version" });
        },
        onError: (error) =>
          toast({ title: "Failed to restore", description: getErrorMessage(error, "Please try again."), variant: "destructive" }),
      },
    );
  };

  const displayText = selectedVersion?.contentText ?? "";

  return (
    <div className="page fade-up" style={{ maxWidth: 1240 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div className="eyebrow">
            base-resume · {currentResume ? `current is v${currentResume.id} · ${format(new Date(currentResume.createdAt), "MMM d, yyyy")}` : "no current version"}
          </div>
          <h1 className="h-display" style={{ marginTop: 4 }}>Base resume <em>· source of truth</em></h1>
          <div className="dim" style={{ fontSize: 13, marginTop: 6, maxWidth: 580 }}>
            Every tailored resume forks from this. Each save creates an immutable version.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <label className="btn" style={{ cursor: "pointer" }}>
            <ExternalLink size={13} strokeWidth={1.8} /> Import DOCX/PDF
            <input
              type="file"
              accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setUploadFile(f);
                if (!f) return;
                importResume.mutate(
                  { data: { file: f, label: `Imported - ${f.name}` } },
                  {
                    onSuccess: async () => {
                      setUploadFile(null);
                      await refreshQueries();
                      toast({ title: "Resume imported" });
                    },
                    onError: (error) =>
                      toast({ title: "Failed to import", description: getErrorMessage(error, "Upload a DOCX or text-based PDF."), variant: "destructive" }),
                  },
                );
              }}
              data-testid="input-base-resume-upload"
            />
          </label>
          <button className="btn" type="button">
            <Sparkles size={13} strokeWidth={1.8} /> To role profile
          </button>
          {!editing ? (
            <button className="btn primary" type="button" onClick={() => setEditing(true)} data-testid="btn-edit-base-resume">
              <Save size={13} strokeWidth={1.8} /> Edit &amp; save v{(currentResume?.id ?? 0) + 1}
            </button>
          ) : (
            <button className="btn primary" type="button" onClick={handleSave} disabled={saveResume.isPending} data-testid="btn-save-base-resume">
              <Save size={13} strokeWidth={1.8} /> {saveResume.isPending ? "Saving…" : "Save version"}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 22 }}>
        {/* Editor / preview */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="card-h">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 className="card-title">{selectedVersion?.label ?? "No resume yet"}</h2>
              {isCurrent ? (
                <span className="chip success dot">current</span>
              ) : selectedVersion ? (
                <span className="chip ghost">historical</span>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {selectedVersion && !isCurrent && (
                <button
                  className="btn sm"
                  type="button"
                  disabled={restoreResume.isPending}
                  onClick={() => handleRestore(selectedVersion.id)}
                  data-testid={`btn-restore-base-resume-${selectedVersion.id}`}>
                  <Save size={12} strokeWidth={1.8} /> Restore as v{(currentResume?.id ?? 0) + 1}
                </button>
              )}
              <button className="btn ghost sm" type="button">
                <ExternalLink size={12} strokeWidth={1.8} /> Export
              </button>
            </div>
          </div>

          {!currentResume && !historyLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--gold)", fontSize: 12.5, fontWeight: 700, padding: "10px 18px", borderBottom: "1px solid var(--line-soft)" }}>
              <AlertCircle size={13} strokeWidth={1.8} />
              No base resume yet — import or paste your resume to unlock AI tailoring.
            </div>
          )}

          {editing ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              data-testid="textarea-base-resume"
              style={{
                width: "100%", border: "none", outline: "none",
                padding: "30px 48px", minHeight: 560,
                background: "var(--card)",
                fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.65, color: "var(--ink)",
                resize: "vertical", boxSizing: "border-box",
              }}
            />
          ) : (
            <div className="card-body" style={{ padding: "40px 52px", fontFamily: "var(--font-display)", color: "var(--ink)", maxWidth: 760 }}>
              {historyLoading ? (
                <div className="dim" style={{ fontSize: 13 }}>Loading…</div>
              ) : displayText ? (
                <RenderedResume text={displayText} />
              ) : (
                <div className="dim" style={{ fontSize: 13, textAlign: "center", padding: "40px 0" }}>
                  Nothing here yet. Click "Edit &amp; save" to write your resume.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right rail */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Version history */}
          <div className="card">
            <div className="card-h">
              <h2 className="card-title" style={{ fontSize: 15 }}>Version history</h2>
              <span className="dim mono" style={{ fontSize: 11 }}>{history.length}</span>
            </div>
            <div className="row-list" style={{ maxHeight: 400, overflowY: "auto" }}>
              {historyLoading ? (
                <div className="dim" style={{ padding: "24px 18px", textAlign: "center", fontSize: 13 }}>Loading…</div>
              ) : history.length === 0 ? (
                <div className="dim" style={{ padding: "24px 18px", textAlign: "center", fontSize: 13 }}>No saved versions yet.</div>
              ) : (
                history.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => { setSelectedId(v.id); setEditing(false); }}
                    data-testid={`card-base-resume-history-${v.id}`}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--line-soft)",
                      cursor: "pointer",
                      background: selectedId === v.id ? "var(--paper-2)" : "transparent",
                      borderLeft: selectedId === v.id ? "2px solid var(--accent)" : "2px solid transparent",
                    }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 500 }}>v{v.id}</span>
                      {v.isCurrent && <span className="chip success dot" style={{ fontSize: 10.5, padding: "1px 7px" }}>current</span>}
                    </div>
                    <div className="dim" style={{ fontSize: 12.5, marginBottom: 6, fontStyle: "italic", fontFamily: "var(--font-display)" }}>
                      {v.label?.replace(/^v\d+ · /, "") ?? ""}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>
                      <span>{format(new Date(v.createdAt), "MMM d, yyyy")}</span>
                      <span>{(v.contentText ?? "").trim().length.toLocaleString()} chars</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Truth-lock */}
          <div className="card flat">
            <div className="card-body" style={{ padding: 14, fontSize: 12.5, lineHeight: 1.55 }}>
              <div className="label" style={{ marginBottom: 8 }}>Truth-lock connection</div>
              <p style={{ margin: 0, color: "var(--ink-2)" }}>
                When you save, we'll suggest extracting new claims from any added bullets. Approve them into your ledger to make them citable.
              </p>
              <button className="btn sm" type="button" style={{ marginTop: 10 }}>
                <Sparkles size={12} strokeWidth={1.8} /> Extract claims now
              </button>
            </div>
          </div>

          {/* ATS score */}
          <div className="card flat">
            <div className="card-body" style={{ padding: 14, fontSize: 12.5 }}>
              <div className="label" style={{ marginBottom: 8 }}>Generic ATS score</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <ScoreRing value={82} size={48} stroke={4} />
                <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.45 }}>
                  Reads clean. Add 2–3 quantified outcomes for an easy +6.
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function RenderedResume({ text }: { text: string }) {
  const lines = text.split("\n");
  type Block = { k: "h1" | "h2" | "h3" | "li" | "sp" | "p"; text?: string };
  const blocks: Block[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) { blocks.push({ k: "p", text: buf.join(" ") }); buf = []; }
  };
  for (const l of lines) {
    if (l.startsWith("# ")) { flush(); blocks.push({ k: "h1", text: l.slice(2) }); }
    else if (l.startsWith("## ")) { flush(); blocks.push({ k: "h2", text: l.slice(3) }); }
    else if (l.startsWith("### ")) { flush(); blocks.push({ k: "h3", text: l.slice(4) }); }
    else if (l.startsWith("- ")) { flush(); blocks.push({ k: "li", text: l.slice(2) }); }
    else if (l.trim() === "") { flush(); blocks.push({ k: "sp" }); }
    else { buf.push(l); }
  }
  flush();

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {blocks.map((b, i) => {
        if (b.k === "h1") return <h1 key={i} style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, letterSpacing: "-0.02em", margin: "0 0 4px" }}>{b.text}</h1>;
        if (b.k === "h2") return <div key={i} className="label" style={{ marginTop: 22, marginBottom: 6, fontFamily: "var(--font-ui)" }}>{b.text}</div>;
        if (b.k === "h3") return <div key={i} style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 15, marginTop: 10, marginBottom: 4 }}>{b.text}</div>;
        if (b.k === "li") return (
          <div key={i} style={{ fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6, paddingLeft: 14, position: "relative" }}>
            <span style={{ position: "absolute", left: 0, top: 9, width: 4, height: 4, background: "var(--ink-4)", borderRadius: 99 }} />
            {b.text}
          </div>
        );
        if (b.k === "sp") return <div key={i} style={{ height: 6 }} />;
        return <p key={i} style={{ fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6, margin: "0 0 6px" }}>{b.text}</p>;
      })}
    </div>
  );
}
