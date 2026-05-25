import {
  useListClaims,
  useCreateClaim,
  useUpdateClaim,
  useDeleteClaim,
  useDraftClaims,
  getListClaimsQueryKey,
  type Claim,
  type CreateClaimBody,
} from "@workspace/api-client-react";
import { Plus, CheckSquare, Pencil, Trash2, EyeOff, X, Sparkles, Search } from "lucide-react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/api-errors";
import { Portal } from "@/components/ui/portal";

const claimSchema = z.object({
  summary: z.string().min(1, "Summary is required"),
  domain: z.string().optional(),
  evidence: z.string().optional(),
  isActive: z.boolean().default(true),
  phrasingVariants: z.array(z.object({ text: z.string().min(1) })),
  disallowedImplications: z.array(z.object({ text: z.string().min(1) })),
  applicableTags: z.array(z.object({ tag: z.string().min(1) })),
});

type FormValues = z.infer<typeof claimSchema>;
type ClaimFilter = "all" | "active" | "inactive";

type DraftClaimReview = Required<Pick<CreateClaimBody, "summary" | "evidenceType" | "isActive">> &
  Pick<CreateClaimBody, "evidence" | "domain"> & {
    clientId: string;
    selected: boolean;
    phrasingVariantsText: string;
    disallowedImplicationsText: string;
    applicableTagsText: string;
  };

function buildPayload(data: FormValues) {
  return {
    summary: data.summary,
    domain: data.domain || undefined,
    evidence: data.evidence || undefined,
    isActive: data.isActive,
    phrasingVariants: data.phrasingVariants.map((p) => p.text),
    disallowedImplications: data.disallowedImplications.map((p) => p.text),
    applicableTags: data.applicableTags.map((t) => t.tag),
  };
}

