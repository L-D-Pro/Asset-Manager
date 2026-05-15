import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth";
import { Loader2, RefreshCw, Plus, Pencil, Save, X } from "lucide-react";

interface BestPracticeItem {
  description: string;
  source: "ai" | "hardcoded" | "hybrid";
  rationale?: string;
  frequency?: number;
  enabled?: boolean; // local-only flag for UI toggling
}

interface BestPracticesConfig {
  domain: string;
  title: string;
  items: BestPracticeItem[];
  hardcodedGuards: Record<string, boolean>;
  lastRefreshedAt?: string;
}

function cloneConfig(config: BestPracticesConfig): BestPracticesConfig {
  return {
    ...config,
    items: config.items.map((item) => ({ ...item })),
  };
}

function configsEqual(a: BestPracticesConfig, b: BestPracticesConfig): boolean {
  if (a.items.length !== b.items.length) return false;
  for (let i = 0; i < a.items.length; i++) {
    const ai = a.items[i]!;
    const bi = b.items[i]!;
    if (
      ai.description !== bi.description ||
      ai.source !== bi.source ||
      ai.rationale !== bi.rationale ||
      ai.frequency !== bi.frequency ||
      ai.enabled !== bi.enabled
    ) {
      return false;
    }
  }
  return true;
}

