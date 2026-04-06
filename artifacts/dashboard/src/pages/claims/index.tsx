import { useListClaims, useCreateClaim, useUpdateClaim, useDeleteClaim, getListClaimsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckSquare, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const claimSchema = z.object({
  summary: z.string().min(1, "Summary is required"),
  domain: z.string().optional(),
  evidence: z.string().optional(),
});

export default function ClaimsPage() {
  const { data: claims, isLoading } = useListClaims();
  const createClaim = useCreateClaim();
  const updateClaim = useUpdateClaim();
  const deleteClaim = useDeleteClaim();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof claimSchema>>({
    resolver: zodResolver(claimSchema),
    defaultValues: {
      summary: "",
      domain: "",
      evidence: "",
    },
  });

  const onSubmit = (data: z.infer<typeof claimSchema>) => {
    if (editingId) {
      updateClaim.mutate(
        { id: editingId, data },
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
        { data },
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

  const handleEdit = (claim: any) => {
    setEditingId(claim.id);
    form.reset({
      summary: claim.summary,
      domain: claim.domain || "",
      evidence: claim.evidence || "",
    });
    setIsDialogOpen(true);
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
    form.reset({ summary: "", domain: "", evidence: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Claims Ledger</h1>
          <p className="text-muted-foreground mt-1">Manage verified achievements and skills used for tailoring.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setIsDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button data-testid="btn-add-claim">
              <Plus className="mr-2 h-4 w-4" />
              New Claim
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Claim" : "Create New Claim"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                <FormField
                  control={form.control}
                  name="domain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Domain</FormLabel>
                      <FormControl>
                        <Input placeholder="Engineering, Leadership, etc." {...field} data-testid="input-claim-domain" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="evidence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Evidence / Context</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Link to project, metrics, or detailed notes..." {...field} data-testid="input-claim-evidence" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createClaim.isPending || updateClaim.isPending} data-testid="btn-submit-claim">
                    {editingId ? "Update Claim" : "Create Claim"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
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
            <h3 className="text-lg font-medium">No claims yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Add your achievements and skills to serve as the ground truth for AI tailoring.
            </p>
          </Card>
        ) : (
          claims?.map((claim) => (
            <Card key={claim.id} data-testid={`card-claim-${claim.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="font-medium text-lg" data-testid={`text-claim-summary-${claim.id}`}>{claim.summary}</p>
                    <div className="flex gap-2 text-sm text-muted-foreground">
                      {claim.domain && <Badge variant="secondary" data-testid={`badge-claim-domain-${claim.id}`}>{claim.domain}</Badge>}
                    </div>
                    {claim.evidence && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2" data-testid={`text-claim-evidence-${claim.id}`}>
                        {claim.evidence}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
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
