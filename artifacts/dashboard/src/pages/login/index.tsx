import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentCard } from "@/components/ui/content-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, AlertCircle, KeyRound } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { easing } from "@/lib/animations";

type Step = "password" | "totp";

export default function LoginPage() {
 const { login, verifyTotp } = useAuth();
 const navigate = useNavigate();
 const location = useLocation();
 const from = (location.state as { from?: string })?.from ?? "/dashboard";

 const [step, setStep] = useState<Step>("password");
 const [username, setUsername] = useState("");
 const [password, setPassword] = useState("");
 const [totpToken, setTotpToken] = useState("");
 const [recoveryCode, setRecoveryCode] = useState("");
 const [useRecovery, setUseRecovery] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [loading, setLoading] = useState(false);

 const handlePasswordSubmit = async (e: FormEvent) => {
 e.preventDefault();
 setError(null);
 setLoading(true);

 try {
 const result = await login(username.trim(), password);
 if (result.totpRequired) {
 setStep("totp");
 } else {
 navigate(from, { replace: true });
 }
 } catch (err) {
 setError(err instanceof Error ? err.message : "Login failed");
 } finally {
 setLoading(false);
 }
 };

 const handleTotpSubmit = async (e: FormEvent) => {
 e.preventDefault();
 setError(null);
 setLoading(true);

 try {
 if (useRecovery) {
 const res = await fetch("/api/auth/login/totp", {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ recoveryCode: recoveryCode.trim().toLowerCase() }),
 });
 if (!res.ok) {
 const err = await res.json() as { error: string };
 throw new Error(err.error ?? "Invalid recovery code");
 }
 window.location.replace(from);
 } else {
 await verifyTotp(totpToken.replace(/\s/g, ""));
 navigate(from, { replace: true });
 }
 } catch (err) {
 setError(err instanceof Error ? err.message : "Verification failed");
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="min-h-screen bg-surface flex items-center justify-center p-4">
 <div className="w-full max-w-md">
 <div className="card-chunky p-8">
 <div className="text-center mb-6">
 <h1 className="text-2xl font-bold gradient-text">Job Ops</h1>
 <p className="text-muted text-sm mt-1">Sign in to your account</p>
 </div>

 <AnimatePresence mode="wait">
 {step === "password" ? (
 <motion.div
 key="password"
 initial={{ opacity: 0, x: -12 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: 12 }}
 transition={{ duration: 0.25, ease: easing.smooth }}
 >
 <CardHeader className="pb-4">
 <CardTitle className="flex items-center gap-2">
 <Lock className="h-5 w-5" />
 Sign in
 </CardTitle>
 <CardDescription>
 Private access — enter your credentials to continue
 </CardDescription>
 </CardHeader>
 <CardContent>
 <form onSubmit={handlePasswordSubmit} className="space-y-4">
 {error && (
 <Alert variant="destructive">
 <AlertCircle className="h-4 w-4" />
 <AlertDescription>{error}</AlertDescription>
 </Alert>
 )}
 <div className="space-y-2">
 <Label htmlFor="username">Username</Label>
 <Input
 id="username"
 type="text"
 autoComplete="username"
 value={username}
 onChange={e => setUsername(e.target.value)}
 placeholder="admin"
 required
 disabled={loading}
 autoFocus
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="password">Password</Label>
 <Input
 id="password"
 type="password"
 autoComplete="current-password"
 value={password}
 onChange={e => setPassword(e.target.value)}
 required
 disabled={loading}
 />
 </div>
 <Button type="submit" className="w-full" disabled={loading}>
 {loading ? "Signing in…" : "Sign in"}
 </Button>
 </form>
 </CardContent>
 </motion.div>
 ) : (
 <motion.div
 key="totp"
 initial={{ opacity: 0, x: 12 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: -12 }}
 transition={{ duration: 0.25, ease: easing.smooth }}
 >
 <CardHeader className="pb-4">
 <CardTitle className="flex items-center gap-2">
 <KeyRound className="h-5 w-5" />
 Two-factor authentication
 </CardTitle>
 <CardDescription>
 {useRecovery
 ? "Enter one of your 8-character recovery codes"
 : "Enter the 6-digit code from your authenticator app"}
 </CardDescription>
 </CardHeader>
 <CardContent>
 <form onSubmit={handleTotpSubmit} className="space-y-4">
 {error && (
 <Alert variant="destructive">
 <AlertCircle className="h-4 w-4" />
 <AlertDescription>{error}</AlertDescription>
 </Alert>
 )}

 {!useRecovery ? (
 <div className="space-y-2">
 <Label htmlFor="totp">Authenticator code</Label>
 <Input
 id="totp"
 type="text"
 inputMode="numeric"
 autoComplete="one-time-code"
 value={totpToken}
 onChange={e => setTotpToken(e.target.value)}
 placeholder="000000"
 maxLength={6}
 required
 disabled={loading}
 autoFocus
 className="text-center tracking-widest text-xl font-mono"
 />
 </div>
 ) : (
 <div className="space-y-2">
 <Label htmlFor="recovery">Recovery code</Label>
 <Input
 id="recovery"
 type="text"
 value={recoveryCode}
 onChange={e => setRecoveryCode(e.target.value)}
 placeholder="e.g. a1b2c3d4e5"
 required
 disabled={loading}
 autoFocus
 className="font-mono"
 />
 </div>
 )}

 <Button type="submit" className="w-full" disabled={loading}>
 {loading ? "Verifying…" : "Verify"}
 </Button>

 <button
 type="button"
 className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
 onClick={() => {
 setUseRecovery(!useRecovery);
 setError(null);
 }}
 >
 {useRecovery ? "← Use authenticator app instead" : "Lost your phone? Use a recovery code"}
 </button>

 <button
 type="button"
 className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
 onClick={() => {
 setStep("password");
 setError(null);
 setTotpToken("");
 }}
 >
 ← Back to password
 </button>
 </form>
 </CardContent>
 </motion.div>
 )}
 </AnimatePresence>
 </div>

 <p className="text-center text-xs text-white/60 mt-6 space-y-2">
 <span>&copy; 2026 Cyrus Sepasi. All rights reserved. Portfolio Studio&trade; is a product of L&amp;D PRO.</span>
 <span className="block space-x-3 mt-1">
 <span className="hover:text-white/80 transition-colors cursor-pointer">Terms of Service</span>
 <span>|</span>
 <span className="hover:text-white/80 transition-colors cursor-pointer">Privacy Policy</span>
 </span>
 </p>
 </div>
 </div>
 );
}
