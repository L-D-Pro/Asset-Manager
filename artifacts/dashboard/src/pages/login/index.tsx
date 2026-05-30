import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, KeyRound } from "lucide-react";
import { PublicLayout } from "../../components/layout/public-layout";

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
    <PublicLayout>
      <div className="public-hero">
        <div className="public-card">
          {step === "password" ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <Lock size={16} style={{ color: "#6FAA10" }} />
                <h2 style={{ fontSize: "16px", fontWeight: 900, letterSpacing: "-0.02em", color: "#14152B", margin: 0 }}>
                  Sign in
                </h2>
              </div>
              <p style={{ fontSize: "12px", color: "#6E7494", margin: "0 0 20px 0" }}>
                Private access — enter your credentials to continue
              </p>

              {error && (
                <div style={{ background: "rgba(255,60,95,0.08)", border: "1px solid rgba(255,60,95,0.25)", borderRadius: "8px", padding: "10px 12px", marginBottom: "14px", fontSize: "12px", color: "#c0223a" }}>
                  {error}
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <Label htmlFor="username" style={{ fontSize: "11px", fontWeight: 700, color: "#3A3E5C" }}>Username</Label>
                  <Input id="username" type="text" autoComplete="username" value={username}
                    onChange={e => setUsername(e.target.value)} placeholder="your_handle"
                    required disabled={loading} autoFocus
                    style={{ marginTop: "4px", background: "#F7F8FE", border: "1px solid #D8DCEC", borderRadius: "6px", color: "#14152B", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <Label htmlFor="password" style={{ fontSize: "11px", fontWeight: 700, color: "#3A3E5C" }}>Password</Label>
                  <Input id="password" type="password" autoComplete="current-password" value={password}
                    onChange={e => setPassword(e.target.value)} required disabled={loading}
                    style={{ marginTop: "4px", background: "#F7F8FE", border: "1px solid #D8DCEC", borderRadius: "6px", color: "#14152B", fontSize: "13px" }}
                  />
                </div>
                <button type="submit" className="btn primary" disabled={loading} style={{ marginTop: "4px", width: "100%" }}>
                  {loading ? "Signing in…" : "Sign In"}
                </button>
              </form>

              <p style={{ textAlign: "center", marginTop: "16px", fontSize: "11px", color: "#9CA0B8" }}>
                No account?{" "}
                <a href="/register" style={{ color: "#6FAA10", fontWeight: 700, textDecoration: "none" }}>Request access</a>
              </p>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <KeyRound size={16} style={{ color: "#6FAA10" }} />
                <h2 style={{ fontSize: "16px", fontWeight: 900, letterSpacing: "-0.02em", color: "#14152B", margin: 0 }}>
                  Two-factor auth
                </h2>
              </div>
              <p style={{ fontSize: "12px", color: "#6E7494", margin: "0 0 20px 0" }}>
                {useRecovery
                  ? "Enter one of your 8-character recovery codes"
                  : "Enter the 6-digit code from your authenticator app"}
              </p>

              {error && (
                <div style={{ background: "rgba(255,60,95,0.08)", border: "1px solid rgba(255,60,95,0.25)", borderRadius: "8px", padding: "10px 12px", marginBottom: "14px", fontSize: "12px", color: "#c0223a" }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleTotpSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {!useRecovery ? (
                  <div>
                    <Label htmlFor="totp" style={{ fontSize: "11px", fontWeight: 700, color: "#3A3E5C" }}>Authenticator code</Label>
                    <Input id="totp" type="text" inputMode="numeric" autoComplete="one-time-code"
                      value={totpToken} onChange={e => setTotpToken(e.target.value)}
                      placeholder="000000" maxLength={6} required disabled={loading} autoFocus
                      style={{ marginTop: "4px", background: "#F7F8FE", border: "1px solid #D8DCEC", borderRadius: "6px", color: "#14152B", fontSize: "20px", fontWeight: 700, letterSpacing: "0.2em", textAlign: "center" }}
                    />
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="recovery" style={{ fontSize: "11px", fontWeight: 700, color: "#3A3E5C" }}>Recovery code</Label>
                    <Input id="recovery" type="text" value={recoveryCode}
                      onChange={e => setRecoveryCode(e.target.value)}
                      placeholder="e.g. a1b2c3d4e5" required disabled={loading} autoFocus
                      style={{ marginTop: "4px", background: "#F7F8FE", border: "1px solid #D8DCEC", borderRadius: "6px", color: "#14152B", fontSize: "13px" }}
                    />
                  </div>
                )}

                <button type="submit" className="btn primary" disabled={loading} style={{ width: "100%" }}>
                  {loading ? "Verifying…" : "Verify"}
                </button>

                <button type="button" className="btn ghost sm" onClick={() => { setUseRecovery(!useRecovery); setError(null); }} style={{ width: "100%" }}>
                  {useRecovery ? "← Use authenticator app instead" : "Lost your phone? Use a recovery code"}
                </button>

                <button type="button" className="btn ghost sm" onClick={() => { setStep("password"); setError(null); setTotpToken(""); }} style={{ width: "100%" }}>
                  ← Back to password
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
