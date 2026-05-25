import { useState, useEffect, useCallback } from "react";
import { Portal } from "@/components/ui/portal";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Pencil, Trash2, Copy, RefreshCw, Eye, EyeOff, Shield, User, X } from "lucide-react";

interface UserRecord {
  id: number;
  username: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  createdAt: string;
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
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState({ username: "", firstName: "", lastName: "", email: "", role: "user" });
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      setUsers(await res.json() as UserRecord[]);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Could not load users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  const openAdd = () => {
    setEditingUser(null);
    setGeneratedPassword(generatePassword());
    setShowPassword(false);
    setForm({ username: "", firstName: "", lastName: "", email: "", role: "user" });
    setDialogOpen(true);
  };

  const openEdit = (u: UserRecord) => {
    setEditingUser(u);
    setGeneratedPassword("");
    setShowPassword(false);
    setForm({ username: u.username, firstName: u.firstName ?? "", lastName: u.lastName ?? "", email: u.email, role: u.role });
    setDialogOpen(true);
  };

  const copyPassword = () => {
    if (!generatedPassword) return;
    void navigator.clipboard.writeText(generatedPassword);
    toast({ title: "Copied", description: "Password copied to clipboard" });
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.email.trim()) {
      toast({ title: "Username and email are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingUser) {
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error ?? "Update failed"); }
        toast({ title: "User saved" });
      } else {
        const res = await fetch("/api/users", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, password: generatedPassword }),
        });
        if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error ?? "Create failed"); }
        const data = await res.json() as { generatedPassword?: string };
        if (data.generatedPassword) { setGeneratedPassword(data.generatedPassword); setShowPassword(true); }
        toast({ title: "User created", description: "Copy the password — it won't be shown again." });
      }
      await fetchUsers();
      if (editingUser) setDialogOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}/reset-password`, { method: "POST", credentials: "include" });
      if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error ?? "Reset failed"); }
      const data = await res.json() as { generatedPassword: string };
      setGeneratedPassword(data.generatedPassword);
      setShowPassword(true);
      toast({ title: "Password reset", description: "Copy the new password now." });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Reset failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error ?? "Delete failed"); }
      toast({ title: "User deleted" });
      await fetchUsers();
      setDeleteTarget(null);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Delete failed", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return u.username.toLowerCase().includes(q) || (u.firstName?.toLowerCase() ?? "").includes(q) || (u.lastName?.toLowerCase() ?? "").includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="page fade-up" style={{ maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div className="eyebrow">admin · user management</div>
          <h1 className="h-display" style={{ marginTop: 4 }}>Users <em>· access control</em></h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="search" style={{ minWidth: 240 }}>
            <Search size={13} strokeWidth={1.8} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by username, name, or email…" />
          </div>
          <button className="btn primary" type="button" onClick={openAdd}>
            <Plus size={13} strokeWidth={1.8} /> Add user
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 160px 200px 90px 110px 80px",
          alignItems: "center", gap: 14, padding: "10px 18px",
          borderBottom: "1px solid var(--line)", background: "var(--paper-2)",
          fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500,
        }}>
          <span>Username</span>
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Created</span>
          <span />
        </div>
        <div className="row-list">
          {loading && <div className="dim" style={{ padding: "32px 18px", textAlign: "center", fontSize: 13 }}>Loading…</div>}
          {!loading && filtered.length === 0 && <div className="dim" style={{ padding: "32px 18px", textAlign: "center", fontSize: 13 }}>No users found.</div>}
          {filtered.map((u) => (
            <div key={u.id} className="row" style={{ gridTemplateColumns: "1fr 160px 200px 90px 110px 80px", cursor: "default" }}>
              <span style={{ fontSize: 13.5, fontWeight: 500, fontFamily: "var(--font-mono)" }}>{u.username}</span>
              <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                {u.firstName || u.lastName ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : "—"}
              </span>
              <span className="dim" style={{ fontSize: 12.5 }}>{u.email}</span>
              <span className={`chip ${u.role === "admin" ? "accent dot" : "ghost"}`} style={{ fontSize: 11 }}>
                {u.role === "admin" ? <Shield size={10} /> : <User size={10} />}
                {u.role}
              </span>
              <span className="mono dim" style={{ fontSize: 12 }}>
                {new Date(u.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
              <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                <button className="btn ghost sm" type="button" onClick={() => openEdit(u)}>
                  <Pencil size={12} strokeWidth={1.8} />
                </button>
                <button className="btn ghost sm" type="button" onClick={() => setDeleteTarget(u)} disabled={u.id === currentUser?.id}>
                  <Trash2 size={12} strokeWidth={1.8} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add / Edit modal */}
      {dialogOpen && (
        <Portal>
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", padding: 24 }}
          onClick={() => setDialogOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: 480, background: "var(--card)", border: "1px solid var(--line)",
            borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden",
          }}>
            <div className="card-h">
              <h2 className="card-title">{editingUser ? "Edit user" : "New user"}</h2>
              <button type="button" className="settings-x" onClick={() => setDialogOpen(false)}><X size={14} strokeWidth={2} /></button>
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field">
                <label>Username</label>
                <input className="input" value={form.username} onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))} placeholder="johndoe" disabled={!!editingUser} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field">
                  <label>First name</label>
                  <input className="input" value={form.firstName} onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="John" />
                </div>
                <div className="field">
                  <label>Last name</label>
                  <input className="input" value={form.lastName} onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Doe" />
                </div>
              </div>
              <div className="field">
                <label>Email</label>
                <input className="input" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@example.com" />
              </div>
              <div className="field">
                <label>Role</label>
                <select className="input" value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="field">
                <label>Password</label>
                {editingUser ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button className="btn sm" type="button" onClick={handleResetPassword} disabled={saving}>
                      <RefreshCw size={12} strokeWidth={1.8} /> Reset password
                    </button>
                    {generatedPassword && (
                      <div style={{ display: "flex", gap: 6, flex: 1, alignItems: "center" }}>
                        <input className="input" type={showPassword ? "text" : "password"} value={generatedPassword} readOnly style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12 }} />
                        <button type="button" className="btn ghost sm" onClick={() => setShowPassword(s => !s)}>{showPassword ? <EyeOff size={12} /> : <Eye size={12} />}</button>
                        <button type="button" className="btn ghost sm" onClick={copyPassword}><Copy size={12} /></button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input className="input" type={showPassword ? "text" : "password"} value={generatedPassword} readOnly style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12 }} />
                    <button type="button" className="btn ghost sm" onClick={() => setShowPassword(s => !s)}>{showPassword ? <EyeOff size={12} /> : <Eye size={12} />}</button>
                    <button type="button" className="btn ghost sm" onClick={copyPassword}><Copy size={12} /></button>
                    <button type="button" className="btn ghost sm" onClick={() => setGeneratedPassword(generatePassword())}><RefreshCw size={12} /></button>
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn ghost sm" onClick={() => setDialogOpen(false)}>Cancel</button>
              <button type="button" className="btn primary sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editingUser ? "Save changes" : "Create user"}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <Portal>
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", padding: 24 }}
          onClick={() => setDeleteTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: 400, background: "var(--card)", border: "1px solid var(--line)",
            borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden",
          }}>
            <div className="card-h">
              <h2 className="card-title">Delete user</h2>
              <button type="button" className="settings-x" onClick={() => setDeleteTarget(null)}><X size={14} strokeWidth={2} /></button>
            </div>
            <div style={{ padding: "16px 20px", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>
              Delete <strong>{deleteTarget.username}</strong>? This cannot be undone.
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn ghost sm" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="btn sm" style={{ background: "var(--red)", color: "#fff", borderColor: "var(--red)" }} onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