export default function ClaimsPage() {
  const [filter, setFilter] = useState<ClaimFilter>("active");
  const [domainFilter, setDomainFilter] = useState("");
  const { data: claims, isLoading } = useListClaims(
    filter === "all"
      ? domainFilter ? { domain: domainFilter } : undefined
      : domainFilter
        ? { isActive: filter === "active", domain: domainFilter }
        : { isActive: filter === "active" },
  );
  const createClaim = useCreateClaim();
  const updateClaim = useUpdateClaim();
  const deleteClaim = useDeleteClaim();
  const draftClaims = useDraftClaims();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [isCleanUpDialogOpen, setIsCleanUpDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftSourceText, setDraftSourceText] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftReviews, setDraftReviews] = useState<DraftClaimReview[]>([]);
  const [creatingDrafts, setCreatingDrafts] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(claimSchema),
    defaultValues: {
      summary: "",
      domain: "",
      evidence: "",
      isActive: true,
      phrasingVariants: [],
      disallowedImplications: [],
      applicableTags: [],
    },
  });

  const { fields: pvFields, append: pvAppend, remove: pvRemove } = useFieldArray({ control: form.control, name: "phrasingVariants" });
  const { fields: diFields, append: diAppend, remove: diRemove } = useFieldArray({ control: form.control, name: "disallowedImplications" });
  const { fields: tagFields, append: tagAppend, remove: tagRemove } = useFieldArray({ control: form.control, name: "applicableTags" });

  const onSubmit = (data: FormValues) => {
    const payload = buildPayload(data);
    if (editingId) {
      updateClaim.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Claim updated" });
            handleCloseDialog();
            queryClient.invalidateQueries({ queryKey: getListClaimsQueryKey() });
          },
          onError: (error) =>
            toast({ title: "Failed to update claim", description: getErrorMessage(error, "Please try again."), variant: "destructive" }),
        },
      );
    } else {
      createClaim.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Claim created" });
            handleCloseDialog();
            queryClient.invalidateQueries({ queryKey: getListClaimsQueryKey() });
          },
          onError: (error) =>
            toast({ title: "Failed to create claim", description: getErrorMessage(error, "Please try again."), variant: "destructive" }),
        },
      );
    }
  };

  const handleEdit = (claim: Claim) => {
    setEditingId(claim.id);
    form.reset({
      summary: claim.summary,
      domain: claim.domain || "",
      evidence: claim.evidence || "",
      isActive: claim.isActive,
      phrasingVariants: (claim.phrasingVariants ?? []).map((t) => ({ text: t })),
      disallowedImplications: (claim.disallowedImplications ?? []).map((t) => ({ text: t })),
      applicableTags: (claim.applicableTags ?? []).map((t) => ({ tag: t })),
    });
    setIsDialogOpen(true);
  };

  const handleToggleActive = (claim: Claim) => {
    updateClaim.mutate(
      { id: claim.id, data: { isActive: !claim.isActive } },
      {
        onSuccess: () => {
          toast({ title: claim.isActive ? "Claim deactivated" : "Claim activated" });
          queryClient.invalidateQueries({ queryKey: getListClaimsQueryKey() });
        },
        onError: (error) =>
          toast({ title: "Failed to update claim status", description: getErrorMessage(error, "Please try again."), variant: "destructive" }),
      },
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this claim?")) {
      deleteClaim.mutate(
        { id },
        {
          onSuccess: () => {
            toast({ title: "Claim deleted" });
            queryClient.invalidateQueries({ queryKey: getListClaimsQueryKey() });
          },
          onError: (error) =>
            toast({ title: "Failed to delete claim", description: getErrorMessage(error, "Please try again."), variant: "destructive" }),
        },
      );
    }
  };

  const handleCleanUpAll = async () => {
    if (!claims || claims.length === 0) return;
    let deletedCount = 0;
    let errorCount = 0;
    for (const claim of claims) {
      try {
        await deleteClaim.mutateAsync({ id: claim.id });
        deletedCount++;
      } catch {
        errorCount++;
      }
    }
    if (deletedCount > 0) {
      await queryClient.invalidateQueries({ queryKey: getListClaimsQueryKey() });
    }
    if (errorCount > 0) {
      toast({ title: `Deleted ${deletedCount} claim${deletedCount === 1 ? "" : "s"}`, description: `${errorCount} failed.`, variant: "destructive" });
    } else {
      toast({ title: `Deleted ${deletedCount} claim${deletedCount === 1 ? "" : "s"}` });
    }
    setIsCleanUpDialogOpen(false);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    form.reset({ summary: "", domain: "", evidence: "", isActive: true, phrasingVariants: [], disallowedImplications: [], applicableTags: [] });
  };

  const handleDraftClaims = () => {
    if (!draftSourceText.trim() && !draftFile) {
      toast({ title: "Add source material", description: "Paste notes or upload a DOCX/PDF file.", variant: "destructive" });
      return;
    }
    draftClaims.mutate(
      { data: { sourceText: draftSourceText.trim() || undefined, prompt: draftPrompt.trim() || undefined, file: draftFile ?? undefined } },
      {
        onSuccess: (response) => {
          setDraftReviews(response.claims.map(toDraftReview));
          toast({ title: "Draft claims ready", description: `${response.claims.length} claim${response.claims.length === 1 ? "" : "s"} generated.` });
        },
        onError: (error) =>
          toast({ title: "Failed to draft claims", description: getErrorMessage(error, "Please adjust the source and try again."), variant: "destructive" }),
      },
    );
  };

  const handleCreateSelectedDrafts = async () => {
    const selected = draftReviews.filter((d) => d.selected);
    if (selected.length === 0) {
      toast({ title: "Select at least one draft", variant: "destructive" });
      return;
    }
    setCreatingDrafts(true);
    try {
      for (const draft of selected) {
        await createClaim.mutateAsync({ data: fromDraftReview(draft) });
      }
      toast({ title: "Claims created", description: `${selected.length} claim${selected.length === 1 ? "" : "s"} added to the ledger.` });
      setDraftReviews((current) => current.filter((d) => !d.selected));
      await queryClient.invalidateQueries({ queryKey: getListClaimsQueryKey() });
    } catch (error) {
      toast({ title: "Failed to create selected claims", description: getErrorMessage(error, "Please review drafts and try again."), variant: "destructive" });
    } finally {
      setCreatingDrafts(false);
    }
  };

  const updateDraftReview = (clientId: string, patch: Partial<DraftClaimReview>) => {
    setDraftReviews((current) =>
      current.map((d) => (d.clientId === clientId ? { ...d, ...patch } : d)),
    );
  };

  const FILTER_TABS: Array<{ id: ClaimFilter; label: string }> = [
    { id: "active", label: "Active" },
    { id: "inactive", label: "Inactive" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="page fade-up">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h1 className="h-display">Claims <em>· ledger</em></h1>
          <div className="dim" style={{ marginTop: 6, fontSize: 13 }}>
            Verified facts the AI can cite. Truth-lock ensures AI outputs never fabricate beyond what's here.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn ghost sm"
            type="button"
            onClick={() => setIsCleanUpDialogOpen(true)}
            disabled={!claims || claims.length === 0}
            data-testid="btn-clean-up-claims">
            <Trash2 size={13} strokeWidth={1.8} /> Clean Up
          </button>
          <button
            className="btn ghost sm"
            type="button"
            onClick={() => setIsAiDialogOpen(true)}
            data-testid="btn-ai-draft-claims">
            <Sparkles size={13} strokeWidth={1.8} /> AI Draft
          </button>
          <button
            className="btn primary sm"
            type="button"
            onClick={() => { setEditingId(null); setIsDialogOpen(true); }}
            data-testid="btn-add-claim">
            <Plus size={13} strokeWidth={1.8} /> New claim
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {FILTER_TABS.map((t) => (
            <div
              key={t.id}
              className={`tab${filter === t.id ? " active" : ""}`}
              onClick={() => setFilter(t.id)}
              data-testid={`tab-claims-${t.id}`}>
              {t.label}
            </div>
          ))}
        </div>
        <div className="search" style={{ minWidth: 200 }}>
          <Search size={13} strokeWidth={1.8} />
          <input
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            placeholder="Filter by domain…"
            data-testid="input-claims-domain-filter"
          />
          {domainFilter && (
            <button style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }} onClick={() => setDomainFilter("")}>
              <X size={12} style={{ color: "var(--ink-4)" }} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ height: 88, background: "var(--paper-2)", opacity: 0.5 }} />
            ))}
          </>
        ) : claims?.length === 0 ? (
          <div className="card" style={{ padding: "48px 18px", textAlign: "center" }}>
            <CheckSquare size={32} style={{ color: "var(--ink-4)", margin: "0 auto 12px" }} />
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>No claims</div>
            <div className="dim" style={{ fontSize: 13 }}>
              {filter === "inactive"
                ? "No inactive claims."
                : filter === "all"
                  ? "Add your first claim to get started."
                  : "No active claims — all may be deactivated."}
            </div>
          </div>
        ) : (
          claims?.map((claim) => (
            <div className="card" key={claim.id} data-testid={`card-claim-${claim.id}`}>
              <div style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 8, lineHeight: 1.45 }}
                      data-testid={`text-claim-summary-${claim.id}`}>
                      {claim.summary}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: (claim.evidence || (claim.disallowedImplications ?? []).length > 0) ? 8 : 0 }}>
                      {!claim.isActive && <span className="chip warn dot">Inactive</span>}
                      {claim.domain && (
                        <span className="chip info" data-testid={`badge-claim-domain-${claim.id}`}>{claim.domain}</span>
                      )}
                      {(claim.applicableTags ?? []).map((tag) => (
                        <span key={tag} className="chip ghost sm">{tag}</span>
                      ))}
                      {(claim.phrasingVariants ?? []).length > 0 && (
                        <span className="chip ghost sm">
                          {claim.phrasingVariants.length} variant{claim.phrasingVariants.length > 1 ? "s" : ""}
                        </span>
                      )}
                      {(claim.disallowedImplications ?? []).length > 0 && (
                        <span className="chip ghost sm">
                          {claim.disallowedImplications.length} disallowed
                        </span>
                      )}
                    </div>
                    {claim.evidence && (
                      <p
                        className="dim"
                        style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: (claim.disallowedImplications ?? []).length > 0 ? 4 : 0 }}
                        data-testid={`text-claim-evidence-${claim.id}`}>
                        {claim.evidence}
                      </p>
                    )}
                    {(claim.disallowedImplications ?? []).length > 0 && (
                      <p className="dim" style={{ fontSize: 12, lineHeight: 1.4 }} data-testid={`text-claim-disallowed-${claim.id}`}>
                        <span style={{ color: "var(--red)", fontWeight: 700 }}>Not implied: </span>
                        {claim.disallowedImplications.join(", ")}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <div
                      className={`switch${claim.isActive ? " on" : ""}`}
                      onClick={() => handleToggleActive(claim)}
                      role="switch"
                      aria-checked={claim.isActive}
                      data-testid={`switch-active-${claim.id}`}>
                      <div className="switch-thumb" />
                    </div>
                    <button
                      className="btn ghost sm"
                      type="button"
                      onClick={() => handleEdit(claim)}
                      data-testid={`btn-edit-claim-${claim.id}`}>
                      <Pencil size={13} strokeWidth={1.8} />
                    </button>
                    <button
                      className="btn ghost sm"
                      type="button"
                      onClick={() => handleDelete(claim.id)}
                      data-testid={`btn-delete-claim-${claim.id}`}>
                      <Trash2 size={13} strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New/Edit Claim Modal */}
      {isDialogOpen && (
        <Portal>
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", padding: 24 }}
          onClick={handleCloseDialog}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 520, maxHeight: "88vh", overflowY: "auto",
              background: "var(--card)", border: "1px solid var(--line)",
              borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)",
            }}>
            <div className="card-h" style={{ position: "sticky", top: 0, background: "var(--card)", zIndex: 1 }}>
              <h2 className="card-title">{editingId ? "Edit claim" : "New claim"}</h2>
              <button type="button" className="settings-x" onClick={handleCloseDialog} aria-label="Close">
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Summary */}
              <div className="field">
                <label>Summary</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Led a team of 5 engineers to deliver project X…"
                  {...form.register("summary")}
                  data-testid="input-claim-summary"
                  style={{ resize: "vertical", fontFamily: "var(--font-ui)", lineHeight: 1.5 }}
                />
                {form.formState.errors.summary && (
                  <span style={{ fontSize: 12, color: "var(--red)" }}>{form.formState.errors.summary.message}</span>
                )}
              </div>

              {/* Domain + Active row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
                <div className="field">
                  <label>Domain</label>
                  <input
                    className="input"
                    placeholder="Engineering, Leadership…"
                    {...form.register("domain")}
                    data-testid="input-claim-domain"
                  />
                </div>
                <div className="field" style={{ alignItems: "center" }}>
                  <label style={{ marginBottom: 6 }}>Active</label>
                  <Controller
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <div
                        className={`switch${field.value ? " on" : ""}`}
                        onClick={() => field.onChange(!field.value)}
                        role="switch"
                        aria-checked={field.value}
                        data-testid="switch-claim-active">
                        <div className="switch-thumb" />
                      </div>
                    )}
                  />
                </div>
              </div>

              {/* Evidence */}
              <div className="field">
                <label>Evidence / Context</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Link to project, metrics, or detailed notes…"
                  {...form.register("evidence")}
                  data-testid="input-claim-evidence"
                  style={{ resize: "vertical", fontFamily: "var(--font-ui)", lineHeight: 1.5 }}
                />
              </div>

              {/* Phrasing Variants */}
              <FieldArraySection
                label="Phrasing Variants"
                sublabel="Alternative wordings used by the AI when the primary summary doesn't fit."
                onAdd={() => pvAppend({ text: "" })}
                addLabel="+ Add variant"
                addTestId="btn-add-variant"
                empty={pvFields.length === 0}
                emptyLabel="No variants yet.">
                {pvFields.map((f, i) => (
                  <div key={f.id} style={{ display: "flex", gap: 6 }}>
                    <input
                      className="input"
                      style={{ flex: 1 }}
                      placeholder={`Variant ${i + 1}`}
                      {...form.register(`phrasingVariants.${i}.text`)}
                      data-testid={`input-variant-${i}`}
                    />
                    <button type="button" className="btn ghost sm" onClick={() => pvRemove(i)} data-testid={`btn-remove-variant-${i}`}>
                      <X size={12} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </FieldArraySection>

              {/* Disallowed Implications */}
              <FieldArraySection
                label="Disallowed Implications"
                sublabel="Phrases the AI must never imply from this fact."
                onAdd={() => diAppend({ text: "" })}
                addLabel="+ Add"
                addTestId="btn-add-disallowed-implication"
                empty={diFields.length === 0}
                emptyLabel="No disallowed implications yet.">
                {diFields.map((f, i) => (
                  <div key={f.id} style={{ display: "flex", gap: 6 }}>
                    <input
                      className="input"
                      style={{ flex: 1 }}
                      placeholder="e.g. sole founder, certified trainer"
                      {...form.register(`disallowedImplications.${i}.text`)}
                      data-testid={`input-disallowed-implication-${i}`}
                    />
                    <button type="button" className="btn ghost sm" onClick={() => diRemove(i)} data-testid={`btn-remove-disallowed-implication-${i}`}>
                      <X size={12} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </FieldArraySection>

              {/* Applicable Tags */}
              <FieldArraySection
                label="Applicable Tags"
                sublabel='Domain tags for filtering and matching (e.g. "distributed-systems").'
                onAdd={() => tagAppend({ tag: "" })}
                addLabel="+ Add tag"
                addTestId="btn-add-tag"
                empty={tagFields.length === 0}
                emptyLabel="No tags yet.">
                {tagFields.map((f, i) => (
                  <div key={f.id} style={{ display: "flex", gap: 6 }}>
                    <input
                      className="input"
                      style={{ flex: 1 }}
                      placeholder="tag"
                      {...form.register(`applicableTags.${i}.tag`)}
                      data-testid={`input-tag-${i}`}
                    />
                    <button type="button" className="btn ghost sm" onClick={() => tagRemove(i)} data-testid={`btn-remove-tag-${i}`}>
                      <X size={12} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </FieldArraySection>
            </div>

            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", gap: 8, justifyContent: "flex-end", position: "sticky", bottom: 0, background: "var(--card)" }}>
              <button type="button" className="btn ghost sm" onClick={handleCloseDialog}>Cancel</button>
              <button type="submit" className="btn primary sm" disabled={createClaim.isPending || updateClaim.isPending} data-testid="btn-submit-claim">
                {editingId ? (updateClaim.isPending ? "Saving…" : "Save changes") : (createClaim.isPending ? "Creating…" : "Create claim")}
              </button>
            </div>
          </form>
        </div>
        </Portal>
      )}

      {/* AI Draft Claims Modal */}
      {isAiDialogOpen && (
        <Portal>
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", padding: 24 }}
          onClick={() => setIsAiDialogOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 560, maxHeight: "88vh", overflowY: "auto",
              background: "var(--card)", border: "1px solid var(--line)",
              borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)",
            }}>
            <div className="card-h" style={{ position: "sticky", top: 0, background: "var(--card)", zIndex: 1 }}>
              <div>
                <h2 className="card-title">AI Draft Claims</h2>
                <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
                  Turn notes or a source document into draft claims, then review and approve.
                </div>
              </div>
              <button type="button" className="settings-x" onClick={() => setIsAiDialogOpen(false)} aria-label="Close">
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="field">
                <label>Source notes</label>
                <textarea
                  className="input"
                  rows={5}
                  value={draftSourceText}
                  onChange={(e) => setDraftSourceText(e.target.value)}
                  placeholder="Paste project summaries, work notes, accomplishments, or raw experience notes…"
                  data-testid="textarea-claim-draft-source"
                  style={{ resize: "vertical", fontFamily: "var(--font-ui)", lineHeight: 1.5 }}
                />
              </div>
              <div className="field">
                <label>Optional instruction</label>
                <textarea
                  className="input"
                  rows={2}
                  value={draftPrompt}
                  onChange={(e) => setDraftPrompt(e.target.value)}
                  placeholder="Example: focus on leadership, analytics, platform work, or customer impact."
                  data-testid="textarea-claim-draft-prompt"
                  style={{ resize: "vertical", fontFamily: "var(--font-ui)", lineHeight: 1.5 }}
                />
              </div>
              <div className="field">
                <label>Upload source document</label>
                <input
                  className="input"
                  type="file"
                  accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setDraftFile(e.target.files?.[0] ?? null)}
                  data-testid="input-claim-draft-file"
                />
                <span className="dim" style={{ fontSize: 11, marginTop: 4 }}>
                  {draftFile ? draftFile.name : "DOCX recommended. PDF works for text-based PDFs only."}
                </span>
              </div>

              <button
                type="button"
                className="btn primary"
                onClick={handleDraftClaims}
                disabled={draftClaims.isPending}
                data-testid="btn-generate-claim-drafts">
                <Sparkles size={13} strokeWidth={1.8} />
                {draftClaims.isPending ? "Generating…" : "Draft Claims"}
              </button>

              {draftReviews.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>Review Drafts</div>
                      <div className="dim" style={{ fontSize: 12 }}>Edit, select, and create only the claims you can verify.</div>
                    </div>
                    <button
                      type="button"
                      className="btn primary sm"
                      onClick={handleCreateSelectedDrafts}
                      disabled={creatingDrafts || createClaim.isPending}
                      data-testid="btn-create-selected-drafts">
                      {creatingDrafts ? "Creating…" : "Create Selected"}
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {draftReviews.map((draft, index) => (
                      <div
                        key={draft.clientId}
                        className="card"
                        style={{
                          border: `1px solid ${draft.selected ? "var(--accent-line)" : "var(--line)"}`,
                          background: draft.selected ? "var(--accent-bg)" : "var(--paper-2)",
                        }}>
                        <div style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            <input
                              type="checkbox"
                              checked={draft.selected}
                              onChange={(e) => updateDraftReview(draft.clientId, { selected: e.target.checked })}
                              data-testid={`checkbox-draft-claim-${index}`}
                              style={{ accentColor: "var(--accent)", width: 16, height: 16, cursor: "pointer" }}
                            />
                            <span style={{ fontWeight: 700, fontSize: 12, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              Draft {index + 1}
                            </span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div className="field">
                              <label>Summary</label>
                              <textarea
                                className="input"
                                rows={2}
                                value={draft.summary}
                                onChange={(e) => updateDraftReview(draft.clientId, { summary: e.target.value })}
                                data-testid={`textarea-draft-summary-${index}`}
                                style={{ resize: "vertical", fontFamily: "var(--font-ui)", lineHeight: 1.5 }}
                              />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                              <div className="field">
                                <label>Domain</label>
                                <input
                                  className="input"
                                  value={draft.domain ?? ""}
                                  onChange={(e) => updateDraftReview(draft.clientId, { domain: e.target.value })}
                                  data-testid={`input-draft-domain-${index}`}
                                />
                              </div>
                              <div className="field">
                                <label>Tags (comma-separated)</label>
                                <input
                                  className="input"
                                  value={draft.applicableTagsText}
                                  onChange={(e) => updateDraftReview(draft.clientId, { applicableTagsText: e.target.value })}
                                  placeholder="tag1, tag2"
                                  data-testid={`input-draft-tags-${index}`}
                                />
                              </div>
                            </div>
                            <div className="field">
                              <label>Disallowed implications (comma-separated)</label>
                              <input
                                className="input"
                                value={draft.disallowedImplicationsText}
                                onChange={(e) => updateDraftReview(draft.clientId, { disallowedImplicationsText: e.target.value })}
                                placeholder="sole founder, certified trainer"
                                data-testid={`input-draft-disallowed-${index}`}
                              />
                            </div>
                            <div className="field">
                              <label>Evidence</label>
                              <textarea
                                className="input"
                                rows={2}
                                value={draft.evidence ?? ""}
                                onChange={(e) => updateDraftReview(draft.clientId, { evidence: e.target.value })}
                                data-testid={`textarea-draft-evidence-${index}`}
                                style={{ resize: "vertical", fontFamily: "var(--font-ui)", lineHeight: 1.5 }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Clean Up Confirm Modal */}
      {isCleanUpDialogOpen && (
        <Portal>
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", padding: 24 }}
          onClick={() => setIsCleanUpDialogOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 400, background: "var(--card)", border: "1px solid var(--line)",
              borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden",
            }}>
            <div className="card-h">
              <h2 className="card-title">Clean Up Claims</h2>
              <button type="button" className="settings-x" onClick={() => setIsCleanUpDialogOpen(false)}><X size={14} strokeWidth={2} /></button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>
                This will permanently delete <strong>all claims</strong> visible in the current filter. This cannot be undone.
              </p>
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn ghost sm" onClick={() => setIsCleanUpDialogOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn sm"
                style={{ background: "var(--red)", color: "#fff", borderColor: "var(--red)" }}
                onClick={handleCleanUpAll}
                disabled={deleteClaim.isPending}
                data-testid="btn-confirm-clean-up-claims">
                {deleteClaim.isPending ? "Deleting…" : "Delete All Claims"}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}

function FieldArraySection({
  label,
  sublabel,
  onAdd,
  addLabel,
  addTestId,
  empty,
  emptyLabel,
  children,
}: {
  label: string;
  sublabel: string;
  onAdd: () => void;
  addLabel: string;
  addTestId: string;
  empty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13 }}>{label}</div>
          <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>{sublabel}</div>
        </div>
        <button type="button" className="btn ghost sm" onClick={onAdd} data-testid={addTestId}>
          {addLabel}
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {empty ? (
          <span className="dim" style={{ fontSize: 12, fontStyle: "italic" }}>{emptyLabel}</span>
        ) : children}
      </div>
    </div>
  );
}

function toDraftReview(claim: CreateClaimBody, index: number): DraftClaimReview {
  return {
    clientId: `${Date.now()}-${index}`,
    selected: true,
    summary: claim.summary ?? "",
    evidence: claim.evidence ?? "",
    evidenceType: claim.evidenceType ?? "self_attestation",
    domain: claim.domain ?? "",
    isActive: claim.isActive ?? true,
    phrasingVariantsText: (claim.phrasingVariants ?? []).join(", "),
    disallowedImplicationsText: (claim.disallowedImplications ?? []).join(", "),
    applicableTagsText: (claim.applicableTags ?? []).join(", "),
  };
}

function fromDraftReview(draft: DraftClaimReview): CreateClaimBody {
  return {
    summary: draft.summary.trim(),
    evidence: draft.evidence?.trim() || undefined,
    evidenceType: draft.evidenceType,
    phrasingVariants: splitCommaList(draft.phrasingVariantsText),
    disallowedImplications: splitCommaList(draft.disallowedImplicationsText),
    domain: draft.domain?.trim() || undefined,
    applicableTags: splitCommaList(draft.applicableTagsText),
    isActive: draft.isActive,
  };
}

function splitCommaList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
