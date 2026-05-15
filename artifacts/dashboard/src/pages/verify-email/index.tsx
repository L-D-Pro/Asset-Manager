import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/auth/verify-email/${token}`, { redirect: "follow" });
        if (res.ok || res.redirected) {
          setStatus("success");
        } else {
          setStatus("error");
          setMessage("Verification failed. The link may be expired or invalid.");
        }
      } catch {
        setStatus("error");
        setMessage("Could not connect to the server.");
      }
    })();
  }, [token]);

  return (
    <div>
      <div>
        <div>
          <div>
            <h1>Job Ops</h1>
            <p>Check your inbox for a verification link</p>
          </div>

          <CardHeader>
            {status === "loading" ? (
              <>
                <Loader2 />
                <CardTitle>Verifying your email</CardTitle>
                <CardDescription>Please wait a moment...</CardDescription>
              </>
            ) : status === "success" ? (
              <>
                <CheckCircle />
                <CardTitle>Email Verified</CardTitle>
                <CardDescription>
                  Your account is now active. You can sign in and start using Job Ops.
                </CardDescription>
              </>
            ) : (
              <>
                <AlertCircle />
                <CardTitle>Verification Failed</CardTitle>
                <CardDescription>{message}</CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            {status !== "loading" && (
              <Button onClick={() => navigate("/login")}>
                Go to Sign In
              </Button>
            )}
            {status === "error" && (
              <p>
                You can request a new verification email from the sign in page.
              </p>
            )}
          </CardContent>
        </div>
      </div>
    </div>
  );
}
