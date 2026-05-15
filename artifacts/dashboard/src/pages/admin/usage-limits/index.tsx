import { useState, useEffect, useCallback } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Pencil, AlertTriangle } from "lucide-react";

interface UsageRecord {
 limit: {
 id: number;
 userId: number;
 weeklyLimit: number;
 weeklyUsed: number;
 totalUsed: number;
 periodStart: string;
 };
 username: string;
 email: string;
}

export default function AdminUsageLimitsPage() {
 const { user } = useAuth();
 const [users, setUsers] = useState<UsageRecord[]>([]);
 const [loading, setLoading] = useState(true);
 const [editUser, setEditUser] = useState<UsageRecord | null>(null);
 const [newLimit, setNewLimit] = useState(5);
 const [saving, setSaving] = useState(false);

 const fetchUsers = useCallback(async () => {
 try {
 const res = await fetch("/api/usage-limits", { credentials: "include" });
 if (res.ok) {
 const data = await res.json() as UsageRecord[];
 setUsers(data);
 }
 } catch {
 toast({ title: "Failed to load usage data", variant: "destructive" });
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => { fetchUsers(); }, [fetchUsers]);

 async function handleSaveLimit() {
 if (!editUser) return;
 setSaving(true);
 try {
 const res = await fetch(`/api/usage-limits/${editUser.limit.userId}`, {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ weeklyLimit: newLimit }),
 });
 if (!res.ok) throw new Error("Failed");
 toast({ title: "Usage limit updated" });
 fetchUsers();
 setEditUser(null);
 } catch {
 toast({ title: "Failed to update", variant: "destructive" });
 } finally {
 setSaving(false);
 }
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
 title="Usage Limits"
 subtitle="Configure AI usage quotas and rate limits per user role."
 variant="admin"
 />

 <ContentCard>
 <CardContent>
 {loading ? (
 <div>Loading...</div>
 ) : users.length === 0 ? (
 <div>No users have usage limits yet. Limits are created when a user registers.</div>
 ) : (
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>User</TableHead>
 <TableHead>Weekly</TableHead>
 <TableHead>Remaining</TableHead>
 <TableHead>Total Used</TableHead>
 <TableHead>Period</TableHead>
 <TableHead>Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {users.map((row) => {
 const remaining = row.limit.weeklyLimit - row.limit.weeklyUsed;
 const low = remaining <= 1;
 return (
 <TableRow key={row.limit.id}>
 <TableCell>
 <p>{row.username}</p>
 <p>{row.email}</p>
 </TableCell>
 <TableCell>{row.limit.weeklyUsed} / {row.limit.weeklyLimit}</TableCell>
 <TableCell>
 {low ? (
 <Badge variant="destructive"><AlertTriangle /> {remaining}</Badge>
 ) : (
 <span>{remaining}</span>
 )}
 </TableCell>
 <TableCell>{row.limit.totalUsed}</TableCell>
 <TableCell>
 {new Date(row.limit.periodStart).toLocaleDateString()}
 </TableCell>
 <TableCell>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => {
 setEditUser(row);
 setNewLimit(row.limit.weeklyLimit);
 }}
 >
 <Pencil />
 </Button>
 </TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 )}
 </CardContent>
 </ContentCard>

 <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Edit Usage Limit</DialogTitle>
 </DialogHeader>
 {editUser && (
 <div>
 <p>
 <strong>{editUser.username}</strong> ({editUser.email})
 </p>
 <div>
 <Label htmlFor="weeklyLimit">Weekly AI Request Limit</Label>
 <Input
 id="weeklyLimit"
 type="number"
 value={newLimit}
 onChange={(e) => setNewLimit(Number(e.target.value) || 0)}
 min={0}
 />
 </div>
 <p>
 Current: {editUser.limit.weeklyUsed} used this week, {editUser.limit.totalUsed} total all time.
 </p>
 </div>
 )}
 <DialogFooter>
  <Button variant="ghost" onClick={() => setEditUser(null)}>Cancel</Button>
  <Button variant="primary" onClick={handleSaveLimit} disabled={saving}>
 {saving ? "Saving..." : "Save"}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
