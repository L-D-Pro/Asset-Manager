import { useState, type FormEvent, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div>
      <div>
        <div>
          <div>
            <h1>Job Ops</h1>
            <p>Enter your email to receive a reset link</p>
          </div>

          <CardHeader>
            <CardTitle>
              <KeyRound />
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
              <div>
                <CheckCircle />
                <p>Password reset successfully.</p>
                <Button onClick={() => navigate("/login")}>
                  Go to Sign In
                </Button>
              </div>
            )}
            {requested && !done && (
              <div>
                <CheckCircle />
                <p>
                  If an account with that email exists, we've sent a reset link. Check your inbox.
                </p>
                <Button variant="outline" onClick={() => navigate("/login")}>
                  Back to Sign In
                </Button>
              </div>
            )}
            {!done && !requested && token && (
              <form onSubmit={handleReset}>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div>
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
                <div>
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
                <Button type="submit" disabled={loading}>
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            )}
            {!done && !requested && !token && (
              <form onSubmit={handleRequest}>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div>
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
                <Button type="submit" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            )}
          </CardContent>
        </div>

        <p>
          <Link to="/login">Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
