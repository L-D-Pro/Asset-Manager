import { useState } from "react";
import { useListAiTrainingExamples, type AiTrainingExample } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ExamplesTabProps {
  taskScope: string;
}

function summarize(example: AiTrainingExample): string {
  const trimmed = example.approvedOutput.trim();
  if (trimmed.length === 0) return "(empty approved output)";
  const firstLine = trimmed.split("\n").find((line) => line.trim() !== "") ?? trimmed;
  return firstLine.length > 140 ? `${firstLine.slice(0, 137)}…` : firstLine;
}

export function ExamplesTab({ taskScope }: ExamplesTabProps) {
  const { data, isLoading } = useListAiTrainingExamples({ taskScope, isActive: true });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const examples = data ?? [];

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading examples…</p>
      ) : examples.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No training examples yet for <span className="font-mono">{taskScope}</span>. Approve outputs in AI Review to
          seed this pool.
        </p>
      ) : (
        examples.map((example) => {
          const expanded = expandedId === example.id;
          return (
            <div key={example.id} className="card-glass text-sm">
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : example.id)}
                className="flex w-full items-center justify-between gap-3 p-3 text-left"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Example #{example.id}</span>
                    {typeof example.qualityScore === "number" && (
                      <Badge variant="outline">score: {example.qualityScore.toFixed(2)}</Badge>
                    )}
                    {example.sourceEntityType && (
                      <Badge variant="secondary">{example.sourceEntityType}</Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{summarize(example)}</p>
                </div>
                <span className="shrink-0 text-muted-foreground">
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </button>

              {expanded && (
                <div className="space-y-2 border-t border-border/60 px-3 pb-3 pt-2 text-xs">
                  <div>
                    <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">
                      Approved Output
                    </div>
                    <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-2 font-mono text-xs">
                      {example.approvedOutput}
                    </pre>
                  </div>
                  {example.rejectedOutput && (
                    <div>
                      <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">
                        Rejected Output
                      </div>
                      <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-2 font-mono text-xs">
                        {example.rejectedOutput}
                      </pre>
                    </div>
                  )}
                  {example.notes && (
                    <div>
                      <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">Notes</div>
                      <p>{example.notes}</p>
                    </div>
                  )}
                  <div className="text-muted-foreground">
                    Created {new Date(example.createdAt).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      <div className="rounded-md border border-dashed border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        Editing training examples is coming soon. For now, examples are managed via approve/reject signals on AI
        Review.
      </div>
    </div>
  );
}
