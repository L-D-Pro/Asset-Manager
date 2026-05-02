import { useListRoleProfiles, useCreateRoleProfile, useUpdateRoleProfile, useDeleteRoleProfile, getListRoleProfilesQueryKey, type RoleProfile } from "@workspace/api-client-react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Filter, Scale } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/api-errors";

const softWeightEntrySchema = z.object({
 keyword: z.string().min(1),
 weight: z.coerce.number().min(0).max(10),
});

const profileSchema = z.object({
 name: z.string().min(1, "Name is required"),
 description: z.string().optional(),
 hardFilters: z.object({
 requiredKeywords: z.string().optional(),
 blockedKeywords: z.string().optional(),
 minSalary: z.coerce.number().min(0).optional(),
 }).optional(),
 softWeights: z.array(softWeightEntrySchema).optional(),
});

type FormValues = z.infer<typeof profileSchema>;

function splitKeywords(s: string | undefined): string[] {
 if (!s) return [];
 return s.split(",").map(k => k.trim()).filter(Boolean);
}

function joinKeywords(arr: string[] | undefined): string {
 if (!arr) return "";
 return arr.join(", ");
}

function toSoftWeightsArray(obj: Record<string, number> | undefined): { keyword: string; weight: number }[] {
 if (!obj) return [];
 return Object.entries(obj).map(([keyword, weight]) => ({ keyword, weight }));
}

function fromSoftWeightsArray(arr: { keyword: string; weight: number }[]): Record<string, number> {
 const out: Record<string, number> = {};
 for (const { keyword, weight } of arr) {
 if (keyword.trim()) out[keyword.trim()] = weight;
 }
 return out;
}