export default function BestPracticesAdminPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<BestPracticesConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<BestPracticesConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDescription, setEditDescription] = useState("");

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [newRationale, setNewRationale] = useState("");

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/best-practices", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch best practices");
      const data = (await res.json()) as BestPracticesConfig;
      const mapped: BestPracticesConfig = {
        ...data,
        items: data.items.map((item) => ({ ...item, enabled: true })),
      };
      setConfig(mapped);
      setOriginalConfig(cloneConfig(mapped));
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not load best practices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const hasChanges =
    config !== null &&
    originalConfig !== null &&
    !configsEqual(config, originalConfig);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/best-practices/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to refresh");
      const data = (await res.json()) as BestPracticesConfig;
      const mapped: BestPracticesConfig = {
        ...data,
        items: data.items.map((item) => ({ ...item, enabled: true })),
      };
      setConfig(mapped);
      setOriginalConfig(cloneConfig(mapped));
      toast({ title: "Refreshed", description: "Best practices updated from AI" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Refresh failed",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const doSave = async (nextConfig: BestPracticesConfig) => {
    setSaving(true);
    try {
      const activeItems = nextConfig.items
        .filter((item) => item.enabled !== false)
        .map(({ enabled: _enabled, ...rest }) => rest);

      const res = await fetch("/api/best-practices", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: nextConfig.domain,
          items: activeItems,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error ?? "Save failed");
      }
      const data = (await res.json()) as BestPracticesConfig;
      const mapped: BestPracticesConfig = {
        ...data,
        items: data.items.map((item) => ({ ...item, enabled: true })),
      };
      setConfig(mapped);
      setOriginalConfig(cloneConfig(mapped));
      setEditingIndex(null);
      toast({ title: "Saved", description: "Best practices updated" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Save failed",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = () => {
    if (!config) return;
    void doSave(config);
  };

  const handleSaveEdit = () => {
    if (!config || editingIndex === null) return;
    const newItems = [...config.items];
    newItems[editingIndex] = { ...newItems[editingIndex]!, description: editDescription };
    const nextConfig = { ...config, items: newItems };
    setConfig(nextConfig);
    void doSave(nextConfig);
  };

  const handleCancelEdit = () => {
    if (!originalConfig || editingIndex === null) return;
    const newItems = [...config!.items];
    newItems[editingIndex] = { ...originalConfig.items[editingIndex]! };
    setConfig({ ...config!, items: newItems });
    setEditingIndex(null);
    setEditDescription("");
  };

  const startEdit = (index: number) => {
    if (!config) return;
    setEditingIndex(index);
    setEditDescription(config.items[index]!.description);
  };

  const toggleItem = (index: number) => {
    if (!config) return;
    const newItems = [...config.items];
    newItems[index] = { ...newItems[index]!, enabled: !newItems[index]!.enabled };
    setConfig({ ...config, items: newItems });
  };

  const handleAdd = () => {
    if (!newDescription.trim()) {
      toast({
        title: "Validation",
        description: "Description is required",
        variant: "destructive",
      });
      return;
    }
    if (!config) return;

    const newItem: BestPracticeItem = {
      description: newDescription.trim(),
      source: "hybrid",
      rationale: newRationale.trim() || undefined,
      enabled: true,
    };

    const nextConfig = {
      ...config,
      items: [...config.items, newItem],
    };
    setConfig(nextConfig);
    setNewDescription("");
    setNewRationale("");
    setAddDialogOpen(false);
    void doSave(nextConfig);
  };

  if (user?.role !== "admin") {
    return (
      <ContentCard>
        <div>
          <h2>Access Denied</h2>
          <p>Admin access required.</p>
        </div>
      </ContentCard>
    );
  }

  const sourceVariant = (source: string): "default" | "secondary" | "outline" => {
    switch (source) {
      case "ai":
        return "default";
      case "hardcoded":
        return "secondary";
      case "hybrid":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <div>
      <PageHeader
        title="Best Practices"
        subtitle="AI quality rules for resume and cover letter generation"
        variant="admin"
      >
        {hasChanges && (
          <Button onClick={handleSaveAll} disabled={saving}>
            {saving ? <Loader2 /> : <Save />}
            Save Changes
          </Button>
        )}
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? <Loader2 /> : <RefreshCw />}
          Refresh from AI
        </Button>
      </PageHeader>

      <p>
        Edit best practices alongside the prompt, role, and model for one task in the{" "}
        <Link to="/pipeline-diagram">
          AI Pipeline Hub
        </Link>
        .
      </p>

      {loading ? (
        <div>
          <Loader2 />
        </div>
      ) : !config ? (
        <div>
          Failed to load best practices.
        </div>
      ) : (
        <>
          <div>
            {config.items.map((item, index) => {
              const isEditing = editingIndex === index;
              const isDisabled = item.enabled === false;

              return (
                <ContentCard
                  key={index}
                  
                  index={index}
                >
                  <div>
                    <div>
                      <div>
                        <Badge variant={sourceVariant(item.source)}>
                          {item.source}
                        </Badge>
                        {typeof item.frequency === "number" && (
                          <span>
                            Frequency: {item.frequency}
                          </span>
                        )}
                      </div>

                      {isEditing ? (
                        <Textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={3}
                        />
                      ) : (
                        <p>
                          {item.description}
                        </p>
                      )}

                      {item.rationale && (
                        <p>
                          {item.rationale}
                        </p>
                      )}
                    </div>

                    <div>
                      <Switch
                        checked={item.enabled !== false}
                        onCheckedChange={() => toggleItem(index)}
                        disabled={isEditing}
                      />
                      {isEditing ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCancelEdit}
                            disabled={saving}
                          >
                            <X />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleSaveEdit}
                            disabled={saving}
                          >
                            {saving ? (
                              <Loader2 />
                            ) : (
                              <Save />
                            )}
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
                </ContentCard>
              );
            })}
          </div>

          {/* Hardcoded Guards */}
          {config.hardcodedGuards && Object.keys(config.hardcodedGuards).length > 0 && (
            <ContentCard>
              <div>
                <h3>
                  Hardcoded Guards
                </h3>
                <div>
                  {Object.entries(config.hardcodedGuards).map(([key, value]) => (
                    <div
                      key={key}
                    >
                      <span>
                        {key}
                      </span>
                      <Badge variant={value ? "default" : "destructive"}>
                        {value ? "ON" : "OFF"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </ContentCard>
          )}

          <div>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus />
              Add Rule
            </Button>
          </div>
        </>
      )}

      {/* Add Rule Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Rule</DialogTitle>
          </DialogHeader>
          <div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Enter rule description..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="rationale">Rationale (optional)</Label>
              <Textarea
                id="rationale"
                value={newRationale}
                onChange={(e) => setNewRationale(e.target.value)}
                placeholder="Why is this rule important?"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Add Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
