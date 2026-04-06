import { useListRoleProfiles, useCreateRoleProfile, useUpdateRoleProfile, useDeleteRoleProfile, getListRoleProfilesQueryKey, type RoleProfile } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserCircle, Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export default function RoleProfilesPage() {
  const { data: profiles, isLoading } = useListRoleProfiles();
  const createProfile = useCreateRoleProfile();
  const updateProfile = useUpdateRoleProfile();
  const deleteProfile = useDeleteRoleProfile();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", description: "" },
  });

  const onSubmit = (data: z.infer<typeof profileSchema>) => {
    if (editingId) {
      updateProfile.mutate({ id: editingId, data }, {
        onSuccess: () => {
          toast({ title: "Profile updated" });
          handleClose();
          queryClient.invalidateQueries({ queryKey: getListRoleProfilesQueryKey() });
        }
      });
    } else {
      createProfile.mutate({ data }, {
        onSuccess: () => {
          toast({ title: "Profile created" });
          handleClose();
          queryClient.invalidateQueries({ queryKey: getListRoleProfilesQueryKey() });
        }
      });
    }
  };

  const handleEdit = (p: RoleProfile) => {
    setEditingId(p.id);
    form.reset({ name: p.name, description: p.description || "" });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if(confirm("Delete profile?")) {
      deleteProfile.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListRoleProfilesQueryKey() })
      });
    }
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    form.reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Role Profiles</h1>
          <p className="text-muted-foreground mt-1">Manage target role profiles for scoring.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) handleClose(); else setIsDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button data-testid="btn-add-profile"><Plus className="mr-2 h-4 w-4"/>New Profile</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit Profile" : "New Profile"}</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({field}) => (
                  <FormItem><FormLabel>Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-profile-name"/></FormControl></FormItem>
                )}/>
                <FormField control={form.control} name="description" render={({field}) => (
                  <FormItem><FormLabel>Description</FormLabel>
                  <FormControl><Input {...field} data-testid="input-profile-desc"/></FormControl></FormItem>
                )}/>
                <Button type="submit" className="w-full" data-testid="btn-submit-profile">Save Profile</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {profiles?.map(p => (
            <Card key={p.id}>
              <CardContent className="p-6 flex justify-between items-start">
                <div>
                  <div className="font-semibold text-lg">{p.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">{p.description || "No description"}</div>
                </div>
                <div className="flex">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}><Pencil className="h-4 w-4"/></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
