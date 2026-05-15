import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, Save, X } from "lucide-react";
import { bestPracticesDomainForTask } from "../types";
import { AI_PIPELINE_OVERVIEW_QUERY_KEY } from "../useAiPipelineOverview";

interface BestPracticesTabProps {
  taskScope: string;
}

interface BestPracticeItem {
  description: string;
  source: "ai" | "hardcoded" | "hybrid";
  rationale?: string;
  frequency?: number;
  enabled?: boolean;
}

interface BestPracticesConfig {
  domain: string;
  title: string;
  items: BestPracticeItem[];
  hardcodedGuards: Record<string, boolean>;
  lastRefreshedAt?: string;
}

function withEnabledFlag(config: BestPracticesConfig): BestPracticesConfig {
  return {
    ...config,
    items: config.items.map((item) => ({ ...item, enabled: true })),
  };
}

export function BestPracticesTab({ taskScope }: BestPracticesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const domain = bestPracticesDomainForTask(taskScope);

  const [config, setConfig] = useState<BestPracticesConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDescription, setEditDescription] = useState("");

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/best-practices?domain=${encodeURIComponent(domain)}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Failed to load best practices (HTTP ${response.status})`);
      }
      const data = (await response.json()) as BestPracticesConfig;
      setConfig(withEnabledFlag(data));
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not load best practices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [domain, toast]);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const persist = async (next: BestPracticesConfig) => {
    setSaving(true);
    try {
      const payloadItems = next.items
        .filter((item) => item.enabled !== false)
        .map(({ enabled: _enabled, ...rest }) => rest);

      const response = await fetch("/api/best-practices", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: next.domain, items: payloadItems }),
      });
      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const err = (await response.json()) as { error?: string; detail?: string; message?: string };
          detail = err.error ?? err.detail ?? err.message ?? detail;
        } catch {
          // ignore parse failure
        }
        throw new Error(detail);
      }
      const data = (await response.json()) as BestPracticesConfig;
      setConfig(withEnabledFlag(data));
      setEditingIndex(null);
      toast({ title: "Best practices saved" });
      queryClient.invalidateQueries({ queryKey: AI_PIPELINE_OVERVIEW_QUERY_KEY });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Loader2 /> Loading best practices...
      </div>
    );
  }

  if (!config) {
    return <p>Failed to load best practices.</p>;
  }

  const toggleItem = (index: number) => {
    const items = config.items.map((item, i) =>
      i === index ? { ...item, enabled: !(item.enabled !== false) } : item,
    );
    const next = { ...config, items };
    setConfig(next);
    void persist(next);
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditDescription(config.items[index]?.description ?? "");
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditDescription("");
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const items = config.items.map((item, i) =>
      i === editingIndex ? { ...item, description: editDescription } : item,
    );
    void persist({ ...config, items });
  };

  return (
    <div>
      <p>
        Editing domain {config.domain}
        {" - "}{config.items.length} rules
      </p>

      {config.items.map((item, index) => {
        const isEditing = editingIndex === index;
        const isDisabled = item.enabled === false;

        return (
          <div key={index}>
            <div>
              <div>
                <div>
                  <Badge variant={item.source === "ai" ? "default" : "outline"}>{item.source}</Badge>
                  {typeof item.frequency === "number" && (
                    <span>Frequency: {item.frequency}</span>
                  )}
                </div>
                {isEditing ? (
                  <Textarea
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                  />
                ) : (
                  <p>{item.description}</p>
                )}
                {item.rationale && !isEditing && (
                  <p>{item.rationale}</p>
                )}
              </div>

              <div>
                <Switch
                  checked={item.enabled !== false}
                  onCheckedChange={() => toggleItem(index)}
                  disabled={isEditing || saving}
                  aria-label={`Toggle rule ${index + 1}`}
                />
                {isEditing ? (
                  <>
                    <Button variant="ghost" size="icon" onClick={cancelEdit} disabled={saving}>
                      <X />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={saveEdit} disabled={saving}>
                      {saving ? <Loader2 /> : <Save />}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEdit(index)}
                    disabled={editingIndex !== null || saving}
                  >
                    <Pencil />
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <div>
        <Link to="/admin/best-practices">
          Open in Admin - Best Practices
        </Link>
      </div>
    </div>
  );
}