export default function RoleProfilesPage() {
 const { data: profiles, isLoading } = useListRoleProfiles();
 const createProfile = useCreateRoleProfile();
 const updateProfile = useUpdateRoleProfile();
 const deleteProfile = useDeleteRoleProfile();
 
 const [isDialogOpen, setIsDialogOpen] = useState(false);
 const [editingId, setEditingId] = useState<number | null>(null);
 const { toast } = useToast();
 const queryClient = useQueryClient();

 const form = useForm<FormValues>({
 resolver: zodResolver(profileSchema),
 defaultValues: {
 name: "",
 description: "",
 hardFilters: { requiredKeywords: "", blockedKeywords: "", minSalary: 0 },
 softWeights: [],
 },
 });

 const { fields: swFields, append: swAppend, remove: swRemove } = useFieldArray({
 control: form.control,
 name: "softWeights",
 });

 const buildPayload = (data: FormValues) => {
 const hardFilters: Record<string, unknown> = {};
 const hf = data.hardFilters;
 if (hf) {
 const req = splitKeywords(hf.requiredKeywords);
 const blk = splitKeywords(hf.blockedKeywords);
 if (req.length) hardFilters.requiredKeywords = req;
 if (blk.length) hardFilters.blockedKeywords = blk;
 if (hf.minSalary && hf.minSalary > 0) hardFilters.minSalary = hf.minSalary;
 }
 const softWeights = fromSoftWeightsArray(data.softWeights ?? []);
 return {
 name: data.name,
 description: data.description,
 hardFilters: Object.keys(hardFilters).length ? hardFilters : undefined,
 softWeights: Object.keys(softWeights).length ? softWeights : undefined,
 };
 };

 const onSubmit = (data: FormValues) => {
 const payload = buildPayload(data);
 if (editingId) {
 updateProfile.mutate({ id: editingId, data: payload }, {
 onSuccess: () => {
 toast({ title: "Profile updated" });
 handleClose();
 queryClient.invalidateQueries({ queryKey: getListRoleProfilesQueryKey() });
 },
 onError: (error) =>
 toast({
 title: "Failed to update role profile",
 description: getErrorMessage(error, "Please try again."),
 variant: "destructive",
 }),
 });
 } else {
 createProfile.mutate({ data: payload }, {
 onSuccess: () => {
 toast({ title: "Profile created" });
 handleClose();
 queryClient.invalidateQueries({ queryKey: getListRoleProfilesQueryKey() });
 },
 onError: (error) =>
 toast({
 title: "Failed to create role profile",
 description: getErrorMessage(error, "Please try again."),
 variant: "destructive",
 }),
 });
 }
 };

 const handleEdit = (p: RoleProfile) => {
 setEditingId(p.id);
 const hf = p.hardFilters as Record<string, unknown> | undefined;
 form.reset({
 name: p.name,
 description: p.description || "",
 hardFilters: {
 requiredKeywords: joinKeywords(hf?.requiredKeywords as string[] | undefined),
 blockedKeywords: joinKeywords(hf?.blockedKeywords as string[] | undefined),
 minSalary: (hf?.minSalary as number) || 0,
 },
 softWeights: toSoftWeightsArray(p.softWeights as Record<string, number> | undefined),
 });
 setIsDialogOpen(true);
 };

 const handleDelete = (id: number) => {
 if(confirm("Delete this role profile?")) {
 deleteProfile.mutate({ id }, {
 onSuccess: () => queryClient.invalidateQueries({ queryKey: getListRoleProfilesQueryKey() }),
 onError: (error) =>
 toast({
 title: "Failed to delete role profile",
 description: getErrorMessage(error, "Please try again."),
 variant: "destructive",
 }),
 });
 }
 };

 const handleClose = () => {
 setIsDialogOpen(false);
 setEditingId(null);
 form.reset();
 };

 const renderHardFilters = (p: RoleProfile) => {
 const hf = p.hardFilters as Record<string, unknown> | undefined;
 if (!hf || !Object.keys(hf).length) return null;
 const req = hf.requiredKeywords as string[] | undefined;
 const blk = hf.blockedKeywords as string[] | undefined;
 const minSal = hf.minSalary as number | undefined;
 return (
 <div className="space-y-1.5">
 {req && req.length > 0 && (
 <div className="flex flex-wrap gap-1 items-center">
 <span className="text-xs text-muted-foreground mr-1">Required:</span>
 {req.map(k => <Badge key={k} variant="secondary" className="text-xs">{k}</Badge>)}
 </div>
 )}
 {blk && blk.length > 0 && (
 <div className="flex flex-wrap gap-1 items-center">
 <span className="text-xs text-muted-foreground mr-1">Blocked:</span>
 {blk.map(k => <Badge key={k} variant="destructive" className="text-xs">{k}</Badge>)}
 </div>
 )}
 {minSal ? (
 <div className="text-xs text-muted-foreground">Min salary: ${minSal.toLocaleString()}</div>
 ) : null}
 </div>
 );
 };

 const renderSoftWeights = (p: RoleProfile) => {
 const sw = p.softWeights as Record<string, number> | undefined;
 if (!sw || !Object.keys(sw).length) return null;
 const sorted = Object.entries(sw).sort(([, a], [, b]) => b - a);
 return (
 <div className="flex flex-wrap gap-1.5">
 {sorted.map(([keyword, weight]) => (
 <span key={keyword} className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary rounded px-1.5 py-0.5">
 {keyword} <span className="font-semibold">{weight}</span>
 </span>
 ))}
 </div>
 );
 };

 return (
 <div className="space-y-6">
 <PageHeader
 title="Role Profiles"
 subtitle="Define target roles with skills, keywords, and preferences for AI tailoring."
 variant="workflow"
 >
 <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) handleClose(); else setIsDialogOpen(true); }}>
 <DialogTrigger asChild>
 <Button data-testid="btn-add-profile"><Plus className="mr-2 h-4 w-4"/>New Profile</Button>
 </DialogTrigger>
 <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>{editingId ? "Edit Role Profile" : "New Role Profile"}</DialogTitle>
 <DialogDescription>
 Define the hard filters and soft skill weights used to score jobs.
 </DialogDescription>
 </DialogHeader>
 <Form {...form}>
 <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
 <FormField control={form.control} name="name" render={({field}) => (
 <FormItem>
 <FormLabel>Name</FormLabel>
 <FormControl><Input {...field} placeholder="Senior Backend Engineer" data-testid="input-profile-name"/></FormControl>
 <FormMessage />
 </FormItem>
 )}/>
 <FormField control={form.control} name="description" render={({field}) => (
 <FormItem>
 <FormLabel>Description</FormLabel>
 <FormControl><Textarea {...field} placeholder="Target roles in distributed systems..." data-testid="input-profile-desc"/></FormControl>
 <FormMessage />
 </FormItem>
 )}/>

 <Separator />
 <div>
 <div className="flex items-center gap-2 mb-3">
 <Filter className="h-4 w-4 text-muted-foreground" />
 <h3 className="font-semibold text-sm">Hard Filters</h3>
 </div>
 <div className="space-y-4">
 <FormField control={form.control} name="hardFilters.requiredKeywords" render={({field}) => (
 <FormItem>
 <FormLabel>Required Keywords (comma-separated)</FormLabel>
 <FormControl><Input {...field} placeholder="Python, Kubernetes, AWS" data-testid="input-required-kw"/></FormControl>
 <FormDescription>Jobs missing any of these keywords are disqualified.</FormDescription>
 </FormItem>
 )}/>
 <FormField control={form.control} name="hardFilters.blockedKeywords" render={({field}) => (
 <FormItem>
 <FormLabel>Blocked Keywords (comma-separated)</FormLabel>
 <FormControl><Input {...field} placeholder="PHP, Cobol" data-testid="input-blocked-kw"/></FormControl>
 <FormDescription>Jobs containing any of these keywords are disqualified.</FormDescription>
 </FormItem>
 )}/>
 <FormField control={form.control} name="hardFilters.minSalary" render={({field}) => (
 <FormItem>
 <FormLabel>Minimum Salary ($)</FormLabel>
 <FormControl><Input type="number" {...field} data-testid="input-min-salary"/></FormControl>
 <FormDescription>Jobs with max salary below this value are disqualified.</FormDescription>
 </FormItem>
 )}/>
 </div>
 </div>

 <Separator />
 <div>
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <Scale className="h-4 w-4 text-muted-foreground" />
 <h3 className="font-semibold text-sm">Soft Skill Weights</h3>
 </div>
 <Button type="button" variant="outline" size="sm" onClick={() => swAppend({ keyword: "", weight: 5 })} data-testid="btn-add-weight">
 <Plus className="h-3 w-3 mr-1" /> Add
 </Button>
 </div>
 <p className="text-xs text-muted-foreground mb-3">Each keyword matched in the JD increases the soft score. Weight 0–10.</p>
 <div className="space-y-2">
 {swFields.map((field, i) => (
 <div key={field.id} className="flex items-center gap-2">
 <FormField control={form.control} name={`softWeights.${i}.keyword`} render={({field: f}) => (
 <FormItem className="flex-1 mb-0">
 <FormControl><Input {...f} placeholder="keyword" data-testid={`input-sw-keyword-${i}`}/></FormControl>
 </FormItem>
 )}/>
 <FormField control={form.control} name={`softWeights.${i}.weight`} render={({field: f}) => (
 <FormItem className="w-20 mb-0">
 <FormControl><Input type="number" min={0} max={10} {...f} data-testid={`input-sw-weight-${i}`}/></FormControl>
 </FormItem>
 )}/>
 <Button type="button" variant="ghost" size="icon" onClick={() => swRemove(i)} data-testid={`btn-remove-sw-${i}`}>
 <Trash2 className="h-4 w-4 text-destructive" />
 </Button>
 </div>
 ))}
 {swFields.length === 0 && (
 <p className="text-xs text-muted-foreground italic">No weights configured yet.</p>
 )}
 </div>
 </div>

 <Button type="submit" className="w-full" disabled={createProfile.isPending || updateProfile.isPending} data-testid="btn-submit-profile">
 {editingId ? "Update Profile" : "Create Profile"}
 </Button>
 </form>
 </Form>
 </DialogContent>
 </Dialog>
 </PageHeader>

 {isLoading ? <Skeleton className="h-40 w-full" /> : profiles?.length === 0 ? (
  <div className="card-glass flex flex-col items-center justify-center p-12 text-center">
  <UserCircle className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
  <h3 className="text-lg font-medium text-foreground">No role profiles yet</h3>
  <p className="text-sm text-muted-foreground mt-1">Create a profile to define scoring criteria for your target roles.</p>
  </div>
 ) : (
 <div className="grid gap-4 md:grid-cols-2">
 {profiles?.map(p => {
 const hasHardFilters = !!(p.hardFilters && Object.keys(p.hardFilters).length);
 const hasSoftWeights = !!(p.softWeights && Object.keys(p.softWeights).length);
 return (
  <div key={p.id} data-testid={`card-profile-${p.id}`} className="card-glass rounded-2xl overflow-hidden">
  <div className="p-0">
 <div className="p-5 flex justify-between items-start">
 <div className="flex-1">
 <div className="font-semibold text-lg">{p.name}</div>
 {p.description && <div className="text-sm text-muted-foreground mt-0.5">{p.description}</div>}
 <div className="flex gap-2 mt-2">
 {hasHardFilters && <Badge variant="outline" className="text-xs flex items-center gap-1"><Filter className="h-2.5 w-2.5"/>Hard Filters</Badge>}
 {hasSoftWeights && <Badge variant="outline" className="text-xs flex items-center gap-1"><Scale className="h-2.5 w-2.5"/>Soft Weights</Badge>}
 </div>
 </div>
 <div className="flex shrink-0">
 <Button variant="ghost" size="icon" onClick={() => handleEdit(p)} data-testid={`btn-edit-profile-${p.id}`}><Pencil className="h-4 w-4"/></Button>
 <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} data-testid={`btn-delete-profile-${p.id}`}><Trash2 className="h-4 w-4 text-destructive"/></Button>
 </div>
 </div>
 {(hasHardFilters || hasSoftWeights) && (
 <Accordion type="single" collapsible>
 {hasHardFilters && (
 <AccordionItem value="hf" className="border-t border-b-0 ">
 <AccordionTrigger className="px-5 py-2 text-xs font-semibold hover:no-underline">
 Hard Filters
 </AccordionTrigger>
 <AccordionContent className="px-5 pb-4">
 {renderHardFilters(p)}
 </AccordionContent>
 </AccordionItem>
 )}
 {hasSoftWeights && (
 <AccordionItem value="sw" className="border-t border-b-0 ">
 <AccordionTrigger className="px-5 py-2 text-xs font-semibold hover:no-underline">
 Soft Weights
 </AccordionTrigger>
 <AccordionContent className="px-5 pb-4">
 {renderSoftWeights(p)}
 </AccordionContent>
 </AccordionItem>
 )}
 </Accordion>
 )}
  </div>
  </div>
 );
 })}
 </div>
 )}
 </div>
 );
}
