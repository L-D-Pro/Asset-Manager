import { useListClaims, useCreateClaim, useUpdateClaim, useDeleteClaim, getListClaimsQueryKey, type Claim } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckSquare, Pencil, Trash2, EyeOff, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
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
        }
      );
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    form.reset({ summary: "", domain: "", evidence: "", isActive: true, phrasingVariants: [], applicableTags: [] });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Claims Ledger</h1>
          <p className="text-muted-foreground mt-1">Verified achievements that serve as ground truth for AI tailoring.</p>
        </div>

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
                    <FormLabel>Phrasing Variants</FormLabel>
                    <Button type="button" variant="outline" size="sm" onClick={() => pvAppend({ text: "" })} data-testid="btn-add-variant">
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                  <FormDescription className="text-xs mb-2">Alternative wordings used by the AI when the primary summary doesn't fit.</FormDescription>
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
                    <FormLabel>Applicable Tags</FormLabel>
                    <Button type="button" variant="outline" size="sm" onClick={() => tagAppend({ tag: "" })} data-testid="btn-add-tag">
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                  <FormDescription className="text-xs mb-2">Domain tags used for filtering and matching (e.g. "distributed-systems", "leadership").</FormDescription>
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
      </div>

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
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <CheckSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No claims</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {filter === "inactive" ? "No inactive claims." : filter === "all" ? "Add your first claim to get started." : "No active claims — all may be deactivated."}
            </p>
          </Card>
        ) : (
          claims?.map((claim) => (
            <Card key={claim.id} data-testid={`card-claim-${claim.id}`} className={!claim.isActive ? "opacity-60" : ""}>
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
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
