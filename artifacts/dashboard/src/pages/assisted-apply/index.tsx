import { useQueryClient } from "@tanstack/react-query";
import {
  getListApplicationSessionsQueryKey,
  useCreateApplicationSession,
  useListApplicationSessions,
} from "@workspace/api-client-react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MousePointerClick, ShieldAlert, ClipboardCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/api-errors";
import { useState } from "react";

const DEFAULT_SESSION = {
  platform: "greenhouse",
  targetUrl: "",
  jobId: "",
  currentStep: "User opens job site and logs in manually",
  humanCheckpoint: "final_submit",
};

export default function AssistedApplyPage() {
  const [form, setForm] = useState(DEFAULT_SESSION);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: sessions = [], isLoading } = useListApplicationSessions();

  const createSession = useCreateApplicationSession({
    mutation: {
      onSuccess: () => {
        toast({ title: "Assisted apply session created" });
        setForm(DEFAULT_SESSION);
        queryClient.invalidateQueries({ queryKey: getListApplicationSessionsQueryKey() });
      },
      onError: (error) =>
        toast({
          title: "Failed to create session",
          description: getErrorMessage(error, "Please check the session fields."),
          variant: "destructive",
        }),
    },
  });

  const handleCreateSession = () => {
    createSession.mutate({
      data: {
          platform: form.platform,
          targetUrl: form.targetUrl || null,
          jobId: form.jobId ? Number(form.jobId) : null,
          status: "draft",
          currentStep: form.currentStep,
          humanCheckpoint: form.humanCheckpoint,
          metadata: {
            policy: "assist_only",
            finalSubmission: "human_required",
          },
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assisted Apply"
        subtitle="Let AI guide you through multi-step job applications."
        gradient="from-amber-500 via-amber-400 to-orange-400"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <ContentCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4" />
              Safety Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>LinkedIn, Indeed, ZipRecruiter, and Upwork stay assist-only unless official permission exists.</p>
            <p>The user handles login, MFA, CAPTCHA, EEO, legal authorization, and final submit.</p>
            <p>Every browser action should be logged before we add any worker automation.</p>
          </CardContent>
        </ContentCard>

        <ContentCard className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Start Assisted Session</CardTitle>
            <CardDescription>Create an audit record before using guided copy/fill workflows.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                value={form.platform}
                onChange={(event) => setForm({ ...form, platform: event.target.value })}
                placeholder="platform"
              />
              <Input
                value={form.jobId}
                onChange={(event) => setForm({ ...form, jobId: event.target.value })}
                placeholder="Job ID optional"
                type="number"
              />
              <Input
                value={form.humanCheckpoint}
                onChange={(event) => setForm({ ...form, humanCheckpoint: event.target.value })}
                placeholder="checkpoint"
              />
            </div>
            <Input
              value={form.targetUrl}
              onChange={(event) => setForm({ ...form, targetUrl: event.target.value })}
              placeholder="Target application URL"
            />
            <Textarea
              value={form.currentStep}
              onChange={(event) => setForm({ ...form, currentStep: event.target.value })}
              placeholder="Current guided step"
            />
            <Button disabled={!form.platform || createSession.isPending} onClick={handleCreateSession}>
              {createSession.isPending ? "Creating..." : "Create Session"}
            </Button>
          </CardContent>
        </ContentCard>
      </div>

      <ContentCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Session Log
          </CardTitle>
          <CardDescription>These records are the audit trail for future Playwright or extension-assisted workflows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
          {sessions.length === 0 && !isLoading ? (
            <p className="text-sm text-muted-foreground">No assisted apply sessions yet.</p>
          ) : null}
          {sessions.map((session) => (
            <div key={session.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{session.platform}</span>
                <Badge variant="outline">{session.status}</Badge>
              </div>
              <p className="mt-1 text-muted-foreground">{session.targetUrl || "No URL recorded"}</p>
              <p className="mt-1">Checkpoint: {session.humanCheckpoint || "human review"}</p>
            </div>
          ))}
        </CardContent>
      </ContentCard>
    </div>
  );
}
