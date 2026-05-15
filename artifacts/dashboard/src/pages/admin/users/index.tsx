import { useState, useEffect, useCallback } from "react";

import { useAuth } from "@/context/auth";
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
 DialogDescription,
 DialogFooter,
} from "@/components/ui/dialog";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

import {
 Users,
 Plus,
 Pencil,
 Trash2,
 Copy,
 RefreshCw,
 Eye,
 EyeOff,
 Shield,
 User,
 Loader2,
 Search,
} from "lucide-react";

interface UserRecord {
 id: number;
 username: string;
 firstName: string | null;
 lastName: string | null;
 email: string;
 role: string;
 createdAt: string;
 updatedAt: string;
}



function generatePassword(length = 16): string {
 const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_+=";
 const buf = new Uint32Array(length);
 crypto.getRandomValues(buf);
 let password = "";
 for (let i = 0; i < length; i++) {
 password += charset.charAt(buf[i]! % charset.length);
 }
 return password;
}

export default function AdminUsersPage() {
 const { user: currentUser } = useAuth();
 const [users, setUsers] = useState<UserRecord[]>([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState("");

 const [dialogOpen, setDialogOpen] = useState(false);
 const [editingUser, setEditingUser] = useState<UserRecord | null>(null);

 const [form, setForm] = useState({
 username: "",
 firstName: "",
 lastName: "",
 email: "",
 role: "user",
 });
 const [generatedPassword, setGeneratedPassword] = useState("");
 const [showPassword, setShowPassword] = useState(false);
 const [saving, setSaving] = useState(false);

 const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
 const [userToDelete, setUserToDelete] = useState<UserRecord | null>(null);
 const [deleting, setDeleting] = useState(false);

 const fetchUsers = useCallback(async () => {
 setLoading(true);
 try {
 const res = await fetch("/api/users", { credentials: "include" });
 if (!res.ok) throw new Error("Failed to fetch users");
 const data = await res.json() as UserRecord[];
 setUsers(data);
 } catch (err) {
 toast({
 title: "Error",
 description: err instanceof Error ? err.message : "Could not load users",
 variant: "destructive",
 });
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 void fetchUsers();
 }, [fetchUsers]);

 const openAdd = () => {
 setEditingUser(null);
 const pwd = generatePassword();
 setGeneratedPassword(pwd);
 setShowPassword(false);
 setForm({ username: "", firstName: "", lastName: "", email: "", role: "user" });
 setDialogOpen(true);
 };

 const openEdit = (u: UserRecord) => {
 setEditingUser(u);
 setGeneratedPassword("");
 setShowPassword(false);
 setForm({
 username: u.username,
 firstName: u.firstName ?? "",
 lastName: u.lastName ?? "",
 email: u.email,
 role: u.role,
 });
 setDialogOpen(true);
 };

 const regeneratePassword = () => {
 setGeneratedPassword(generatePassword());
 setShowPassword(true);
 };

 const copyPassword = () => {
 if (!generatedPassword) return;
 void navigator.clipboard.writeText(generatedPassword);
 toast({ title: "Copied", description: "Password copied to clipboard" });
 };

 const handleSave = async () => {
 if (!form.username.trim() || !form.email.trim()) {
 toast({ title: "Validation", description: "Username and email are required", variant: "destructive" });
 return;
 }

 setSaving(true);
 try {
 if (editingUser) {
 const res = await fetch(`/api/users/${editingUser.id}`, {
 method: "PUT",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(form),
 });
 if (!res.ok) {
 const err = await res.json() as { error: string };
 throw new Error(err.error ?? "Update failed");
 }
 toast({ title: "Updated", description: "User saved successfully" });
 } else {
 const res = await fetch("/api/users", {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ ...form, password: generatedPassword }),
 });
 if (!res.ok) {
 const err = await res.json() as { error: string };
 throw new Error(err.error ?? "Create failed");
 }
 const data = await res.json() as { generatedPassword?: string };
 if (data.generatedPassword) {
 setGeneratedPassword(data.generatedPassword);
 setShowPassword(true);
 }
 toast({ title: "Created", description: "User created. Copy the password now — it won't be shown again." });
 }
 await fetchUsers();
 if (editingUser) setDialogOpen(false);
 } catch (err) {
 toast({
 title: "Error",
 description: err instanceof Error ? err.message : "Request failed",
 variant: "destructive",
 });
 } finally {
 setSaving(false);
 }
 };

 const handleResetPassword = async () => {
 if (!editingUser) return;
 setSaving(true);
 try {
 const res = await fetch(`/api/users/${editingUser.id}/reset-password`, {
 method: "POST",
 credentials: "include",
 });
 if (!res.ok) {
 const err = await res.json() as { error: string };
 throw new Error(err.error ?? "Reset failed");
 }
 const data = await res.json() as { generatedPassword: string };
 setGeneratedPassword(data.generatedPassword);
 setShowPassword(true);
 toast({ title: "Password Reset", description: "New password generated. Copy it now." });
 } catch (err) {
 toast({
 title: "Error",
 description: err instanceof Error ? err.message : "Reset failed",
 variant: "destructive",
 });
 } finally {
 setSaving(false);
 }
 };

 const confirmDelete = (u: UserRecord) => {
 setUserToDelete(u);
 setDeleteDialogOpen(true);
 };

 const handleDelete = async () => {
 if (!userToDelete) return;
 setDeleting(true);
 try {
 const res = await fetch(`/api/users/${userToDelete.id}`, {
 method: "DELETE",
 credentials: "include",
 });
 if (!res.ok) {
 const err = await res.json() as { error: string };
 throw new Error(err.error ?? "Delete failed");
 }
 toast({ title: "Deleted", description: "User removed" });
 await fetchUsers();
 setDeleteDialogOpen(false);
 setUserToDelete(null);
 } catch (err) {
 toast({
 title: "Error",
 description: err instanceof Error ? err.message : "Delete failed",
 variant: "destructive",
 });
 } finally {
 setDeleting(false);
 }
 };

 const filteredUsers = users.filter((u) => {
 const q = search.toLowerCase();
 return (
 u.username.toLowerCase().includes(q) ||
 (u.firstName?.toLowerCase() ?? "").includes(q) ||
 (u.lastName?.toLowerCase() ?? "").includes(q) ||
 u.email.toLowerCase().includes(q)
 );
 });

 return (
 <div>
 <PageHeader
 title="User Management"
 subtitle="Manage user accounts, roles, and access permissions."
 variant="admin"
 >
  <Button onClick={openAdd}>
  <Plus />
  Add User
  </Button>
 </PageHeader>

 <div>
 <Search />
 <Input
 placeholder="Search by username, name, or email..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 />
  </div>

   <ContentCard>
  <CardHeader>
  <CardTitle>
  <Users />
  All Users ({filteredUsers.length})
 </CardTitle>
 </CardHeader>
 <CardContent>
 {loading ? (
 <div>
 <Loader2 />
 </div>
 ) : filteredUsers.length === 0 ? (
 <div>
 <Users />
 <p>No users found.</p>
 </div>
 ) : (
 <div>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Username</TableHead>
 <TableHead>Name</TableHead>
 <TableHead>Email</TableHead>
 <TableHead>Role</TableHead>
 <TableHead>Created</TableHead>
 <TableHead>Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredUsers.map((u) => (
 <TableRow key={u.id}>
 <TableCell>{u.username}</TableCell>
 <TableCell>
 {u.firstName || u.lastName
 ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
 : "—"}
 </TableCell>
 <TableCell>{u.email}</TableCell>
 <TableCell>
 <Badge
 variant={u.role === "admin" ? "default" : "secondary"}
 >
 {u.role === "admin" ? (
 <Shield />
 ) : (
 <User />
 )}
 {u.role}
 </Badge>
 </TableCell>
 <TableCell>
 {new Date(u.createdAt).toLocaleDateString()}
 </TableCell>
 <TableCell>
 <div>
 <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
 <Pencil />
 </Button>
 <Button
 variant="ghost"
 size="icon"
 onClick={() => confirmDelete(u)}
 disabled={u.id === currentUser?.id}
 >
 <Trash2 />
 </Button>
 </div>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 )}
 </CardContent>
 </ContentCard>

 {/* Add / Edit Dialog */}
 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>{editingUser ? "Edit User" : "Add User"}</DialogTitle>
 <DialogDescription>
 {editingUser
 ? "Update account details or reset the password."
 : "Create a new test user account."}
 </DialogDescription>
 </DialogHeader>

 <div>
 <div>
 <Label htmlFor="username">Username</Label>
 <Input
 id="username"
 value={form.username}
 onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
 placeholder="johndoe"
 disabled={!!editingUser}
 />
 </div>

 <div>
 <div>
 <Label htmlFor="firstName">First Name</Label>
 <Input
 id="firstName"
 value={form.firstName}
 onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
 placeholder="John"
 />
 </div>
 <div>
 <Label htmlFor="lastName">Last Name</Label>
 <Input
 id="lastName"
 value={form.lastName}
 onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
 placeholder="Doe"
 />
 </div>
 </div>

 <div>
 <Label htmlFor="email">Email</Label>
 <Input
 id="email"
 type="email"
 value={form.email}
 onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
 placeholder="john@example.com"
 />
 </div>

 <div>
 <Label htmlFor="role">Role</Label>
 <Select
 value={form.role}
 onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
 >
 <SelectTrigger id="role">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="user">User</SelectItem>
 <SelectItem value="admin">Admin</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {/* Password section */}
 <div>
 <Label>Password</Label>
 {editingUser ? (
 <div>
 <Button
 variant="outline"
 size="sm"
 onClick={handleResetPassword}
 disabled={saving}
 >
 <RefreshCw />
 Reset Password
 </Button>
 </div>
 ) : (
 <div>
 <div>
 <Input
 type={showPassword ? "text" : "password"}
 value={generatedPassword}
 readOnly
 />
 <button
 type="button"
 onClick={() => setShowPassword((s) => !s)}
 >
 {showPassword ? <EyeOff /> : <Eye />}
 </button>
 <button
 type="button"
 onClick={copyPassword}
 title="Copy password"
 >
 <Copy />
 </button>
 </div>
 <Button variant="outline" size="icon" onClick={regeneratePassword} title="Regenerate">
 <RefreshCw />
 </Button>
 </div>
 )}

            {editingUser && generatedPassword && (
            <div>
 <div>
 <div>
 <Input
 type={showPassword ? "text" : "password"}
 value={generatedPassword}
 readOnly
 />
 <button
 type="button"
 onClick={() => setShowPassword((s) => !s)}
 >
 {showPassword ? <EyeOff /> : <Eye />}
 </button>
 <button
 type="button"
 onClick={copyPassword}
 title="Copy password"
 >
 <Copy />
 </button>
 </div>
 </div>
 <p>
 Copy this password now — it won't be shown again.
 </p>
            </div>
            )}
 </div>
 </div>

 <DialogFooter>
  <Button variant="ghost" onClick={() => setDialogOpen(false)}>
  Cancel
  </Button>
  <Button onClick={handleSave} disabled={saving}>
  {saving && <Loader2 />}
  {editingUser ? "Save Changes" : "Create User"}
  </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Delete Confirmation */}
 <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Delete User</DialogTitle>
 <DialogDescription>
 Are you sure you want to delete <strong>{userToDelete?.username}</strong>? This cannot be undone.
 </DialogDescription>
 </DialogHeader>
 <DialogFooter>
  <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
  Cancel
  </Button>
  <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
  {deleting && <Loader2 />}
  Delete
  </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
