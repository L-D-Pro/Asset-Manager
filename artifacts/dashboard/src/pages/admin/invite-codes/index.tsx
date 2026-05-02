import { useState, useEffect, useCallback } from "react";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from "@/components/ui/dialog";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth";
import { Ticket, Plus, Trash2, Copy, CheckCircle, XCircle, Clock } from "lucide-react";

interface InviteCode {
 id: number;
 code: string;
 maxUses: number;
 usedCount: number;
 expiresAt: string;
 isActive: boolean;
 createdAt: string;
}

export default function AdminInviteCodesPage() {
 const { user } = useAuth();
 const [codes, setCodes] = useState<InviteCode[]>([]);
 const [loading, setLoading] = useState(true);
 const [showGenerate, setShowGenerate] = useState(false);
 const [maxUses, setMaxUses] = useState(50);
 const [expiresInDays, setExpiresInDays] = useState(30);
 const [generating, setGenerating] = useState(false);
 const [newCode, setNewCode] = useState<string | null>(null);

 const fetchCodes = useCallback(async () => {
 try {
 const res = await fetch("/api/invite-codes", { credentials: "include" });
 if (res.ok) {
 const data = await res.json() as InviteCode[];
 setCodes(data);
 }
 } catch {
 toast({ title: "Failed to load invite codes", variant: "destructive" });
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => { fetchCodes(); }, [fetchCodes]);

 async function handleGenerate() {
 setGenerating(true);
 try {
 const res = await fetch("/api/invite-codes", {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ maxUses, expiresInDays }),
 });
 if (!res.ok) {
 const err = await res.json() as { error: string };
 throw new Error(err.error ?? "Generation failed");
 }
 const code = await res.json() as InviteCode;
 setNewCode(code.code);
 toast({ title: "Invite code created" });
 fetchCodes();
 setShowGenerate(false);
 } catch (err) {
 toast({ title: "Failed to generate", description: err instanceof Error ? err.message : "", variant: "destructive" });
 } finally {
 setGenerating(false);
 }
 }

 async function handleRevoke(id: number) {
 try {
 const res = await fetch(`/api/invite-codes/${id}`, {
 method: "DELETE",
 credentials: "include",
 });
 if (!res.ok) throw new Error("Failed");
 toast({ title: "Invite code revoked" });
 fetchCodes();
 } catch {
 toast({ title: "Failed to revoke", variant: "destructive" });
 }
 }

 function copyToClipboard(text: string) {
 navigator.clipboard.writeText(text).then(() => {
 toast({ title: "Copied to clipboard" });
 });
 }

 if (user?.role !== "admin") {
 return (
 <ContentCard>
 <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
 </ContentCard>
 );
 }

 return (
 <div className="space-y-8">
 <PageHeader
 title="Invite Codes"
 subtitle="Generate and manage invite codes for new user registration."
 variant="admin"
 >
 <Button onClick={() => setShowGenerate(true)} disabled={codes.length >= 10} className="btn-primary">
 <Plus className="h-4 w-4 mr-2" />
 Generate Code
 </Button>
 </PageHeader>

 {newCode && (
 <ContentCard className="border-success rounded-2xl">
 <CardContent className="pt-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm font-medium">New Invite Code</p>
 <p className="text-2xl font-mono font-bold tracking-wider text-primary">{newCode}</p>
 </div>
 <div className="flex gap-2">
 <Button variant="outline" size="sm" onClick={() => copyToClipboard(newCode)}>
 <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
 </Button>
 <Button variant="ghost" size="sm" onClick={() => setNewCode(null)}>Dismiss</Button>
 </div>
 </div>
 </CardContent>
 </ContentCard>
 )}

 <ContentCard className="rounded-2xl">
 <CardContent className="p-0">
 {loading ? (
 <div className="p-8 text-center text-muted-foreground">Loading...</div>
 ) : codes.length === 0 ? (
 <div className="p-8 text-center text-muted-foreground">No invite codes yet. Generate one to get started.</div>
 ) : (
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Code</TableHead>
 <TableHead>Uses</TableHead>
 <TableHead>Expires</TableHead>
 <TableHead>Status</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {codes.map((code) => (
 <TableRow key={code.id}>
 <TableCell className="font-mono font-medium">{code.code}</TableCell>
 <TableCell>{code.usedCount} / {code.maxUses}</TableCell>
 <TableCell className="text-xs">{new Date(code.expiresAt).toLocaleDateString()}</TableCell>
 <TableCell>
 {code.isActive && new Date(code.expiresAt) > new Date() ? (
 <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" /> Active</Badge>
 ) : code.isActive ? (
 <Badge variant="destructive"><Clock className="h-3 w-3 mr-1" /> Expired</Badge>
 ) : (
 <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" /> Revoked</Badge>
 )}
 </TableCell>
 <TableCell className="text-right">
 <div className="flex justify-end gap-1">
 <Button variant="ghost" size="sm" onClick={() => copyToClipboard(code.code)}>
 <Copy className="h-3.5 w-3.5" />
 </Button>
 {code.isActive && (
 <Button variant="ghost" size="sm" onClick={() => handleRevoke(code.id)}>
 <Trash2 className="h-3.5 w-3.5 text-destructive" />
 </Button>
 )}
 </div>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 )}
 </CardContent>
 </ContentCard>

 <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
 <DialogContent className="rounded-2xl">
 <DialogHeader>
 <DialogTitle>Generate Invite Code</DialogTitle>
 </DialogHeader>
 <div className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="maxUses">Max Uses</Label>
 <Input
 id="maxUses"
 type="number"
 value={maxUses}
 onChange={(e) => setMaxUses(Number(e.target.value) || 1)}
 min={1}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="expiresIn">Expires In (days)</Label>
 <Input
 id="expiresIn"
 type="number"
 value={expiresInDays}
 onChange={(e) => setExpiresInDays(Number(e.target.value) || 1)}
 min={1}
 />
 </div>
 </div>
 <DialogFooter>
 <Button className="btn-ghost" onClick={() => setShowGenerate(false)}>Cancel</Button>
 <Button onClick={handleGenerate} disabled={generating} className="btn-primary">
 {generating ? "Generating..." : "Generate"}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
