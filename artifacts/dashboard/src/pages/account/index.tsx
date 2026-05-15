import { useState, type FormEvent } from "react";
import { useAuth } from "@/context/auth";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentCard } from "@/components/ui/content-card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, AlertCircle, Shield, ShieldOff, Mail, Lock, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useApiAction() {
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState<string | null>(null);

 const run = async (fn: () => Promise<string>) => {
 setLoading(true);
 setError(null);
 setSuccess(null);
 try {
 const msg = await fn();
 setSuccess(msg);
 } catch (err) {
 setError(err instanceof Error ? err.message : "An error occurred");
 } finally {
 setLoading(false);
 }
 };

 return { loading, error, success, run, setError, setSuccess };
}

async function apiCall(path: string, body: unknown): Promise<{ ok: boolean; [k: string]: unknown }> {
 const res = await fetch(path, {
 method: path.includes("password") && !path.includes("regenerate") ? "PUT" :
 path.includes("email") ? "PUT" : "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(body),
 });
 const data = await res.json() as { ok?: boolean; error?: string; [k: string]: unknown };
 if (!res.ok) throw new Error(data.error ?? "Request failed");
 return data as { ok: boolean; [k: string]: unknown };
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function ChangePasswordSection() {
 const [current, setCurrent] = useState("");
 const [next, setNext] = useState("");
 const [confirm, setConfirm] = useState("");
 const { loading, error, success, run } = useApiAction();

 const handleSubmit = async (e: FormEvent) => {
 e.preventDefault();
 if (next !== confirm) {
 return;
 }
 await run(async () => {
 await apiCall("/api/auth/password", { currentPassword: current, newPassword: next });
 setCurrent(""); setNext(""); setConfirm("");
 return "Password updated successfully";
 });
 };

 return (
  <ContentCard className="quiet-card">
  <CardHeader>
  <CardTitle className="flex items-center gap-2 text-base">
  <Lock className="h-4 w-4" /> Change Password
 </CardTitle>
 <CardDescription>Minimum 12 characters. Use a strong, unique password.</CardDescription>
 </CardHeader>
 <CardContent>
 <form onSubmit={handleSubmit} className="space-y-4">
 {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
 {success && <Alert className="border-success/30 bg-success/10 text-success"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{success}</AlertDescription></Alert>}
 <div className="space-y-2">
 <Label htmlFor="current-pw">Current password</Label>
 <Input id="current-pw" type="password" value={current} onChange={e => setCurrent(e.target.value)} required disabled={loading} autoComplete="current-password" />
 </div>
 <div className="space-y-2">
 <Label htmlFor="new-pw">New password</Label>
 <Input id="new-pw" type="password" value={next} onChange={e => setNext(e.target.value)} required minLength={12} disabled={loading} autoComplete="new-password" />
 </div>
 <div className="space-y-2">
 <Label htmlFor="confirm-pw">Confirm new password</Label>
 <Input id="confirm-pw" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required disabled={loading} autoComplete="new-password" />
 {next && confirm && next !== confirm && (
 <p className="text-xs text-destructive">Passwords do not match</p>
 )}
 </div>
 <Button type="submit" disabled={loading || (!!next && !!confirm && next !== confirm)}>
 {loading ? "Saving…" : "Update password"}
 </Button>
 </form>
 </CardContent>
 </ContentCard>
 );
}

function ChangeEmailSection() {
 const { user, refetch } = useAuth();
 const [email, setEmail] = useState(user?.email ?? "");
 const { loading, error, success, run } = useApiAction();

 const handleSubmit = async (e: FormEvent) => {
 e.preventDefault();
 await run(async () => {
 await apiCall("/api/auth/email", { email });
 await refetch();
 return "Email updated";
 });
 };

 return (
  <ContentCard className="quiet-card">
  <CardHeader>
  <CardTitle className="flex items-center gap-2 text-base">
  <Mail className="h-4 w-4" /> Email Address
 </CardTitle>
 <CardDescription>Used for account identification only — not for login.</CardDescription>
 </CardHeader>
 <CardContent>
 <form onSubmit={handleSubmit} className="space-y-4">
 {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
 {success && <Alert className="border-success/30 bg-success/10 text-success"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{success}</AlertDescription></Alert>}
 <div className="space-y-2">
 <Label htmlFor="email">Email</Label>
 <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} autoComplete="email" />
 </div>
 <Button type="submit" disabled={loading}>
 {loading ? "Saving…" : "Update email"}
 </Button>
 </form>
 </CardContent>
 </ContentCard>
 );
}

function TwoFactorSection() {
 const { user, refetch } = useAuth();
 const [setupData, setSetupData] = useState<{ qrDataUrl: string; secret: string } | null>(null);
 const [confirmToken, setConfirmToken] = useState("");
 const [disableToken, setDisableToken] = useState("");
 const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
 const [regenToken, setRegenToken] = useState("");
 const [regenOpen, setRegenOpen] = useState(false);
 const setup = useApiAction();
 const enable = useApiAction();
 const disable = useApiAction();
 const regen = useApiAction();

 const startSetup = async () => {
 await setup.run(async () => {
 const res = await fetch("/api/auth/2fa/setup", {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({}),
 });
 const data = await res.json() as { qrDataUrl?: string; secret?: string; error?: string };
 if (!res.ok) throw new Error(data.error ?? "Setup failed");
 setSetupData({ qrDataUrl: data.qrDataUrl!, secret: data.secret! });
 return "Scan the QR code below with your authenticator app";
 });
 };

 const confirmEnable = async (e: FormEvent) => {
 e.preventDefault();
 await enable.run(async () => {
 const res = await fetch("/api/auth/2fa/enable", {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ token: confirmToken.replace(/\s/g, "") }),
 });
 const data = await res.json() as { recoveryCodes?: string[]; error?: string };
 if (!res.ok) throw new Error(data.error ?? "Enable failed");
 setRecoveryCodes(data.recoveryCodes!);
 setSetupData(null);
 setConfirmToken("");
 await refetch();
 return "2FA enabled! Save your recovery codes below.";
 });
 };

 const confirmDisable = async (e: FormEvent) => {
 e.preventDefault();
 await disable.run(async () => {
 const res = await fetch("/api/auth/2fa/disable", {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ token: disableToken.replace(/\s/g, "") }),
 });
 const data = await res.json() as { ok?: boolean; error?: string };
 if (!res.ok) throw new Error(data.error ?? "Disable failed");
 setDisableToken("");
 await refetch();
 return "2FA disabled";
 });
 };

 const regenerateCodes = async (e: FormEvent) => {
 e.preventDefault();
 await regen.run(async () => {
 const res = await fetch("/api/auth/2fa/regenerate-codes", {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ token: regenToken.replace(/\s/g, "") }),
 });
 const data = await res.json() as { recoveryCodes?: string[]; error?: string };
 if (!res.ok) throw new Error(data.error ?? "Failed to regenerate");
 setRecoveryCodes(data.recoveryCodes!);
 setRegenToken("");
 setRegenOpen(false);
 return "Recovery codes regenerated! Save them now — they won't be shown again.";
 });
 };

 return (
  <ContentCard className="quiet-card">
  <CardHeader>
  <CardTitle className="flex items-center gap-2 text-base">
  <Shield className="h-4 w-4" />
  Two-Factor Authentication
 {user?.totpEnabled
 ? <Badge className="ml-2 bg-success/10 text-success border-success/30">Enabled</Badge>
 : <Badge variant="secondary" className="ml-2">Disabled</Badge>
 }
 </CardTitle>
 <CardDescription>
 Use Google Authenticator, Authy, or any TOTP-compatible app.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Disabled state — offer to enable */}
 {!user?.totpEnabled && !setupData && (
 <div className="space-y-3">
 {setup.error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{setup.error}</AlertDescription></Alert>}
 <p className="text-sm text-muted-foreground">
 Add a second authentication factor for stronger account security.
 </p>
 <Button onClick={startSetup} disabled={setup.loading} variant="outline">
 <Shield className="h-4 w-4 mr-2" />
 {setup.loading ? "Generating…" : "Set up 2FA"}
 </Button>
 </div>
 )}

 {/* Setup in progress — show QR code */}
 {setupData && (
 <div className="space-y-4">
 {setup.success && (
 <Alert className="border-primary/30 bg-primary/10 text-primary">
 <AlertDescription>{setup.success}</AlertDescription>
 </Alert>
 )}
 <div className="flex justify-center">
 <img src={setupData.qrDataUrl} alt="TOTP QR Code" className="w-48 h-48 rounded border" />
 </div>
 <div className="bg-muted rounded p-3">
 <p className="text-xs text-muted-foreground mb-1">Manual entry key:</p>
 <p className="font-mono text-sm break-all select-all">{setupData.secret}</p>
 </div>
 <form onSubmit={confirmEnable} className="space-y-3">
 {enable.error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{enable.error}</AlertDescription></Alert>}
 <div className="space-y-2">
 <Label htmlFor="confirm-totp">Enter code from app to confirm</Label>
 <Input
 id="confirm-totp"
 type="text"
 inputMode="numeric"
 value={confirmToken}
 onChange={e => setConfirmToken(e.target.value)}
 placeholder="000000"
 maxLength={6}
 required
 disabled={enable.loading}
 className="text-center tracking-widest font-mono"
 />
 </div>
 <div className="flex gap-2">
 <Button type="submit" disabled={enable.loading}>
 {enable.loading ? "Enabling…" : "Enable 2FA"}
 </Button>
 <Button type="button" variant="ghost" onClick={() => setSetupData(null)}>
 Cancel
 </Button>
 </div>
 </form>
 </div>
 )}

 {/* Recovery codes just generated */}
 {recoveryCodes && (
 <div className="space-y-3">
 {enable.success && <Alert className="border-success/30 bg-success/10 text-success"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{enable.success}</AlertDescription></Alert>}
 {regen.success && <Alert className="border-success/30 bg-success/10 text-success"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{regen.success}</AlertDescription></Alert>}
 <div className="bg-warning/10 border border-warning/30 rounded p-3">
 <p className="text-sm font-semibold text-warning mb-2">
 Save these recovery codes now — they won't be shown again
 </p>
 <div className="grid grid-cols-2 gap-1">
 {recoveryCodes.map((code, i) => (
 <code key={i} className="font-mono text-sm bg-muted border border-border rounded px-2 py-1 select-all">
 {code}
 </code>
 ))}
 </div>
 </div>
 <Button variant="outline" size="sm" onClick={() => setRecoveryCodes(null)}>
 I've saved these codes
 </Button>
 </div>
 )}

 {/* Enabled state — offer to disable or regenerate codes */}
 {user?.totpEnabled && !setupData && !recoveryCodes && (
 <div className="space-y-4">
 <Separator />

 {/* Regenerate recovery codes */}
 <div>
 <p className="text-sm font-medium mb-2 flex items-center gap-2">
 <RefreshCw className="h-4 w-4" /> Recovery codes
 </p>
 <p className="text-sm text-muted-foreground mb-2">
 If you've used or lost your recovery codes, regenerate a fresh set.
 </p>
 <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
 <DialogTrigger asChild>
 <Button variant="outline" size="sm">Regenerate recovery codes</Button>
 </DialogTrigger>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Regenerate recovery codes</DialogTitle>
 <DialogDescription>
 Old codes will be invalidated. Enter your current TOTP code to confirm.
 </DialogDescription>
 </DialogHeader>
 <form onSubmit={regenerateCodes} className="space-y-4">
 {regen.error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{regen.error}</AlertDescription></Alert>}
 <div className="space-y-2">
 <Label htmlFor="regen-token">Authenticator code</Label>
 <Input
 id="regen-token"
 type="text"
 inputMode="numeric"
 value={regenToken}
 onChange={e => setRegenToken(e.target.value)}
 placeholder="000000"
 maxLength={6}
 required
 disabled={regen.loading}
 className="text-center tracking-widest font-mono"
 />
 </div>
 <DialogFooter>
 <Button type="button" variant="ghost" onClick={() => setRegenOpen(false)}>Cancel</Button>
 <Button type="submit" disabled={regen.loading}>
 {regen.loading ? "Regenerating…" : "Regenerate"}
 </Button>
 </DialogFooter>
 </form>
 </DialogContent>
 </Dialog>
 </div>

 <Separator />

 {/* Disable 2FA */}
 <div>
 <p className="text-sm font-medium mb-2 flex items-center gap-2 text-destructive">
 <ShieldOff className="h-4 w-4" /> Disable 2FA
 </p>
 <form onSubmit={confirmDisable} className="space-y-3">
 {disable.error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{disable.error}</AlertDescription></Alert>}
 {disable.success && <Alert className="border-success/30 bg-success/10 text-success"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{disable.success}</AlertDescription></Alert>}
 <div className="space-y-2">
 <Label htmlFor="disable-token">Enter current TOTP code to disable</Label>
 <Input
 id="disable-token"
 type="text"
 inputMode="numeric"
 value={disableToken}
 onChange={e => setDisableToken(e.target.value)}
 placeholder="000000"
 maxLength={6}
 required
 disabled={disable.loading}
 className="text-center tracking-widest font-mono w-36"
 />
 </div>
 <Button type="submit" variant="destructive" size="sm" disabled={disable.loading}>
 {disable.loading ? "Disabling…" : "Disable 2FA"}
 </Button>
 </form>
 </div>
 </div>
 )}
 </CardContent>
 </ContentCard>
 );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AccountPage() {
 const { user, logout } = useAuth();

 if (!user) return null;

 const handleLogout = async () => {
 await logout();
 window.location.replace("/");
 };

 return (
 <div className="max-w-2xl mx-auto space-y-8">
 <PageHeader title="Account" subtitle="Manage your profile, security settings, and preferences." variant="admin">
 <Button variant="outline" onClick={handleLogout} className="rounded-md border-border hover:border-primary/35 hover:bg-primary/5">
 Sign out
 </Button>
 </PageHeader>

 <ChangePasswordSection />
 <ChangeEmailSection />
 <TwoFactorSection />
 </div>
 );
}
