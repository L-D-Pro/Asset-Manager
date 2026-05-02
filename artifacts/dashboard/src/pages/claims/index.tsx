import { useListClaims, useCreateClaim, useUpdateClaim, useDeleteClaim, useDraftClaims, getListClaimsQueryKey, type Claim, type CreateClaimBody } from "@workspace/api-client-react";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckSquare, Pencil, Trash2, EyeOff, X, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/api-errors";
import { AiProgressButton } from "@/components/ai/ai-progress-button";

const claimSchema = z.object({
 summary: z.string().min(1, "Summary is required"),
 domain: z.string().optional(),
 evidence: z.string().optional(),
 isActive: z.boolean().default(true),
 phrasingVariants: z.array(z.object({ text: z.string().min(1) })),
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
 phrasingVariants: data.phrasingVariants.map(p => p.text),
 applicableTags: data.applicableTags.map(t => t.tag),
 };
}

export default function ClaimsPage() {
 const [filter, setFilter] = useState<ClaimFilter>("active");
 const [domainFilter, setDomainFilter] = useState("");
 const { data: claims, isLoading } = useListClaims(
 filter === "all" ? (domainFilter ? { domain: domainFilter } : undefined) :
 domainFilter ? { isActive: filter === "active", domain: domainFilter } :
 { isActive: filter === "active" }
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
 applicableTags: [],
 },
 });

 const { fields: pvFields, append: pvAppend, remove: pvRemove } = useFieldArray({ control: form.control, name: "phrasingVariants" });
 const { fields: tagFields, append: tagAppend, remove: tagRemove } = useFieldArray({ control: form.control, name: "applicableTags" });

 const onSubmit = (data: FormValues) => {
 const payload = buildPayload(data);
 if (editingId) {
 updateClaim.mutate(
 { id: editingId, data: payload },
 {
 onSuccess: () => {
 toast({ title: "Claim updated successfully" });
 handleCloseDialog();
 queryClient.invalidateQueries({ queryKey: getListClaimsQueryKey() });
 },
 onError: (error) =>
 toast({
 title: "Failed to update claim",
 description: getErrorMessage(error, "Please try again."),
 variant: "destructive",
 }),
 }
 );
 } else {
 createClaim.mutate(
 { data: payload },
 {
 onSuccess: () => {
 toast({ title: "Claim created successfully" });
 handleCloseDialog();
 queryClient.invalidateQueries({ queryKey: getListClaimsQueryKey() });
 },
 onError: (error) =>
 toast({
 title: "Failed to create claim",
 description: getErrorMessage(error, "Please try again."),
 variant: "destructive",
 }),
 }
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
 toast({
 title: "Failed to update claim status",
 description: getErrorMessage(error, "Please try again."),
 variant: "destructive",
 }),
 }
 );
 };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this claim?")) {
      deleteClaim.mutate(
        { id },
        {
          onSuccess: () => {
            toast({ title: "Claim deleted" });
            queryClient.invalidateQueries({ queryKey: getListClaimsQueryKey() });
          },
          onError: (error) =>
            toast({
              title: "Failed to delete claim",
              description: getErrorMessage(error, "Please try again."),
              variant: "destructive",
            }),
        }
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
      toast({
        title: `Deleted ${deletedCount} claim${deletedCount === 1 ? "" : "s"}`,
        description: `${errorCount} failed to delete.`,
        variant: "destructive",
      });
    } else {
      toast({ title: `Deleted ${deletedCount} claim${deletedCount === 1 ? "" : "s"}` });
    }
    setIsCleanUpDialogOpen(false);
  };

 const handleCloseDialog = () => {
 setIsDialogOpen(false);
 setEditingId(null);
 form.reset({ summary: "", domain: "", evidence: "", isActive: true, phrasingVariants: [], applicableTags: [] });
 };

 const handleDraftClaims = () => {
 if (!draftSourceText.trim() && !draftFile) {
 toast({
 title: "Add source material",
 description: "Paste notes or upload a DOCX/PDF file.",
 variant: "destructive",
 });
 return;
 }

 draftClaims.mutate(
 {
 data: {
 sourceText: draftSourceText.trim() || undefined,
 prompt: draftPrompt.trim() || undefined,
 file: draftFile ?? undefined,
 },
 },
 {
 onSuccess: (response) => {
 setDraftReviews(response.claims.map(toDraftReview));
 toast({
 title: "Draft claims ready",
 description: `${response.claims.length} claim${response.claims.length === 1 ? "" : "s"} generated for review.`,
 });
 },
 onError: (error) =>
 toast({
 title: "Failed to draft claims",
 description: getErrorMessage(error, "Please adjust the source and try again."),
 variant: "destructive",
 }),
 },
 );
 };

 const handleCreateSelectedDrafts = async () => {
 const selected = draftReviews.filter((draft) => draft.selected);
 if (selected.length === 0) {
 toast({
 title: "Select at least one draft",
 description: "Only selected drafts will be added to the Claims Ledger.",
 variant: "destructive",
 });
 return;
 }

 setCreatingDrafts(true);
 try {
 for (const draft of selected) {
 await createClaim.mutateAsync({ data: fromDraftReview(draft) });
 }

 toast({
 title: "Claims created",
 description: `${selected.length} claim${selected.length === 1 ? "" : "s"} added to the ledger.`,
 });
 setDraftReviews((current) => current.filter((draft) => !draft.selected));
 await queryClient.invalidateQueries({ queryKey: getListClaimsQueryKey() });
 } catch (error) {
 toast({
 title: "Failed to create selected claims",
 description: getErrorMessage(error, "Please review the drafts and try again."),
 variant: "destructive",
 });
 } finally {
 setCreatingDrafts(false);
 }
 };

 const updateDraftReview = (clientId: string, patch: Partial<DraftClaimReview>) => {
 setDraftReviews((current) =>
 current.map((draft) => draft.clientId === clientId ? { ...draft, ...patch } : draft),
 );
 };

 return (
 <div className="space-y-6">
 <PageHeader
 title="Claims Ledger"
 subtitle="Track skills, accomplishments, and quantifiable claims for your resume."
 variant="workflow"
 >
 <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
 <DialogTrigger asChild>
 <Button variant="outline" data-testid="btn-ai-draft-claims">
 <Sparkles className="mr-2 h-4 w-4" />
 AI Draft Claims
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>AI Draft Claims</DialogTitle>
 <DialogDescription>
 Turn notes or a source document into draft claims, then review and create only the ones you approve.
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-5">
 <div className="grid gap-4 lg:grid-cols-2">
 <div className="space-y-2">
 <label className="text-sm font-medium" htmlFor="draft-source-text">Source notes</label>
 <Textarea
 id="draft-source-text"
 value={draftSourceText}
 onChange={(event) => setDraftSourceText(event.target.value)}
 placeholder="Paste project summaries, work notes, accomplishments, or raw experience notes..."
 className="min-h-44"
 data-testid="textarea-claim-draft-source"
 />
 </div>
 <div className="space-y-4">
 <div className="space-y-2">
 <label className="text-sm font-medium" htmlFor="draft-prompt">Optional instruction</label>
 <Textarea
 id="draft-prompt"
 value={draftPrompt}
 onChange={(event) => setDraftPrompt(event.target.value)}
 placeholder="Example: focus on leadership, analytics, platform work, or customer impact."
 className="min-h-24"
 data-testid="textarea-claim-draft-prompt"
 />
 </div>
 <div className="space-y-2">
 <label className="text-sm font-medium" htmlFor="draft-file">Upload source document</label>
 <Input
 id="draft-file"
 type="file"
 accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
 onChange={(event) => setDraftFile(event.target.files?.[0] ?? null)}
 data-testid="input-claim-draft-file"
 />
 <p className="text-xs text-muted-foreground">
 {draftFile ? draftFile.name : "DOCX or text-based PDF. The file is converted to text and not stored."}
 </p>
 </div>
 </div>
 </div>

 <div className="flex justify-end">
 <AiProgressButton
 type="button"
 onClick={handleDraftClaims}
 isPending={draftClaims.isPending}
 idleLabel="Draft Claims"
 data-testid="btn-generate-claim-drafts"
 />
 </div>

 {draftReviews.length > 0 && (
 <div className="space-y-4 border-t pt-5">
 <div className="flex items-center justify-between gap-3">
 <div>
 <h3 className="font-semibold">Review Drafts</h3>
 <p className="text-sm text-muted-foreground">Edit, select, and create only the claims you can verify.</p>
 </div>
 <Button
 type="button"
 onClick={handleCreateSelectedDrafts}
 disabled={creatingDrafts || createClaim.isPending}
 data-testid="btn-create-selected-drafts"
 >
 {creatingDrafts ? "Creating..." : "Create Selected"}
 </Button>
 </div>

 <div className="space-y-3">
 {draftReviews.map((draft, index) => (
  <div key={draft.clientId} className="card-glass p-4 space-y-3">
 <div className="flex items-center gap-3">
 <Checkbox
 checked={draft.selected}
 onCheckedChange={(checked) => updateDraftReview(draft.clientId, { selected: checked === true })}
 data-testid={`checkbox-draft-claim-${index}`}
 />
 <span className="text-sm font-medium">Draft {index + 1}</span>
 </div>
 <div className="grid gap-3 md:grid-cols-2">
 <div className="md:col-span-2 space-y-2">
 <label className="text-xs font-medium" htmlFor={`draft-summary-${draft.clientId}`}>Summary</label>
 <Textarea
 id={`draft-summary-${draft.clientId}`}
 value={draft.summary}
 onChange={(event) => updateDraftReview(draft.clientId, { summary: event.target.value })}
 className="min-h-20"
 data-testid={`textarea-draft-summary-${index}`}
 />
 </div>
 <div className="space-y-2">
 <label className="text-xs font-medium" htmlFor={`draft-domain-${draft.clientId}`}>Domain</label>
 <Input
 id={`draft-domain-${draft.clientId}`}
 value={draft.domain ?? ""}
 onChange={(event) => updateDraftReview(draft.clientId, { domain: event.target.value })}
 data-testid={`input-draft-domain-${index}`}
 />
 </div>
 <div className="space-y-2">
 <label className="text-xs font-medium" htmlFor={`draft-tags-${draft.clientId}`}>Tags</label>
 <Input
 id={`draft-tags-${draft.clientId}`}
 value={draft.applicableTagsText}
 onChange={(event) => updateDraftReview(draft.clientId, { applicableTagsText: event.target.value })}
 placeholder="comma-separated"
 data-testid={`input-draft-tags-${index}`}
 />
 </div>
 <div className="md:col-span-2 space-y-2">
 <label className="text-xs font-medium" htmlFor={`draft-evidence-${draft.clientId}`}>Evidence</label>
 <Textarea
 id={`draft-evidence-${draft.clientId}`}
 value={draft.evidence ?? ""}
 onChange={(event) => updateDraftReview(draft.clientId, { evidence: event.target.value })}
 className="min-h-16"
 data-testid={`textarea-draft-evidence-${index}`}
 />
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </DialogContent>
 </Dialog>

 <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setIsDialogOpen(true); }}>
 <DialogTrigger asChild>
 <Button data-testid="btn-add-claim">
 <Plus className="mr-2 h-4 w-4" />
 New Claim
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>{editingId ? "Edit Claim" : "Create New Claim"}</DialogTitle>
 <DialogDescription>
 Add one verified factual achievement or responsibility to the truth ledger.
 </DialogDescription>
 </DialogHeader>
 <Form {...form}>
 <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
 <FormField
 control={form.control}
 name="summary"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Summary</FormLabel>
 <FormControl>
 <Textarea placeholder="Led a team of 5 engineers to deliver project X..." {...field} data-testid="input-claim-summary" />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <div className="grid grid-cols-2 gap-4">
 <FormField
 control={form.control}
 name="domain"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Domain</FormLabel>
 <FormControl>
 <Input placeholder="Engineering, Leadership…" {...field} data-testid="input-claim-domain" />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />
 <FormField
 control={form.control}
 name="isActive"
 render={({ field }) => (
 <FormItem className="flex items-center justify-between rounded-lg border p-3 mt-2">
 <FormLabel className="mb-0">Active</FormLabel>
 <FormControl>
 <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-claim-active" />
 </FormControl>
 </FormItem>
 )}
 />
 </div>
 <FormField
 control={form.control}
 name="evidence"
 render={({ field }) => (
 <FormItem>
 <FormLabel>Evidence / Context</FormLabel>
 <FormControl>
 <Textarea placeholder="Link to project, metrics, or detailed notes…" {...field} data-testid="input-claim-evidence" />
 </FormControl>
 <FormMessage />
 </FormItem>
 )}
 />

 <div>
 <div className="flex items-center justify-between mb-2">
 <div>
 <p className="text-sm font-medium leading-none">Phrasing Variants</p>
 <p className="text-xs text-muted-foreground mt-1">
 Alternative wordings used by the AI when the primary summary doesn't fit.
 </p>
 </div>
 <Button type="button" variant="outline" size="sm" onClick={() => pvAppend({ text: "" })} data-testid="btn-add-variant">
 <Plus className="h-3 w-3 mr-1" /> Add
 </Button>
 </div>
 <div className="space-y-2">
 {pvFields.map((f, i) => (
 <div key={f.id} className="flex gap-2">
 <FormField control={form.control} name={`phrasingVariants.${i}.text`} render={({field}) => (
 <FormItem className="flex-1 mb-0">
 <FormControl><Input {...field} placeholder={`Variant ${i + 1}`} data-testid={`input-variant-${i}`}/></FormControl>
 <FormMessage />
 </FormItem>
 )}/>
 <Button type="button" variant="ghost" size="icon" onClick={() => pvRemove(i)} data-testid={`btn-remove-variant-${i}`}>
 <X className="h-4 w-4 text-destructive" />
 </Button>
 </div>
 ))}
 {pvFields.length === 0 && <p className="text-xs text-muted-foreground italic">No variants yet.</p>}
 </div>
 </div>

 <div>
 <div className="flex items-center justify-between mb-2">
 <div>
 <p className="text-sm font-medium leading-none">Applicable Tags</p>
 <p className="text-xs text-muted-foreground mt-1">
 Domain tags used for filtering and matching (e.g. "distributed-systems", "leadership").
 </p>
 </div>
 <Button type="button" variant="outline" size="sm" onClick={() => tagAppend({ tag: "" })} data-testid="btn-add-tag">
 <Plus className="h-3 w-3 mr-1" /> Add
 </Button>
 </div>
 <div className="flex flex-wrap gap-2">
 {tagFields.map((f, i) => (
 <div key={f.id} className="flex items-center gap-1 bg-secondary rounded-full px-2 py-1">
 <FormField control={form.control} name={`applicableTags.${i}.tag`} render={({field}) => (
 <Input {...field} className="h-5 w-24 border-0 bg-transparent p-0 text-xs focus-visible:ring-0" placeholder="tag" data-testid={`input-tag-${i}`}/>
 )}/>
 <button type="button" onClick={() => tagRemove(i)} className="text-muted-foreground hover:text-destructive" data-testid={`btn-remove-tag-${i}`}>
 <X className="h-3 w-3" />
 </button>
 </div>
 ))}
 {tagFields.length === 0 && <p className="text-xs text-muted-foreground italic">No tags yet.</p>}
 </div>
 </div>

 <div className="flex justify-end pt-2">
 <Button type="submit" disabled={createClaim.isPending || updateClaim.isPending} data-testid="btn-submit-claim">
 {editingId ? "Update Claim" : "Create Claim"}
 </Button>
 </div>
 </form>
 </Form>
 </DialogContent>
  </Dialog>

  <Dialog open={isCleanUpDialogOpen} onOpenChange={setIsCleanUpDialogOpen}>
  <DialogTrigger asChild>
  <Button variant="outline" disabled={!claims || claims.length === 0} data-testid="btn-clean-up-claims">
  <Trash2 className="mr-2 h-4 w-4" />
  Clean Up
  </Button>
  </DialogTrigger>
  <DialogContent>
  <DialogHeader>
  <DialogTitle>Clean Up Claims</DialogTitle>
  <DialogDescription>
  This will permanently delete all claims. This cannot be undone.
  </DialogDescription>
  </DialogHeader>
  <DialogFooter>
  <Button variant="outline" onClick={() => setIsCleanUpDialogOpen(false)}>Cancel</Button>
  <Button variant="destructive" onClick={handleCleanUpAll} disabled={deleteClaim.isPending} data-testid="btn-confirm-clean-up-claims">
  {deleteClaim.isPending ? "Deleting..." : "Delete All Claims"}
  </Button>
  </DialogFooter>
  </DialogContent>
  </Dialog>
  </PageHeader>

 <div className="flex flex-col sm:flex-row gap-3">
 <Tabs value={filter} onValueChange={(v) => setFilter(v as ClaimFilter)} data-testid="tabs-claims-filter">
 <TabsList>
 <TabsTrigger value="active" data-testid="tab-claims-active">Active</TabsTrigger>
 <TabsTrigger value="inactive" data-testid="tab-claims-inactive">Inactive</TabsTrigger>
 <TabsTrigger value="all" data-testid="tab-claims-all">All</TabsTrigger>
 </TabsList>
 </Tabs>
 <div className="relative">
 <Input
 placeholder="Filter by domain…"
 value={domainFilter}
 onChange={(e) => setDomainFilter(e.target.value)}
 className="h-9 w-48"
 data-testid="input-claims-domain-filter"
 />
 {domainFilter && (
 <button className="absolute right-2 top-2 text-muted-foreground hover:text-foreground" onClick={() => setDomainFilter("")}>
 <X className="h-4 w-4" />
 </button>
 )}
 </div>
 </div>

 <div className="grid gap-4">
 {isLoading ? (
 <>
 <Skeleton className="h-24 w-full" />
 <Skeleton className="h-24 w-full" />
 <Skeleton className="h-24 w-full" />
 </>
 ) : claims?.length === 0 ? (
  <div className="card-glass flex flex-col items-center justify-center p-12 text-center">
  <CheckSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
 <h3 className="text-lg font-semibold text-foreground">No claims</h3>
  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
 {filter === "inactive" ? "No inactive claims." : filter === "all" ? "Add your first claim to get started." : "No active claims — all may be deactivated."}
 </p>
 </div>
 ) : (
 claims?.map((claim) => (
  <ContentCard key={claim.id} data-testid={`card-claim-${claim.id}`} className={`rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.06)] ${!claim.isActive ? "opacity-60" : ""}`}>
 <CardContent className="p-6">
 <div className="flex items-start justify-between">
 <div className="space-y-2 flex-1 pr-4">
 <div className="flex items-center gap-2 flex-wrap">
 <p className="font-medium" data-testid={`text-claim-summary-${claim.id}`}>{claim.summary}</p>
 {!claim.isActive && (
 <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
 <EyeOff className="h-3 w-3" /> Inactive
 </Badge>
 )}
 </div>
 <div className="flex gap-2 flex-wrap">
 {claim.domain && <Badge variant="secondary" data-testid={`badge-claim-domain-${claim.id}`}>{claim.domain}</Badge>}
 {(claim.applicableTags ?? []).map((tag) => (
 <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
 ))}
 {(claim.phrasingVariants ?? []).length > 0 && (
 <Badge variant="outline" className="text-xs text-muted-foreground">
 {claim.phrasingVariants.length} variant{claim.phrasingVariants.length > 1 ? "s" : ""}
 </Badge>
 )}
 </div>
 {claim.evidence && (
 <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-claim-evidence-${claim.id}`}>
 {claim.evidence}
 </p>
 )}
 </div>
 <div className="flex items-center gap-1 shrink-0">
 <Switch
 checked={claim.isActive}
 onCheckedChange={() => handleToggleActive(claim)}
 data-testid={`switch-active-${claim.id}`}
 className="mr-1"
 />
 <Button variant="ghost" size="icon" onClick={() => handleEdit(claim)} data-testid={`btn-edit-claim-${claim.id}`}>
 <Pencil className="h-4 w-4 text-muted-foreground" />
 </Button>
 <Button variant="ghost" size="icon" onClick={() => handleDelete(claim.id)} data-testid={`btn-delete-claim-${claim.id}`}>
 <Trash2 className="h-4 w-4 text-destructive" />
 </Button>
 </div>
 </div>
 </CardContent>
 </ContentCard>
 ))
 )}
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
 return value
 .split(",")
 .map((item) => item.trim())
 .filter(Boolean);
}
