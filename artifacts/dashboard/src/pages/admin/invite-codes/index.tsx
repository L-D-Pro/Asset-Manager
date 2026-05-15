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
 <div>
 <PageHeader
 title="Invite Codes"
 subtitle="Generate and manage invite codes for new user registration."
 variant="admin"
 >
  <Button onClick={() => setShowGenerate(true)} disabled={codes.length >= 10}>
  <Plus />
  Generate Code
  </Button>
 </PageHeader>

 {newCode && (
  <ContentCard>
  <CardContent>
 <div>
 <div>
 <p>New Invite Code</p>
 <p>{newCode}</p>
 </div>
 <div>
 <Button variant="outline" size="sm" onClick={() => copyToClipboard(newCode)}>
 <Copy /> Copy
 </Button>
 <Button variant="ghost" size="sm" onClick={() => setNewCode(null)}>Dismiss</Button>
 </div>
 </div>
 </CardContent>
 </ContentCard>
 )}

  <ContentCard>
  <CardContent>
 {loading ? (
 <div>Loading...</div>
 ) : codes.length === 0 ? (
 <div>No invite codes yet. Generate one to get started.</div>
 ) : (
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Code</TableHead>
 <TableHead>Uses</TableHead>
 <TableHead>Expires</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {codes.map((code) => (
 <TableRow key={code.id}>
 <TableCell>{code.code}</TableCell>
 <TableCell>{code.usedCount} / {code.maxUses}</TableCell>
 <TableCell>{new Date(code.expiresAt).toLocaleDateString()}</TableCell>
 <TableCell>
 {code.isActive && new Date(code.expiresAt) > new Date() ? (
 <Badge variant="default"><CheckCircle /> Active</Badge>
 ) : code.isActive ? (
 <Badge variant="destructive"><Clock /> Expired</Badge>
 ) : (
 <Badge variant="outline"><XCircle /> Revoked</Badge>
 )}
 </TableCell>
 <TableCell>
 <div>
 <Button variant="ghost" size="sm" onClick={() => copyToClipboard(code.code)}>
 <Copy />
 </Button>
 {code.isActive && (
 <Button variant="ghost" size="sm" onClick={() => handleRevoke(code.id)}>
 <Trash2 />
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
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Generate Invite Code</DialogTitle>
 </DialogHeader>
 <div>
 <div>
 <Label htmlFor="maxUses">Max Uses</Label>
 <Input
 id="maxUses"
 type="number"
 value={maxUses}
 onChange={(e) => setMaxUses(Number(e.target.value) || 1)}
 min={1}
 />
 </div>
 <div>
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
  <Button variant="ghost" onClick={() => setShowGenerate(false)}>Cancel</Button>
  <Button onClick={handleGenerate} disabled={generating}>
  {generating ? "Generating..." : "Generate"}
  </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
