import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle, UserPlus } from "lucide-react";
import { PublicLayout } from "../../components/layout/public-layout";

const inputStyle = {
  marginTop: "4px",
  background: "#F7F8FE",
  border: "1px solid #D8DCEC",
  borderRadius: "6px",
  color: "#14152B",
  fontSize: "13px",
} as const;

const labelStyle = { fontSize: "11px", fontWeight: 700, color: "#3A3E5C" } as const;

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
    if (!code.trim()) { setCodeValid(null); setCodeMessage(""); setShowWaitlist(false); return; }
    try {
      const res = await fetch("/api/invite-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json() as { valid: boolean; message?: string };
      setCodeValid(data.valid);
      setCodeMessage(data.message ?? "");
      setShowWaitlist(!data.valid && (data.message?.includes("limit") ?? false));
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
    } catch { /* ignore */ } finally {
      setWaitlistSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (!agreed) { setError("You must agree to the Pilot Terms"); return; }
    setLoading(true);
    try {
      const utmRaw = localStorage.getItem("jobops_utm");
      const utm = utmRaw ? JSON.parse(utmRaw) : {};
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username, email, password,
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
      <PublicLayout>
        <div className="public-hero">
          <div className="public-card" style={{ textAlign: "center" }}>
            <CheckCircle size={32} style={{ color: "#6FAA10", margin: "0 auto 12px" }} />
            <h3 style={{ fontSize: "16px", fontWeight: 900, color: "#14152B", margin: "0 0 8px 0" }}>Check your email</h3>
            <p style={{ fontSize: "13px", color: "#6E7494", margin: "0 0 16px 0" }}>
              We sent a verification link to <strong style={{ color: "#14152B" }}>{email}</strong>. Click it to activate your account, then sign in.
            </p>
            <p style={{ fontSize: "12px", color: "#9CA0B8", margin: "0 0 20px 0" }}>
              Didn't get it? Check spam or try signing in — you can request a new verification email.
            </p>
            <button className="btn ghost" onClick={() => navigate("/login")} style={{ width: "100%" }}>
              Go to Sign In
            </button>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="public-hero">
        <div className="public-card">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <UserPlus size={16} style={{ color: "#6FAA10" }} />
            <h2 style={{ fontSize: "16px", fontWeight: 900, letterSpacing: "-0.02em", color: "#14152B", margin: 0 }}>
              Join the Pilot
            </h2>
          </div>
          <p style={{ fontSize: "12px", color: "#6E7494", margin: "0 0 20px 0" }}>
            Create your account with an invite code to get early access.
          </p>

          {error && (
            <div style={{ background: "rgba(255,60,95,0.08)", border: "1px solid rgba(255,60,95,0.25)", borderRadius: "8px", padding: "10px 12px", marginBottom: "14px", fontSize: "12px", color: "#c0223a", display: "flex", gap: "8px", alignItems: "center" }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <Label htmlFor="inviteCode" style={labelStyle}>Invite Code</Label>
              <Input id="inviteCode" type="text" placeholder="JOBOPS-XXXXXX" value={inviteCode}
                onChange={(e) => { setInviteCode(e.target.value); if (e.target.value.length >= 8) validateCode(e.target.value); }}
                onBlur={(e) => validateCode(e.target.value)}
                required disabled={loading} style={inputStyle}
              />
              {codeValid !== null && (
                <p style={{ fontSize: "11px", marginTop: "4px", color: codeValid ? "#6FAA10" : "#c0223a" }}>
                  {codeValid ? "✓ Code valid" : codeMessage}
                </p>
              )}

              {waitlistSent ? (
                <div style={{ marginTop: "8px", display: "flex", gap: "6px", alignItems: "center", fontSize: "12px", color: "#6FAA10" }}>
                  <CheckCircle size={14} />
                  You're on the waitlist! We'll email you when spots open.
                </div>
              ) : showWaitlist ? (
                <div style={{ marginTop: "10px", padding: "12px", background: "#F7F8FE", border: "1px solid #D8DCEC", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "#14152B", margin: 0 }}>Join the Waitlist</p>
                  <Input placeholder="Your name" value={waitlistName} onChange={(e) => setWaitlistName(e.target.value)} disabled={waitlistSubmitting} style={inputStyle} />
                  <Input type="email" placeholder="Email" value={waitlistEmail} onChange={(e) => setWaitlistEmail(e.target.value)} required disabled={waitlistSubmitting} style={inputStyle} />
                  <Input placeholder="LinkedIn URL (optional)" value={waitlistLinkedin} onChange={(e) => setWaitlistLinkedin(e.target.value)} disabled={waitlistSubmitting} style={inputStyle} />
                  <button type="button" className="btn ghost sm" onClick={handleWaitlistSubmit} disabled={waitlistSubmitting || !waitlistEmail}>
                    {waitlistSubmitting ? "Submitting..." : "Join Waitlist"}
                  </button>
                </div>
              ) : null}
            </div>

            <div>
              <Label htmlFor="username" style={labelStyle}>Username</Label>
              <Input id="username" type="text" placeholder="yourname" value={username}
                onChange={(e) => setUsername(e.target.value)} required disabled={loading} style={inputStyle} />
            </div>

            <div>
              <Label htmlFor="email" style={labelStyle}>Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required disabled={loading} style={inputStyle} />
            </div>

            <div>
              <Label htmlFor="password" style={labelStyle}>Password</Label>
              <Input id="password" type="password" placeholder="Min 12 characters" value={password}
                onChange={(e) => setPassword(e.target.value)} required disabled={loading} minLength={12} style={inputStyle} />
            </div>

            <div>
              <Label htmlFor="confirmPassword" style={labelStyle}>Confirm Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} required disabled={loading} minLength={12} style={inputStyle} />
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <Checkbox id="terms" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} disabled={loading} style={{ marginTop: "2px" }} />
              <label htmlFor="terms" style={{ fontSize: "12px", color: "#6E7494", lineHeight: 1.5, cursor: "pointer" }}>
                I agree to the{" "}
                <button type="button" onClick={(e) => { e.preventDefault(); setShowTerms((s) => !s); }}
                  style={{ color: "#6FAA10", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "inherit" }}>
                  Pilot Terms
                </button>{" "}
                and understand this is beta software. See{" "}
                <Link to="/terms" target="_blank" style={{ color: "#6FAA10", fontWeight: 700 }}>Terms</Link>{" "}
                and{" "}
                <Link to="/privacy" target="_blank" style={{ color: "#6FAA10", fontWeight: 700 }}>Privacy</Link>.
              </label>
            </div>

            {showTerms && (
              <div style={{ padding: "12px", background: "#F7F8FE", border: "1px solid #D8DCEC", borderRadius: "8px", fontSize: "12px", color: "#6E7494", lineHeight: 1.6 }}>
                <p style={{ fontWeight: 700, color: "#14152B", margin: "0 0 6px 0" }}>Job Ops Pilot Program Terms</p>
                <p style={{ margin: "0 0 4px 0" }}><strong style={{ color: "#3A3E5C" }}>Beta Software:</strong> This is pre-release software. Bugs and downtime may occur.</p>
                <p style={{ margin: "0 0 4px 0" }}><strong style={{ color: "#3A3E5C" }}>Data & Privacy:</strong> We collect job application data to improve AI suggestions.</p>
                <p style={{ margin: "0 0 4px 0" }}><strong style={{ color: "#3A3E5C" }}>Feedback:</strong> Pilot participants agree to provide periodic feedback.</p>
                <p style={{ margin: "0 0 4px 0" }}><strong style={{ color: "#3A3E5C" }}>Usage Limits:</strong> AI requests are limited per week.</p>
                <p style={{ margin: 0 }}><strong style={{ color: "#3A3E5C" }}>Termination:</strong> We reserve the right to terminate access at any time.</p>
              </div>
            )}

            <button type="submit" className="btn primary" disabled={loading || codeValid !== true} style={{ width: "100%", marginTop: "4px" }}>
              {loading ? "Creating Account..." : "Agree and Continue"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "16px", fontSize: "11px", color: "#9CA0B8" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "#6FAA10", fontWeight: 700, textDecoration: "none" }}>Sign in</Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
