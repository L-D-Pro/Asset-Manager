import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentCard } from "@/components/ui/content-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle, UserPlus } from "lucide-react";

export default function RegisterPage() {
 const navigate = useNavigate();
 const [username, setUsername] = useState("");
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");
 const [inviteCode, setInviteCode] = useState("");
 const [agreed, setAgreed] = useState(false);
 const [showTerms, setShowTerms] = useState(false);
 const [error, setError] = useState("");
 const [loading, setLoading] = useState(false);
 const [codeValid, setCodeValid] = useState<boolean | null>(null);
 const [codeMessage, setCodeMessage] = useState("");
 const [registered, setRegistered] = useState(false);
 const [showWaitlist, setShowWaitlist] = useState(false);
 const [waitlistName, setWaitlistName] = useState("");
 const [waitlistEmail, setWaitlistEmail] = useState("");
 const [waitlistLinkedin, setWaitlistLinkedin] = useState("");
 const [waitlistSent, setWaitlistSent] = useState(false);
 const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);

 async function validateCode(code: string) {
 if (!code.trim()) {
 setCodeValid(null);
 setCodeMessage("");
 setShowWaitlist(false);
 return;
 }
 try {
 const res = await fetch("/api/invite-codes/validate", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ code: code.trim() }),
 });
 const data = await res.json() as { valid: boolean; message?: string };
 setCodeValid(data.valid);
 setCodeMessage(data.message ?? "");
 if (!data.valid && data.message?.includes("limit")) {
 setShowWaitlist(true);
 } else {
 setShowWaitlist(false);
 }
 } catch {
 setCodeValid(false);
 setCodeMessage("Could not validate code");
 }
 }

 async function handleWaitlistSubmit(e: FormEvent) {
 e.preventDefault();
 setWaitlistSubmitting(true);
 try {
 const utmRaw = localStorage.getItem("jobops_utm");
 const utm = utmRaw ? JSON.parse(utmRaw) : {};
 await fetch("/api/waitlist", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 email: waitlistEmail,
 fullName: waitlistName,
 linkedinUrl: waitlistLinkedin,
 utmSource: utm.source ?? undefined,
 utmMedium: utm.medium ?? undefined,
 utmCampaign: utm.campaign ?? undefined,
 }),
 });
 setWaitlistSent(true);
 } catch {
 // ignore
 } finally {
 setWaitlistSubmitting(false);
 }
 }

 async function handleSubmit(e: FormEvent) {
 e.preventDefault();
 setError("");

 if (password !== confirmPassword) {
 setError("Passwords do not match");
 return;
 }
 if (!agreed) {
 setError("You must agree to the Pilot Terms");
 return;
 }

 setLoading(true);
 try {
 const utmRaw = localStorage.getItem("jobops_utm");
 const utm = utmRaw ? JSON.parse(utmRaw) : {};
 const res = await fetch("/api/auth/register", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 username,
 email,
 password,
 inviteCode: inviteCode.trim(),
 utmSource: utm.source ?? undefined,
 utmMedium: utm.medium ?? undefined,
 utmCampaign: utm.campaign ?? undefined,
 }),
 });

 if (!res.ok) {
 const err = await res.json() as { error: string };
 throw new Error(err.error ?? "Registration failed");
 }

 localStorage.removeItem("jobops_utm");
 setRegistered(true);
 } catch (err) {
 setError(err instanceof Error ? err.message : "Registration failed");
 } finally {
 setLoading(false);
 }
 }

 if (registered) {
 return (
  <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-background via-surface to-background">
  <div className="w-full max-w-md">
  <div className="quiet-card p-8">
  <div className="text-center mb-6">
  <h1 className="text-2xl font-bold ">Job Ops</h1>
  <p className="text-muted-foreground text-sm mt-1">Create Account</p>
  </div>
 <div className="text-center space-y-4">
 <CheckCircle className="h-12 w-12 text-success mx-auto" />
 <h3 className="text-lg font-semibold text-foreground">Check your email</h3>
  <p className="text-muted-foreground text-sm">
  We sent a verification link to <strong>{email}</strong>. Click it to activate your account, then sign in.
  </p>
  <p className="text-xs text-muted-foreground">
 Didn't get it? Check spam or try signing in — you can request a new verification email.
 </p>
 <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
 Go to Sign In
 </Button>
 </div>
 </div>
 </div>
 </div>
 );
 }

 return (
  <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-background via-surface to-background">
  <div className="w-full max-w-md">
  <div className="quiet-card p-8">
  <div className="text-center mb-6">
  <h1 className="text-2xl font-bold ">Job Ops</h1>
  <p className="text-muted-foreground text-sm mt-1">Get started with Job Ops</p>
  </div>

 <CardHeader className="pb-4">
 <CardTitle className="flex items-center gap-2">
 <UserPlus className="h-5 w-5" />
 Join the Pilot
 </CardTitle>
 <CardDescription>
 Create your account with an invite code to get early access.
 </CardDescription>
 </CardHeader>
 <CardContent>
 <form onSubmit={handleSubmit} className="space-y-4">
 {error && (
 <Alert variant="destructive">
 <AlertCircle className="h-4 w-4" />
 <AlertDescription>{error}</AlertDescription>
 </Alert>
 )}

 <div className="space-y-2">
 <Label htmlFor="inviteCode">Invite Code</Label>
 <Input
 id="inviteCode"
 type="text"
 placeholder="JOBOPS-XXXXXX"
 value={inviteCode}
 onChange={(e) => {
 setInviteCode(e.target.value);
 if (e.target.value.length >= 8) validateCode(e.target.value);
 }}
 onBlur={(e) => validateCode(e.target.value)}
 required
 disabled={loading}
 />
 {codeValid !== null && (
 <p className={`text-xs ${codeValid ? "text-success" : "text-destructive"}`}>
 {codeValid ? "Code valid" : codeMessage}
 </p>
 )}

 {waitlistSent ? (
  <div className="rounded border border-success p-3 text-sm">
  <CheckCircle className="h-4 w-4 text-success inline mr-1" />
  You're on the waitlist! We'll email you when spots open.
  </div>
  ) : showWaitlist ? (
  <div className="rounded border border-border p-3 space-y-2">
 <p className="text-sm font-medium">Join the Waitlist</p>
 <Input
 placeholder="Your name"
 value={waitlistName}
 onChange={(e) => setWaitlistName(e.target.value)}
 disabled={waitlistSubmitting}
 />
 <Input
 type="email"
 placeholder="Email"
 value={waitlistEmail}
 onChange={(e) => setWaitlistEmail(e.target.value)}
 required
 disabled={waitlistSubmitting}
 />
 <Input
 placeholder="LinkedIn URL (optional)"
 value={waitlistLinkedin}
 onChange={(e) => setWaitlistLinkedin(e.target.value)}
 disabled={waitlistSubmitting}
 />
 <Button variant="outline" size="sm" onClick={handleWaitlistSubmit} disabled={waitlistSubmitting || !waitlistEmail}>
 {waitlistSubmitting ? "Submitting..." : "Join Waitlist"}
 </Button>
 </div>
 ) : null}
 </div>

 <div className="space-y-2">
 <Label htmlFor="username">Username</Label>
 <Input
 id="username"
 type="text"
 placeholder="yourname"
 value={username}
 onChange={(e) => setUsername(e.target.value)}
 required
 disabled={loading}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="email">Email</Label>
 <Input
 id="email"
 type="email"
 placeholder="you@example.com"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 required
 disabled={loading}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="password">Password</Label>
 <Input
 id="password"
 type="password"
 placeholder="Min 12 characters"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 required
 disabled={loading}
 minLength={12}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="confirmPassword">Confirm Password</Label>
 <Input
 id="confirmPassword"
 type="password"
 value={confirmPassword}
 onChange={(e) => setConfirmPassword(e.target.value)}
 required
 disabled={loading}
 minLength={12}
 />
 </div>

 <div className="flex items-start gap-2">
 <Checkbox
 id="terms"
 checked={agreed}
 onCheckedChange={(v) => setAgreed(v === true)}
 disabled={loading}
 className="mt-1"
 />
 <div className="text-sm text-muted-foreground leading-relaxed">
 <label htmlFor="terms" className="cursor-pointer">
 I agree to the{" "}
 <span
 className="text-primary underline cursor-pointer"
 onClick={(e) => { e.preventDefault(); setShowTerms((s) => !s); }}
 >
 Pilot Terms
 </span>{" "}
 and understand this is beta software. See{" "}
 <Link to="/terms-of-service" className="text-primary underline" target="_blank">
 Terms
 </Link>{" "}
 and{" "}
 <Link to="/privacy-policy" className="text-primary underline" target="_blank">
 Privacy
 </Link>
 .
 </label>
 </div>
 </div>

  {showTerms && (
  <div className="rounded border border-border p-3 text-xs text-muted-foreground space-y-2 max-h-40 overflow-y-auto">
 <p className="font-semibold text-foreground">Job Ops Pilot Program Terms</p>
 <p><strong>Beta Software:</strong> This is pre-release software. Bugs and downtime may occur.</p>
 <p><strong>Data & Privacy:</strong> We collect job application data to improve AI suggestions.</p>
 <p><strong>Feedback:</strong> Pilot participants agree to provide periodic feedback.</p>
 <p><strong>Usage Limits:</strong> AI requests are limited per week.</p>
 <p><strong>Termination:</strong> We reserve the right to terminate access at any time.</p>
 </div>
 )}

 <Button type="submit" className="w-full" disabled={loading || codeValid !== true}>
 {loading ? "Creating Account..." : "Agree and Continue"}
 </Button>
 </form>
 </CardContent>
 </div>

  <p className="text-center text-xs text-muted-foreground mt-6">
  Already have an account?{" "}
  <Link to="/login" className="text-foreground underline hover:text-primary">
  Sign in
  </Link>
  </p>
 </div>
 </div>
 );
}
