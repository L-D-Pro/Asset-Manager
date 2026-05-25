import { useState } from "react";
import { useListAiTrainingExamples, type AiTrainingExample } from "@workspace/api-client-react";
import { ChevronDown, ChevronRight } from "lucide-react";

function summarize(example: AiTrainingExample): string {
  const trimmed = example.approvedOutput.trim();
  if (trimmed.length === 0) return "(empty approved output)";
  const firstLine = trimmed.split("\n").find((line) => line.trim() !== "") ?? trimmed;
  return firstLine.length > 140 ? `${firstLine.slice(0, 137)}…` : firstLine;
}

export function ExamplesTab({ taskScope }: { taskScope: string }) {
  const { data, isLoading } = useListAiTrainingExamples({ taskScope, isActive: true });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const examples = data ?? [];

  if (isLoading) return <div className="dim" style={{ fontSize: 13 }}>Loading examples…</div>;

  if (examples.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="dim" style={{ fontSize: 13 }}>
          No training examples yet for <span className="mono">{taskScope}</span>. Approve outputs in AI Review to seed this pool.
        </div>
        <div className="card flat" style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-3)" }}>
          Editing training examples is coming soon. Examples are managed via approve / reject signals in AI Review.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div className="card flat" style={{ overflow: "hidden", marginBottom: 10 }}>
        <div className="row-list">
          {examples.map((example) => {
            const expanded = expandedId === example.id;
            return (
              <div key={example.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : example.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 16px", background: "none", border: "none",
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  <span style={{ color: "var(--ink-4)", flexShrink: 0 }}>
                    {expanded
                      ? <ChevronDown size={13} strokeWidth={2} />
                      : <ChevronRight size={13} strokeWidth={2} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span className="mono" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 500 }}>
                        #{example.id}
                      </span>
                      {typeof example.qualityScore === "number" && (
                        <span className="chip ghost" style={{ fontSize: 10 }}>
                          score: {example.qualityScore.toFixed(2)}
                        </span>
                      )}
                      {example.sourceEntityType && (
                        <span className="chip ghost" style={{ fontSize: 10 }}>{example.sourceEntityType}</span>
                      )}
                    </div>
                    <div className="dim" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {summarize(example)}
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <div className="label" style={{ marginBottom: 6 }}>Approved output</div>
                      <pre style={{
                        padding: 12, borderRadius: "var(--r-md)", background: "var(--paper-3)",
                        fontSize: 11.5, lineHeight: 1.65, overflowX: "auto", whiteSpace: "pre-wrap",
                        fontFamily: "var(--font-mono)", color: "var(--ink-2)", margin: 0,
                      }}>
                        {example.approvedOutput}
                      </pre>
                    </div>
                    {example.rejectedOutput && (
                      <div>
                        <div className="label" style={{ marginBottom: 6, color: "var(--ink-4)" }}>Rejected output</div>
                        <pre style={{
                          padding: 12, borderRadius: "var(--r-md)", background: "var(--paper-3)",
                          fontSize: 11.5, lineHeight: 1.65, overflowX: "auto", whiteSpace: "pre-wrap",
                          fontFamily: "var(--font-mono)", color: "var(--ink-3)", margin: 0,
                        }}>
                          {example.rejectedOutput}
                        </pre>
                      </div>
                    )}
                    {example.notes && (
                      <div>
                        <div className="label" style={{ marginBottom: 4 }}>Notes</div>
                        <div className="dim" style={{ fontSize: 12.5 }}>{example.notes}</div>
                      </div>
                    )}
                    <div className="dim mono" style={{ fontSize: 11 }}>
                      Created {new Date(example.createdAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="dim" style={{ fontSize: 12 }}>
        Editing training examples is coming soon. Examples are managed via approve / reject signals in AI Review.
      </div>
    </div>
  );
}
