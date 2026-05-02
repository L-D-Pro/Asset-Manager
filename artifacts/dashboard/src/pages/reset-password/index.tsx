import { useState, type FormEvent, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentCard } from "@/components/ui/content-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyRound, AlertCircle, CheckCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [requested, setRequested] = useState(false);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setRequested(true);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? "Reset failed");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen gamify-gradient-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card-chunky p-8 shadow-2xl border-white/10">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold gradient-text">Job Ops</h1>
            <p className="text-muted text-sm mt-1">Enter your email to receive a reset link</p>
          </div>

          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              {token ? "Set New Password" : "Forgot Password?"}
            </CardTitle>
            <CardDescription>
              {token
                ? "Choose a new password for your account."
                : "Enter your email and we'll send you a reset link."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {done && (
              <div className="text-center space-y-3">
                <CheckCircle className="h-10 w-10 text-success mx-auto" />
                <p className="text-sm">Password reset successfully.</p>
                <Button className="w-full" onClick={() => navigate("/login")}>
                  Go to Sign In
                </Button>
              </div>
            )}
            {requested && !done && (
              <div className="text-center space-y-3">
                <CheckCircle className="h-10 w-10 text-success mx-auto" />
                <p className="text-sm">
                  If an account with that email exists, we've sent a reset link. Check your inbox.
                </p>
                <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
                  Back to Sign In
                </Button>
              </div>
            )}
            {!done && !requested && token && (
              <form onSubmit={handleReset} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
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
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            )}
            {!done && !requested && !token && (
              <form onSubmit={handleRequest} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
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
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            )}
          </CardContent>
        </div>

        <p className="text-center text-xs text-white/60 mt-6">
          <Link to="/login" className="text-white/80 underline hover:text-white">Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
