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
  return firstLine.length > 140 ? `${firstLine.slice(0, 137)}...` : firstLine;
}

export function ExamplesTab({ taskScope }: ExamplesTabProps) {
  const { data, isLoading } = useListAiTrainingExamples({ taskScope, isActive: true });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const examples = data ?? [];

  return (
    <div>
      {isLoading ? (
        <p>Loading examples...</p>
      ) : examples.length === 0 ? (
        <p>
          No training examples yet for {taskScope}. Approve outputs in AI Review to
          seed this pool.
        </p>
      ) : (
        examples.map((example) => {
          const expanded = expandedId === example.id;
          return (
            <div key={example.id}>
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : example.id)}
              >
                <div>
                  <div>
                    <span>Example #{example.id}</span>
                    {typeof example.qualityScore === "number" && (
                      <Badge variant="outline">score: {example.qualityScore.toFixed(2)}</Badge>
                    )}
                    {example.sourceEntityType && (
                      <Badge variant="secondary">{example.sourceEntityType}</Badge>
                    )}
                  </div>
                  <p>{summarize(example)}</p>
                </div>
                <span>
                  {expanded ? <ChevronUp /> : <ChevronDown />}
                </span>
              </button>

              {expanded && (
                <div>
                  <div>
                    <div>Approved Output</div>
                    <pre>{example.approvedOutput}</pre>
                  </div>
                  {example.rejectedOutput && (
                    <div>
                      <div>Rejected Output</div>
                      <pre>{example.rejectedOutput}</pre>
                    </div>
                  )}
                  {example.notes && (
                    <div>
                      <div>Notes</div>
                      <p>{example.notes}</p>
                    </div>
                  )}
                  <div>
                    Created {new Date(example.createdAt).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      <div>
        Editing training examples is coming soon. For now, examples are managed via approve/reject signals on AI
        Review.
      </div>
    </div>
  );
}
