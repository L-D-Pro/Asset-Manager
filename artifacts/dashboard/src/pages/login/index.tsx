import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, AlertCircle, KeyRound } from "lucide-react";

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
    <div>
      <div>
        <div>
          <div>
            <h1>Job Ops</h1>
            <p>Sign in to your account</p>
          </div>

          {step === "password" ? (
            <div>
              <CardHeader>
                <CardTitle>
                  <Lock />
                  Sign in
                </CardTitle>
                <CardDescription>
                  Private access — enter your credentials to continue
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordSubmit}>
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      required
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                  <div>
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
                  <Button type="submit" disabled={loading}>
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              </CardContent>
            </div>
          ) : (
            <div>
              <CardHeader>
                <CardTitle>
                  <KeyRound />
                  Two-factor authentication
                </CardTitle>
                <CardDescription>
                  {useRecovery
                    ? "Enter one of your 8-character recovery codes"
                    : "Enter the 6-digit code from your authenticator app"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTotpSubmit}>
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {!useRecovery ? (
                    <div>
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
                      />
                    </div>
                  ) : (
                    <div>
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
                      />
                    </div>
                  )}

                  <Button type="submit" disabled={loading}>
                    {loading ? "Verifying…" : "Verify"}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUseRecovery(!useRecovery);
                      setError(null);
                    }}
                  >
                    {useRecovery ? "← Use authenticator app instead" : "Lost your phone? Use a recovery code"}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStep("password");
                      setError(null);
                      setTotpToken("");
                    }}
                  >
                    ← Back to password
                  </Button>
                </form>
              </CardContent>
            </div>
          )}
        </div>

        <p>
          <span>&copy; 2026 Cyrus Sepasi. All rights reserved. Portfolio Studio&trade; is a product of L&amp;D PRO.</span>
          <span>
            <span>Terms of Service</span>
            <span>|</span>
            <span>Privacy Policy</span>
          </span>
        </p>
      </div>
    </div>
  );
}
