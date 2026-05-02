import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentCard } from "@/components/ui/content-card";
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
 <div className="min-h-screen bg-surface flex items-center justify-center p-4">
 <div className="w-full max-w-md">
 <div className="card-chunky p-8">
 <div className="text-center mb-6">
 <h1 className="text-2xl font-bold gradient-text">Job Ops</h1>
 <p className="text-muted text-sm mt-1">Check your inbox for a verification link</p>
 </div>

 <CardHeader className="text-center">
 {status === "loading" ? (
 <>
 <Loader2 className="h-12 w-12 text-primary mx-auto mb-2 animate-spin" />
 <CardTitle>Verifying your email</CardTitle>
 <CardDescription>Please wait a moment...</CardDescription>
 </>
 ) : status === "success" ? (
 <>
 <CheckCircle className="h-12 w-12 text-success mx-auto mb-2" />
 <CardTitle>Email Verified</CardTitle>
 <CardDescription>
 Your account is now active. You can sign in and start using Job Ops.
 </CardDescription>
 </>
 ) : (
 <>
 <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
 <CardTitle>Verification Failed</CardTitle>
 <CardDescription>{message}</CardDescription>
 </>
 )}
 </CardHeader>
 <CardContent className="text-center">
 {status !== "loading" && (
 <Button className="w-full" onClick={() => navigate("/login")}>
 Go to Sign In
 </Button>
 )}
 {status === "error" && (
 <p className="text-xs text-muted-foreground mt-3">
 You can request a new verification email from the sign in page.
 </p>
 )}
 </CardContent>
 </div>
 </div>
 </div>
 );
}
