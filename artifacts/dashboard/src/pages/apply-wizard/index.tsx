import { useEffect, useMemo, useRef, useState } from "react";
import {
  approveCoverLetterVersion,
  approveResumeVersion,
  createJob as createJobRequest,
  draftCoverLetter as draftCoverLetterRequest,
  getJobClaimMatches,
  parseJobDescription,
  tailorJobResume as tailorJobResumeRequest,
  updateJob as updateJobRequest,
  useApproveCoverLetterVersion,
  useApproveResumeVersion,
  useCreateApplicationSession,
  useCreateJob,
  useCreateRoleProfile,
  useCreateWizardSession,
  useDeleteWizardSession,
  useDraftCoverLetter,
  useListWizardSessions,
  getGetCoverLetterVersionQueryKey,
  getGetJobClaimMatchesQueryKey,
  getGetJobQueryKey,
  getGetResumeVersionQueryKey,
  useGetCoverLetterVersion,
  useGetJob,
  useGetJobClaimMatches,
  useGetResumeVersion,
  useListRoleProfiles,
  useParseJobDescription,
  useRejectCoverLetterVersion,
  useRejectResumeVersion,
  useTailorJobResume,
  useUpdateJob,
} from "@workspace/api-client-react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentCard } from "@/components/ui/content-card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Link2, ClipboardCheck, Wand2, ShieldCheck, MousePointerClick, UserCircle, Tag, Check, AlertCircle, ChevronRight, Download, Save, Upload, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/api-errors";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { easing } from "@/lib/animations";

const ENABLE_WIZARD = import.meta.env.VITE_ENABLE_APPLY_WIZARD === "true";

type WizardStep = "intake" | "parse" | "role" | "tailor" | "approve" | "assisted";
type IntakeMode = "single" | "batch";
type BatchRunStatus = "pending" | "ingested" | "parsed" | "generated" | "approved" | "failed";

type BatchEntry = {
  title: string;
  company: string;
  location: string;
  sourceUrl: string;
  rawJdText: string;
};

type BatchRun = {
  id: string;
  index: number;
  title: string;
  company: string;
  status: BatchRunStatus;
  message: string;
  jobId?: number;
  resumeVersionId?: number;
  coverLetterVersionId?: number;
  resumeStatus?: "approved" | "pending";
  coverStatus?: "approved" | "pending";
};

type ModelCatalogItem = {
  id: string;
  name: string;
  contextLength: number | null;
  isConfigured: boolean;
  configuredScopes: string[];
  isDefaultForResumeTailoring: boolean;
  isDefaultForCoverLetter: boolean;
};

type CompareCandidate = {
  modelName: string;
  provider: string;
  status: "succeeded" | "failed";
  preview?: string;
  notes?: string;
  runId?: string | null;
  eventLogId?: number | null;
  error?: string;
};

const ROLE_COLORS: Record<string, string> = {
  opening: "bg-primary/10 border-primary/20",
  hook: "bg-purple-50 border-purple-100 dark:bg-purple-950/20 dark:border-purple-900/30",
  body: "bg-success/10 border-success/20",
  closing: "bg-warning/10 border-warning/20",
};

const ROLE_LABEL_COLORS: Record<string, string> = {
  opening: "text-primary bg-primary/10",
  hook: "text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-900/50",
  body: "text-success bg-success/10",
  closing: "text-warning bg-warning/10",
};

const STEP_ORDER: WizardStep[] = ["intake", "parse", "role", "tailor", "approve", "assisted"];

function splitCsvOrLines(value: string): string[] {
  return value
    .split(/[,\n]/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseBatchEntries(text: string): BatchEntry[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const maybeHeader = lines[0].toLowerCase();
  const hasHeader = maybeHeader.includes("title") && maybeHeader.includes("company");
  const bodyLines = hasHeader ? lines.slice(1) : lines;

  return bodyLines
    .map((line) => {
      const parts = line.split(",").map((part) => part.trim());
      return {
        title: parts[0] ?? "",
        company: parts[1] ?? "",
        location: parts[2] ?? "",
        sourceUrl: parts[3] ?? "",
        rawJdText: parts.slice(4).join(",") ?? "",
      };
    })
    .filter((entry) => entry.title && entry.company);
}

export default function ApplyWizardPage() {
  const { toast } = useToast();
  const [step, setStep] = useState<WizardStep>("intake");
  const [intakeMode, setIntakeMode] = useState<IntakeMode>("single");

  const [intake, setIntake] = useState({
    title: "",
    company: "",
    location: "",
    sourceUrl: "",
    rawJdText: "",
  });

  const [jobId, setJobId] = useState<number | null>(null);
  const [selectedRoleProfileId, setSelectedRoleProfileId] = useState<number | null>(null);
  const [selectedClaimIds, setSelectedClaimIds] = useState<number[]>([]);
  const [resumeVersionId, setResumeVersionId] = useState<number | null>(null);
  const [coverLetterVersionId, setCoverLetterVersionId] = useState<number | null>(null);
  const [assistedSessionId, setAssistedSessionId] = useState<number | null>(null);
  const [batchText, setBatchText] = useState("");
  const [batchRuns, setBatchRuns] = useState<BatchRun[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchFilter, setBatchFilter] = useState<"all" | "failed" | "generated" | "approved">("all");
  const [useCustomComparison, setUseCustomComparison] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [comparisonRunning, setComparisonRunning] = useState(false);
  const [promoting, setPromoting] = useState<"resume" | "cover" | null>(null);
  const [modelCatalog, setModelCatalog] = useState<ModelCatalogItem[]>([]);
  const [resumeModelQuery, setResumeModelQuery] = useState("");
  const [coverModelQuery, setCoverModelQuery] = useState("");
  const [resumeCompareModels, setResumeCompareModels] = useState<string[]>([]);
  const [coverCompareModels, setCoverCompareModels] = useState<string[]>([]);
  const [resumeCandidates, setResumeCandidates] = useState<CompareCandidate[]>([]);
  const [coverCandidates, setCoverCandidates] = useState<CompareCandidate[]>([]);
  const [selectedResumeWinner, setSelectedResumeWinner] = useState<string | null>(null);
  const [selectedCoverWinner, setSelectedCoverWinner] = useState<string | null>(null);
  const [activeResumeTab, setActiveResumeTab] = useState<string | null>(null);
  const [activeCoverTab, setActiveCoverTab] = useState<string | null>(null);

  const [quickProfile, setQuickProfile] = useState({
    name: "",
    requiredKeywords: "",
    blockedKeywords: "",
    minSalary: "",
    softKeywords: "",
  });

  const [parsedDraft, setParsedDraft] = useState({
    requiredSkills: "",
    niceSkills: "",
    responsibilities: "",
    keywords: "",
  });

  const [assistedForm, setAssistedForm] = useState({
    platform: "greenhouse",
    targetUrl: "",
    humanCheckpoint: "final_submit",
    currentStep: "Review job post and fill fields with approved materials",
    notes: "",
  });

  const createJob = useCreateJob();
  const parseJob = useParseJobDescription();
  const updateJob = useUpdateJob();
  const createRoleProfile = useCreateRoleProfile();
  const tailorResume = useTailorJobResume();
  const draftCoverLetter = useDraftCoverLetter();
  const approveResume = useApproveResumeVersion();
  const rejectResume = useRejectResumeVersion();
  const approveCover = useApproveCoverLetterVersion();
  const rejectCover = useRejectCoverLetterVersion();
  const createSession = useCreateApplicationSession();
  const createWizardSession = useCreateWizardSession();
  const deleteWizardSession = useDeleteWizardSession();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedSessions, setSavedSessions] = useState<Array<{
    id: number;
    jobId: number | null;
    currentStep: string;
    state: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }>>([]);
  const [savingSession, setSavingSession] = useState(false);

  const { data: roleProfiles = [] } = useListRoleProfiles();
  const { data: apiSessions, refetch: refetchSessions } = useListWizardSessions();
  const { data: job, isLoading: jobLoading, refetch: refetchJob } = useGetJob(jobId ?? 0, {
    query: { enabled: !!jobId, queryKey: getGetJobQueryKey(jobId ?? 0) },
  });

  const { data: claimMatches = [] } = useGetJobClaimMatches(jobId ?? 0, {
    query: {
      enabled: !!jobId,
      queryKey: getGetJobClaimMatchesQueryKey(jobId ?? 0),
    },
  });

  const requestJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, {
      credentials: "include",
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const data = (await response.json()) as { error?: string; message?: string };
        message = data.error || data.message || message;
      } catch {
        // Ignore parse errors and use default status message.
      }
      throw new Error(message);
    }

    return (await response.json()) as T;
  };

  const { data: resumeVersion, refetch: refetchResumeVersion } = useGetResumeVersion(resumeVersionId ?? 0, {
    query: {
      enabled: !!resumeVersionId,
      queryKey: getGetResumeVersionQueryKey(resumeVersionId ?? 0),
    },
  });

  const { data: coverLetterVersion, refetch: refetchCoverLetterVersion } = useGetCoverLetterVersion(coverLetterVersionId ?? 0, {
    query: {
      enabled: !!coverLetterVersionId,
      queryKey: getGetCoverLetterVersionQueryKey(coverLetterVersionId ?? 0),
    },
  });

  useEffect(() => {
    if (!job) return;
    setParsedDraft({
      requiredSkills: (job.parsedRequiredSkills ?? []).join("\n"),
      niceSkills: (job.parsedNiceToHaveSkills ?? []).join("\n"),
      responsibilities: (job.parsedResponsibilities ?? []).join("\n"),
      keywords: (job.parsedKeywords ?? []).join(", "),
    });
    if (job.roleProfileId != null) {
      setSelectedRoleProfileId(job.roleProfileId);
    }
  }, [job]);

  useEffect(() => {
    if (claimMatches.length === 0) return;
    if (selectedClaimIds.length > 0) return;
    setSelectedClaimIds(
      claimMatches
        .slice(0, 15)
        .map((m: any) => m.claim?.id)
        .filter((id: unknown): id is number => typeof id === "number"),
    );
  }, [claimMatches, selectedClaimIds.length]);

  useEffect(() => {
    if (resumeCandidates.length > 0 && !activeResumeTab) {
      setActiveResumeTab(resumeCandidates[0].modelName);
    }
  }, [resumeCandidates, activeResumeTab]);

  useEffect(() => {
    if (coverCandidates.length > 0 && !activeCoverTab) {
      setActiveCoverTab(coverCandidates[0].modelName);
    }
  }, [coverCandidates, activeCoverTab]);

  useEffect(() => {
    if (!ENABLE_WIZARD) return;
    let cancelled = false;
    const loadModelCatalog = async () => {
      setCatalogLoading(true);
      try {
        const payload = await requestJson<{ models: ModelCatalogItem[] }>("/api/ai-model-catalog", {
          method: "GET",
          headers: {},
        });
        if (!cancelled) {
          setModelCatalog(payload.models ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Failed to load model catalog",
            description: getErrorMessage(error, "Model autocomplete is unavailable right now."),
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    };

    loadModelCatalog();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    if (apiSessions && apiSessions.length > 0) {
      setSavedSessions(apiSessions as unknown as Array<{
        id: number;
        jobId: number | null;
        currentStep: string;
        state: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
      }>);
    }
  }, [apiSessions]);

  const currentStepIndex = STEP_ORDER.indexOf(step);

  const visibleBatchRuns = useMemo(() => {
    if (batchFilter === "all") return batchRuns;
    return batchRuns.filter((run) => run.status === batchFilter);
  }, [batchFilter, batchRuns]);

  const progress = useMemo(() => {
    const hasJob = !!jobId;
    const hasParse = !!job?.parsedRequiredSkills?.length;
    const hasRole = selectedRoleProfileId != null;
    const hasTailor = !!resumeVersionId && !!coverLetterVersionId;
    const hasApproval =
      resumeVersion?.status === "approved" &&
      coverLetterVersion?.status === "approved";
    const hasAssisted = assistedSessionId != null;

    return {
      hasJob,
      hasParse,
      hasRole,
      hasTailor,
      hasApproval,
      hasAssisted,
    };
  }, [
    assistedSessionId,
    coverLetterVersion?.status,
    coverLetterVersionId,
    job?.parsedRequiredSkills,
    jobId,
    resumeVersion?.status,
    resumeVersionId,
    selectedRoleProfileId,
  ]);

  const updateBatchRun = (id: string, patch: Partial<BatchRun>) => {
    setBatchRuns((prev) => prev.map((run) => (run.id === id ? { ...run, ...patch } : run)));
  };

  const filteredResumeModels = useMemo(() => {
    const q = resumeModelQuery.trim().toLowerCase();
    return modelCatalog
      .filter((item) => !resumeCompareModels.includes(item.id))
      .filter((item) => (q ? item.id.toLowerCase().includes(q) || item.name.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [modelCatalog, resumeCompareModels, resumeModelQuery]);

  const filteredCoverModels = useMemo(() => {
    const q = coverModelQuery.trim().toLowerCase();
    return modelCatalog
      .filter((item) => !coverCompareModels.includes(item.id))
      .filter((item) => (q ? item.id.toLowerCase().includes(q) || item.name.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [coverCompareModels, coverModelQuery, modelCatalog]);

  const addCompareModel = (target: "resume" | "cover", modelId: string) => {
    const normalized = modelId.trim();
    if (!normalized) return;
    const exists = modelCatalog.some((m) => m.id === normalized);
    if (!exists) {
      toast({ title: "Model not found", description: "Choose a model from the OpenRouter catalog list.", variant: "destructive" });
      return;
    }

    if (target === "resume") {
      if (resumeCompareModels.length >= 3) return;
      if (resumeCompareModels.includes(normalized)) return;
      setResumeCompareModels((prev) => [...prev, normalized]);
      setResumeModelQuery("");
      return;
    }

    if (coverCompareModels.length >= 3) return;
    if (coverCompareModels.includes(normalized)) return;
    setCoverCompareModels((prev) => [...prev, normalized]);
    setCoverModelQuery("");
  };

  const removeCompareModel = (target: "resume" | "cover", modelId: string) => {
    if (target === "resume") {
      setResumeCompareModels((prev) => prev.filter((m) => m !== modelId));
      if (selectedResumeWinner === modelId) setSelectedResumeWinner(null);
      return;
    }
    setCoverCompareModels((prev) => prev.filter((m) => m !== modelId));
    if (selectedCoverWinner === modelId) setSelectedCoverWinner(null);
  };

  const handleBatchFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      setBatchText(content);
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const csv = "title,company,location,url,jd\n\"Software Engineer\",\"Acme Corp\",\"Remote\",\"https://example.com/job\",\"Full job description here\"";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "batch-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const buildWizardState = (): Record<string, unknown> => ({
    jobId,
    intake,
    intakeMode,
    parsedDraft,
    quickProfile,
    selectedRoleProfileId,
    selectedClaimIds,
    resumeVersionId,
    coverLetterVersionId,
    assistedSessionId,
    assistedForm,
    batchText,
    batchRuns,
    useCustomComparison,
    resumeCompareModels,
    coverCompareModels,
  });

  const handleSaveSession = async () => {
    setSavingSession(true);
    try {
      await createWizardSession.mutateAsync({
        data: {
          jobId: jobId ?? null,
          currentStep: step,
          state: buildWizardState(),
        },
      });
      refetchSessions();
      toast({ title: "Progress saved" });
    } catch (error) {
      toast({
        title: "Failed to save",
        description: getErrorMessage(error, "Try again."),
        variant: "destructive",
      });
    } finally {
      setSavingSession(false);
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    try {
      await deleteWizardSession.mutateAsync({ id: sessionId });
      refetchSessions();
      toast({ title: "Saved session deleted" });
    } catch (error) {
      toast({
        title: "Failed to delete",
        description: getErrorMessage(error, "Try again."),
        variant: "destructive",
      });
    }
  };

  const handleResumeSession = (session: { currentStep: string; jobId: number | null; state: Record<string, unknown> }) => {
    const s = session.state as Record<string, unknown>;
    if (s.jobId != null) setJobId(s.jobId as number);
    if (s.intake) setIntake(s.intake as typeof intake);
    if (s.intakeMode) setIntakeMode(s.intakeMode as IntakeMode);
    if (s.parsedDraft) setParsedDraft(s.parsedDraft as typeof parsedDraft);
    if (s.quickProfile) setQuickProfile(s.quickProfile as typeof quickProfile);
    if (s.selectedRoleProfileId != null) setSelectedRoleProfileId(s.selectedRoleProfileId as number);
    if (s.selectedClaimIds) setSelectedClaimIds(s.selectedClaimIds as number[]);
    if (s.resumeVersionId) setResumeVersionId(s.resumeVersionId as number);
    if (s.coverLetterVersionId) setCoverLetterVersionId(s.coverLetterVersionId as number);
    if (s.assistedSessionId) setAssistedSessionId(s.assistedSessionId as number);
    if (s.assistedForm) setAssistedForm(s.assistedForm as typeof assistedForm);
    if (s.batchText) setBatchText(s.batchText as string);
    if (s.useCustomComparison != null) setUseCustomComparison(s.useCustomComparison as boolean);
    if (s.resumeCompareModels) setResumeCompareModels(s.resumeCompareModels as string[]);
    if (s.coverCompareModels) setCoverCompareModels(s.coverCompareModels as string[]);
    setStep(session.currentStep as WizardStep);
    toast({ title: "Session restored" });
  };

  const handleRunBatch = async () => {
    const entries = parseBatchEntries(batchText);
    if (entries.length === 0) {
      toast({
        title: "No valid batch rows found",
        description: "Use CSV rows: title,company,location,url,jd",
        variant: "destructive",
      });
      return;
    }

    const initialRuns: BatchRun[] = entries.map((entry, index) => ({
      id: `${Date.now()}-${index}`,
      index: index + 1,
      title: entry.title,
      company: entry.company,
      status: "pending",
      message: "Waiting",
      resumeStatus: "pending",
      coverStatus: "pending",
    }));

    setBatchRuns(initialRuns);
    setBatchRunning(true);

    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i]!;
      const runId = initialRuns[i]!.id;

      try {
        updateBatchRun(runId, { status: "pending", message: "Creating job" });
        const created = await createJobRequest({
          title: entry.title,
          company: entry.company,
          location: entry.location || null,
          sourceUrl: entry.sourceUrl || null,
          rawJdText: entry.rawJdText || null,
          status: "new",
        });

        if (selectedRoleProfileId != null) {
          await updateJobRequest(created.id, { roleProfileId: selectedRoleProfileId });
        }

        updateBatchRun(runId, { status: "ingested", message: "Parsing JD", jobId: created.id });

        await parseJobDescription(created.id, { rawJdText: entry.rawJdText || "" });
        updateBatchRun(runId, { status: "parsed", message: "Matching claims + generating drafts" });

        const claimMatches = await getJobClaimMatches(created.id);
        const claimIds = claimMatches
          .slice(0, 12)
          .map((m: any) => m.claim?.id)
          .filter((id: unknown): id is number => typeof id === "number");

        const resume = await tailorJobResumeRequest(created.id, { claimIds });
        const cover = await draftCoverLetterRequest(created.id, { claimIds });

        updateBatchRun(runId, {
          status: "generated",
          message: "Drafts generated",
          resumeVersionId: resume.id,
          coverLetterVersionId: cover.id,
        });
      } catch (error) {
        updateBatchRun(runId, {
          status: "failed",
          message: getErrorMessage(error, "Batch item failed"),
        });
      }
    }

    setBatchRunning(false);
    toast({ title: `Batch finished (${entries.length} row${entries.length === 1 ? "" : "s"})` });
  };

  const handleBulkApprove = async () => {
    const candidates = batchRuns.filter(
      (run) => run.status === "generated" && run.resumeVersionId && run.coverLetterVersionId,
    );

    if (candidates.length === 0) {
      toast({
        title: "No generated drafts to approve",
        variant: "destructive",
      });
      return;
    }

    setBatchRunning(true);
    for (const run of candidates) {
      try {
        await approveResumeVersion(run.resumeVersionId!, {});
        await approveCoverLetterVersion(run.coverLetterVersionId!, {});
        updateBatchRun(run.id, {
          status: "approved",
          message: "Resume + cover letter approved",
          resumeStatus: "approved",
          coverStatus: "approved",
        });
      } catch (error) {
        updateBatchRun(run.id, {
          status: "failed",
          message: getErrorMessage(error, "Bulk approval failed"),
        });
      }
    }
    setBatchRunning(false);
    toast({ title: "Bulk approval completed" });
  };

  if (!ENABLE_WIZARD) {
    return (
      <ContentCard>
        <CardHeader>
          <CardTitle>Apply Wizard is disabled</CardTitle>
          <CardDescription>
            Set <code>VITE_ENABLE_APPLY_WIZARD=true</code> in dashboard env and restart dev server.
          </CardDescription>
        </CardHeader>
      </ContentCard>
    );
  }

  const handleCreateJob = () => {
    createJob.mutate(
      {
        data: {
          title: intake.title,
          company: intake.company,
          location: intake.location || null,
          sourceUrl: intake.sourceUrl || null,
          rawJdText: intake.rawJdText || null,
          status: "new",
        },
      },
      {
        onSuccess: (created) => {
          setJobId(created.id);
          toast({ title: "Job ingested" });
          setStep("parse");
        },
        onError: (error) =>
          toast({
            title: "Failed to ingest job",
            description: getErrorMessage(error, "Please check intake fields."),
            variant: "destructive",
          }),
      },
    );
  };

  const handleParse = () => {
    if (!jobId) return;
    parseJob.mutate(
      {
        id: jobId,
        data: {
          rawJdText: intake.rawJdText || job?.rawJdText || "",
        },
      },
      {
        onSuccess: (updated) => {
          setParsedDraft({
            requiredSkills: (updated.parsedRequiredSkills ?? []).join("\n"),
            niceSkills: (updated.parsedNiceToHaveSkills ?? []).join("\n"),
            responsibilities: (updated.parsedResponsibilities ?? []).join("\n"),
            keywords: (updated.parsedKeywords ?? []).join(", "),
          });
          toast({ title: "JD parsed" });
        },
        onError: (error) =>
          toast({
            title: "Failed to parse JD",
            description: getErrorMessage(error, "Paste JD text and retry."),
            variant: "destructive",
          }),
      },
    );
  };

  const handleSaveParsedEdits = () => {
    if (!jobId) return;
    const splitLines = (val: string) =>
      val
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

    updateJob.mutate(
      {
        id: jobId,
        data: {
          rawJdText: intake.rawJdText || null,
          parsedRequiredSkills: splitLines(parsedDraft.requiredSkills),
          parsedNiceToHaveSkills: splitLines(parsedDraft.niceSkills),
          parsedResponsibilities: splitLines(parsedDraft.responsibilities),
          parsedKeywords: parsedDraft.keywords
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          status: "scored",
        },
      },
      {
        onSuccess: () => {
          toast({ title: "JD saved" });
          refetchJob();
          setStep("role");
        },
        onError: (error) =>
          toast({
            title: "Failed to save JD",
            description: getErrorMessage(error, "Try again."),
            variant: "destructive",
          }),
      },
    );
  };

  const handleAttachRoleProfile = (roleProfileId: number) => {
    if (!jobId) return;
    updateJob.mutate(
      {
        id: jobId,
        data: {
          roleProfileId,
        },
      },
      {
        onSuccess: () => {
          setSelectedRoleProfileId(roleProfileId);
          toast({ title: "Role profile attached" });
          refetchJob();
        },
        onError: (error) =>
          toast({
            title: "Failed to attach role profile",
            description: getErrorMessage(error, "Try again."),
            variant: "destructive",
          }),
      },
    );
  };

  const handleQuickCreateRoleProfile = () => {
    if (!quickProfile.name.trim()) {
      toast({ title: "Profile name is required", variant: "destructive" });
      return;
    }

    const requiredKeywords = splitCsvOrLines(quickProfile.requiredKeywords);
    const blockedKeywords = splitCsvOrLines(quickProfile.blockedKeywords);
    const softKeywords = splitCsvOrLines(quickProfile.softKeywords);
    const minSalary = Number(quickProfile.minSalary || "0");

    const softWeights = Object.fromEntries(softKeywords.map((k) => [k, 5]));

    createRoleProfile.mutate(
      {
        data: {
          name: quickProfile.name,
          description: "Quick-created from Apply Wizard",
          hardFilters: {
            ...(requiredKeywords.length > 0 ? { requiredKeywords } : {}),
            ...(blockedKeywords.length > 0 ? { blockedKeywords } : {}),
            ...(minSalary > 0 ? { minSalary } : {}),
          },
          ...(Object.keys(softWeights).length > 0 ? { softWeights } : {}),
        },
      },
      {
        onSuccess: (profile) => {
          toast({ title: "Role profile created" });
          setSelectedRoleProfileId(profile.id);
          handleAttachRoleProfile(profile.id);
          setQuickProfile({
            name: "",
            requiredKeywords: "",
            blockedKeywords: "",
            minSalary: "",
            softKeywords: "",
          });
        },
        onError: (error) =>
          toast({
            title: "Failed to create profile",
            description: getErrorMessage(error, "Check quick-create fields."),
            variant: "destructive",
          }),
      },
    );
  };

  const handleToggleClaim = (claimId: number) => {
    setSelectedClaimIds((prev) =>
      prev.includes(claimId) ? prev.filter((id) => id !== claimId) : [...prev, claimId],
    );
  };

  const handleGenerateResume = () => {
    if (!jobId) return;
    tailorResume.mutate(
      {
        id: jobId,
        data: { claimIds: selectedClaimIds },
      },
      {
        onSuccess: (version) => {
          setResumeVersionId(version.id);
          toast({ title: `Resume draft created (#${version.id})` });
        },
        onError: (error) =>
          toast({
            title: "Failed to tailor resume",
            description: getErrorMessage(error, "Check base resume and claims."),
            variant: "destructive",
          }),
      },
    );
  };

  const handleGenerateCoverLetter = () => {
    if (!jobId) return;
    draftCoverLetter.mutate(
      {
        id: jobId,
        data: { claimIds: selectedClaimIds },
      },
      {
        onSuccess: (version) => {
          setCoverLetterVersionId(version.id);
          toast({ title: `Cover letter draft created (#${version.id})` });
        },
        onError: (error) =>
          toast({
            title: "Failed to draft cover letter",
            description: getErrorMessage(error, "Check parsed JD and claims."),
            variant: "destructive",
          }),
      },
    );
  };

  const handleCompareResume = async () => {
    if (!jobId) return;
    if (resumeCompareModels.length === 0) {
      toast({ title: "Select at least one resume model", variant: "destructive" });
      return;
    }

    setComparisonRunning(true);
    try {
      const result = await requestJson<{ comparisonRunId: string; candidates: CompareCandidate[] }>(
        `/api/jobs/${jobId}/compare/resume`,
        {
          method: "POST",
          body: JSON.stringify({
            claimIds: selectedClaimIds,
            models: resumeCompareModels.map((modelName) => ({ provider: "openrouter", modelName })),
          }),
        },
      );
      setResumeCandidates(result.candidates ?? []);
      setSelectedResumeWinner(null);
      toast({ title: "Resume comparison finished" });
    } catch (error) {
      toast({
        title: "Resume comparison failed",
        description: getErrorMessage(error, "Try with fewer models or different model IDs."),
        variant: "destructive",
      });
    } finally {
      setComparisonRunning(false);
    }
  };

  const handleCompareCover = async () => {
    if (!jobId) return;
    if (coverCompareModels.length === 0) {
      toast({ title: "Select at least one cover letter model", variant: "destructive" });
      return;
    }

    setComparisonRunning(true);
    try {
      const result = await requestJson<{ comparisonRunId: string; candidates: CompareCandidate[] }>(
        `/api/jobs/${jobId}/compare/cover-letter`,
        {
          method: "POST",
          body: JSON.stringify({
            claimIds: selectedClaimIds,
            models: coverCompareModels.map((modelName) => ({ provider: "openrouter", modelName })),
          }),
        },
      );
      setCoverCandidates(result.candidates ?? []);
      setSelectedCoverWinner(null);
      toast({ title: "Cover letter comparison finished" });
    } catch (error) {
      toast({
        title: "Cover letter comparison failed",
        description: getErrorMessage(error, "Try with fewer models or different model IDs."),
        variant: "destructive",
      });
    } finally {
      setComparisonRunning(false);
    }
  };

  const handlePromoteResumeWinner = async () => {
    if (!jobId || !selectedResumeWinner) return;
    setPromoting("resume");
    try {
      const version = await requestJson<{ id: number }>(`/api/jobs/${jobId}/compare/promote-resume`, {
        method: "POST",
        body: JSON.stringify({
          claimIds: selectedClaimIds,
          model: { provider: "openrouter", modelName: selectedResumeWinner },
        }),
      });
      setResumeVersionId(version.id);
      toast({ title: `Promoted resume winner (#${version.id})` });
    } catch (error) {
      toast({
        title: "Failed to promote resume winner",
        description: getErrorMessage(error, "Try another model candidate."),
        variant: "destructive",
      });
    } finally {
      setPromoting(null);
    }
  };

  const handlePromoteCoverWinner = async () => {
    if (!jobId || !selectedCoverWinner) return;
    setPromoting("cover");
    try {
      const version = await requestJson<{ id: number }>(`/api/jobs/${jobId}/compare/promote-cover-letter`, {
        method: "POST",
        body: JSON.stringify({
          claimIds: selectedClaimIds,
          model: { provider: "openrouter", modelName: selectedCoverWinner },
        }),
      });
      setCoverLetterVersionId(version.id);
      toast({ title: `Promoted cover winner (#${version.id})` });
    } catch (error) {
      toast({
        title: "Failed to promote cover winner",
        description: getErrorMessage(error, "Try another model candidate."),
        variant: "destructive",
      });
    } finally {
      setPromoting(null);
    }
  };

  const handleApproveResume = () => {
    if (!resumeVersionId) return;
    approveResume.mutate(
      { id: resumeVersionId, data: {} },
      {
        onSuccess: () => {
          toast({ title: "Resume approved" });
          refetchResumeVersion();
        },
        onError: (error) =>
          toast({
            title: "Failed to approve resume",
            description: getErrorMessage(error, "Try again."),
            variant: "destructive",
          }),
      },
    );
  };

  const handleRejectResume = () => {
    if (!resumeVersionId) return;
    rejectResume.mutate(
      { id: resumeVersionId, data: {} },
      {
        onSuccess: () => {
          toast({ title: "Resume rejected" });
          refetchResumeVersion();
        },
        onError: (error) =>
          toast({
            title: "Failed to reject resume",
            description: getErrorMessage(error, "Try again."),
            variant: "destructive",
          }),
      },
    );
  };

  const handleApproveCover = () => {
    if (!coverLetterVersionId) return;
    approveCover.mutate(
      { id: coverLetterVersionId, data: {} },
      {
        onSuccess: () => {
          toast({ title: "Cover letter approved" });
          refetchCoverLetterVersion();
        },
        onError: (error) =>
          toast({
            title: "Failed to approve cover letter",
            description: getErrorMessage(error, "Try again."),
            variant: "destructive",
          }),
      },
    );
  };

  const handleRejectCover = () => {
    if (!coverLetterVersionId) return;
    rejectCover.mutate(
      { id: coverLetterVersionId, data: {} },
      {
        onSuccess: () => {
          toast({ title: "Cover letter rejected" });
          refetchCoverLetterVersion();
        },
        onError: (error) =>
          toast({
            title: "Failed to reject cover letter",
            description: getErrorMessage(error, "Try again."),
            variant: "destructive",
          }),
      },
    );
  };

  const handleCreateAssistedSession = () => {
    if (!jobId) return;
    createSession.mutate(
      {
        data: {
          platform: assistedForm.platform,
          targetUrl: assistedForm.targetUrl || intake.sourceUrl || null,
          jobId,
          status: "draft",
          currentStep: assistedForm.currentStep,
          humanCheckpoint: assistedForm.humanCheckpoint,
          metadata: {
            notes: assistedForm.notes || null,
            policy: "assist_only",
            finalSubmission: "human_required",
          },
        },
      },
      {
        onSuccess: (session) => {
          setAssistedSessionId(session.id);
          toast({ title: `Assisted session created (#${session.id})` });
        },
        onError: (error) =>
          toast({
            title: "Failed to create assisted session",
            description: getErrorMessage(error, "Check session fields and retry."),
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Apply Wizard" subtitle="Multi-step AI-powered job application assistant." variant="workflow" />

      {savedSessions.length > 0 ? (
        <ContentCard className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Save className="h-4 w-4" />
              Saved Sessions
            </CardTitle>
            <CardDescription>Resume a previous wizard session or delete it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {savedSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <div>
                  <p className="font-medium">
                    {(session.state as Record<string, unknown>)?.intake
                      ? `${((session.state as Record<string, unknown>).intake as { title?: string; company?: string }).title || "Untitled"} — ${((session.state as Record<string, unknown>).intake as { company?: string }).company || "No company"}`
                      : "New job"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Step: {session.currentStep} · {new Date(session.updatedAt ?? session.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleResumeSession(session)}>
                    Resume
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteSession(session.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </ContentCard>
      ) : null}

      <div className="grid gap-4 md:grid-cols-6">
        {STEP_ORDER.map((name, index) => (
          <ContentCard
            key={name}
            className={
              index <= currentStepIndex
                ? "border-primary/50"
                : "border-dashed opacity-80"
            }
          >
            <CardContent className="p-3 text-center">
              <p className="text-xs uppercase text-muted-foreground">Step {index + 1}</p>
              <p className="text-sm font-medium capitalize">{name}</p>
              {index > currentStepIndex ? (
                <p className="text-[11px] text-muted-foreground mt-1">Locked</p>
              ) : null}
            </CardContent>
          </ContentCard>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard title="Ingested" ok={progress.hasJob} />
        <StatusCard title="Parsed" ok={progress.hasParse} />
        <StatusCard title="Role Profile" ok={progress.hasRole} />
        <StatusCard title="Drafts Generated" ok={progress.hasTailor} />
        <StatusCard title="Approved" ok={progress.hasApproval} />
        <StatusCard title="Assisted Session" ok={progress.hasAssisted} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: easing.smooth }}
        >
          {step === "intake" ? (
        <ContentCard className="gamify-radius-chunky">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              1) Intake Job
            </CardTitle>
            <CardDescription>Use single mode for guided end-to-end, or batch mode for Phase 2 bulk intake.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                variant={intakeMode === "single" ? "default" : "outline"}
                onClick={() => setIntakeMode("single")}
              >
                Single Job
              </Button>
              <Button
                variant={intakeMode === "batch" ? "default" : "outline"}
                onClick={() => setIntakeMode("batch")}
              >
                Batch (Phase 2)
              </Button>
            </div>

            {intakeMode === "single" ? (
              <>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Job title"
                value={intake.title}
                onChange={(e) => setIntake((prev) => ({ ...prev, title: e.target.value }))}
              />
              <Input
                placeholder="Company"
                value={intake.company}
                onChange={(e) => setIntake((prev) => ({ ...prev, company: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Location"
                value={intake.location}
                onChange={(e) => setIntake((prev) => ({ ...prev, location: e.target.value }))}
              />
              <Input
                placeholder="https://job-url"
                value={intake.sourceUrl}
                onChange={(e) => setIntake((prev) => ({ ...prev, sourceUrl: e.target.value }))}
              />
            </div>
            <Textarea
              placeholder="Paste full job description"
              className="min-h-40"
              value={intake.rawJdText}
              onChange={(e) => setIntake((prev) => ({ ...prev, rawJdText: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleSaveSession}
                disabled={savingSession}
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {savingSession ? "Saving..." : "Save & Continue Later"}
              </Button>
              <Button
                onClick={handleCreateJob}
                disabled={!intake.title || !intake.company || createJob.isPending}
                className="gamify-gradient-primary"
              >
                {createJob.isPending ? "Ingesting..." : "Create Job & Continue"}
              </Button>
            </div>
              </>
            ) : (
              <>
                <div className="rounded-md border p-3 space-y-3">
                  <p className="text-sm font-medium">Batch paste / CSV format</p>
                  <p className="text-xs text-muted-foreground">
                    One row per job: <code>title,company,location,url,jd</code>. Optional header row supported.
                  </p>
                  <Textarea
                    placeholder="title,company,location,url,jd"
                    className="min-h-44"
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv,text/plain"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) handleBatchFileUpload(file);
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Choose File
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}>
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Download Template
                    </Button>
                    <Button onClick={handleRunBatch} disabled={batchRunning || !batchText.trim()} className="gamify-gradient-primary">
                      {batchRunning ? "Running Batch..." : "Run Batch"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleBulkApprove}
                      disabled={batchRunning || batchRuns.every((run) => run.status !== "generated")}
                    >
                      Bulk Approve Generated
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Batch status</p>
                    <div className="flex items-center gap-2">
                      <Button variant={batchFilter === "all" ? "default" : "outline"} onClick={() => setBatchFilter("all")}>All</Button>
                      <Button variant={batchFilter === "failed" ? "default" : "outline"} onClick={() => setBatchFilter("failed")}>Failed</Button>
                      <Button variant={batchFilter === "generated" ? "default" : "outline"} onClick={() => setBatchFilter("generated")}>Generated</Button>
                      <Button variant={batchFilter === "approved" ? "default" : "outline"} onClick={() => setBatchFilter("approved")}>Approved</Button>
                    </div>
                  </div>

                  {visibleBatchRuns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No rows for this filter yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-auto">
                      {visibleBatchRuns.map((run) => (
                        <div key={run.id} className="rounded border p-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">#{run.index} {run.title} - {run.company}</p>
                            <Badge variant={run.status === "failed" ? "destructive" : run.status === "approved" ? "default" : "outline"}>
                              {run.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{run.message}</p>
                          <div className="text-xs mt-1 flex flex-wrap gap-3">
                            {run.jobId ? <Link className="underline" to={`/jobs/${run.jobId}`}>Job #{run.jobId}</Link> : null}
                            {run.resumeVersionId ? <Link className="underline" to="/resume-versions">Resume #{run.resumeVersionId}</Link> : null}
                            {run.coverLetterVersionId ? <Link className="underline" to="/cover-letters">Cover #{run.coverLetterVersionId}</Link> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </ContentCard>
      ) : null}

      {step === "parse" ? (
        <ContentCard className="gamify-radius-chunky">
          <CardHeader>
            <CardTitle>2) Parse and Edit JD</CardTitle>
            <CardDescription>
              Run parser, then edit parsed fields inline before continuing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobLoading ? <p className="text-sm text-muted-foreground">Loading job...</p> : null}
            <Textarea
              placeholder="Raw JD text"
              className="min-h-32"
              value={intake.rawJdText}
              onChange={(e) => setIntake((prev) => ({ ...prev, rawJdText: e.target.value }))}
            />

            <div className="grid gap-3 md:grid-cols-2">
              <Textarea
                placeholder="Required skills (one per line or comma separated)"
                className="min-h-28"
                value={parsedDraft.requiredSkills}
                onChange={(e) => setParsedDraft((prev) => ({ ...prev, requiredSkills: e.target.value }))}
              />
              <Textarea
                placeholder="Nice-to-have skills"
                className="min-h-28"
                value={parsedDraft.niceSkills}
                onChange={(e) => setParsedDraft((prev) => ({ ...prev, niceSkills: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Textarea
                placeholder="Responsibilities"
                className="min-h-28"
                value={parsedDraft.responsibilities}
                onChange={(e) => setParsedDraft((prev) => ({ ...prev, responsibilities: e.target.value }))}
              />
              <Textarea
                placeholder="Keywords"
                className="min-h-28"
                value={parsedDraft.keywords}
                onChange={(e) => setParsedDraft((prev) => ({ ...prev, keywords: e.target.value }))}
              />
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep("intake")}>Back</Button>
              <Button variant="outline" onClick={handleSaveSession} disabled={savingSession}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {savingSession ? "Saving..." : "Save & Continue Later"}
              </Button>
              <Button variant="secondary" onClick={handleParse} disabled={parseJob.isPending}>
                {parseJob.isPending ? "Parsing..." : "Run Parser"}
              </Button>
              <Button
                onClick={handleSaveParsedEdits}
                disabled={updateJob.isPending || !intake.rawJdText.trim()}
                className="gamify-gradient-primary"
              >
                {updateJob.isPending ? "Saving..." : "Save & Continue"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Continue unlocks Role + Claims after saving and reparsing JD text.
            </p>
          </CardContent>
        </ContentCard>
      ) : null}

      {step === "role" ? (
        <ContentCard className="gamify-radius-chunky">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              3) Role Profile and Claims
            </CardTitle>
            <CardDescription>
              Pick an existing role profile or quick-create one inline, then review matched claims.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border p-3 space-y-3">
              <p className="text-sm font-medium">Select existing role profile</p>
              <select
                className="w-full rounded border bg-background px-3 py-2 text-sm"
                value={selectedRoleProfileId ?? ""}
                onChange={(e) => setSelectedRoleProfileId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">No selection</option>
                {roleProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  disabled={selectedRoleProfileId == null || updateJob.isPending}
                  onClick={() => selectedRoleProfileId != null && handleAttachRoleProfile(selectedRoleProfileId)}
                >
                  Attach to Job
                </Button>
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-3">
              <p className="text-sm font-medium">Quick create role profile</p>
              <Input
                placeholder="Profile name"
                value={quickProfile.name}
                onChange={(e) => setQuickProfile((prev) => ({ ...prev, name: e.target.value }))}
              />
              <Input
                placeholder="Required keywords (comma separated)"
                value={quickProfile.requiredKeywords}
                onChange={(e) => setQuickProfile((prev) => ({ ...prev, requiredKeywords: e.target.value }))}
              />
              <Input
                placeholder="Blocked keywords (comma separated)"
                value={quickProfile.blockedKeywords}
                onChange={(e) => setQuickProfile((prev) => ({ ...prev, blockedKeywords: e.target.value }))}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  type="number"
                  placeholder="Minimum salary"
                  value={quickProfile.minSalary}
                  onChange={(e) => setQuickProfile((prev) => ({ ...prev, minSalary: e.target.value }))}
                />
                <Input
                  placeholder="Soft-weight keywords (comma separated)"
                  value={quickProfile.softKeywords}
                  onChange={(e) => setQuickProfile((prev) => ({ ...prev, softKeywords: e.target.value }))}
                />
              </div>
              <div className="flex justify-end">
                <Button variant="secondary" onClick={handleQuickCreateRoleProfile} disabled={createRoleProfile.isPending}>
                  {createRoleProfile.isPending ? "Creating..." : "Quick Create & Attach"}
                </Button>
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-3">
              <p className="text-sm font-medium">Matched claims</p>
              {claimMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No claim matches yet. Parse the JD first or create more claims.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-auto">
                  {claimMatches.map((match: any) => {
                    const claimId = match.claim?.id as number;
                    const isSelected = selectedClaimIds.includes(claimId);
                    return (
                      <label key={claimId} className="flex items-start gap-3 rounded border p-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleClaim(claimId)}
                          className="mt-1"
                        />
                        <div className="space-y-1">
                          <p className="font-medium">{match.claim?.summary ?? "Claim"}</p>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span>Score: {match.score}</span>
                            <span>Type: {match.matchType}</span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("parse")}>Back</Button>
              <Button variant="outline" onClick={handleSaveSession} disabled={savingSession}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {savingSession ? "Saving..." : "Save & Continue Later"}
              </Button>
              <Button
                onClick={() => setStep("tailor")}
                disabled={selectedRoleProfileId == null || selectedClaimIds.length === 0}
                className="gamify-gradient-primary"
              >
                Continue
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Continue requires an attached role profile and at least one selected claim.
            </p>
          </CardContent>
        </ContentCard>
      ) : null}

      {step === "tailor" ? (
        <ContentCard className="gamify-radius-chunky">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              4) Generate Drafts
            </CardTitle>
            <CardDescription>
              Generate tailored resume and cover letter from selected claims.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Selected claims: <span className="font-medium text-foreground">{selectedClaimIds.length}</span>
            </p>

            <div className="flex flex-wrap gap-2">
              <Button variant={useCustomComparison ? "outline" : "default"} onClick={() => setUseCustomComparison(false)}>
                Use system defaults
              </Button>
              <Button variant={useCustomComparison ? "default" : "outline"} onClick={() => setUseCustomComparison(true)}>
                Compare custom models (up to 3)
              </Button>
            </div>

            {!useCustomComparison ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={handleGenerateResume} disabled={tailorResume.isPending}>
                  {tailorResume.isPending ? "Generating Resume..." : "Generate Resume"}
                </Button>
                <Button variant="secondary" onClick={handleGenerateCoverLetter} disabled={draftCoverLetter.isPending}>
                  {draftCoverLetter.isPending ? "Generating Cover Letter..." : "Generate Cover Letter"}
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border p-3 space-y-3">
                  <p className="text-sm font-medium">Resume model comparison</p>
                  <Input
                    placeholder="Type model ID (e.g. openai/gpt-4o-mini)"
                    value={resumeModelQuery}
                    onChange={(e) => setResumeModelQuery(e.target.value)}
                    disabled={catalogLoading}
                  />
                  <div className="flex flex-wrap gap-2">
                    {resumeCompareModels.map((model) => (
                      <Badge key={model} variant="secondary" className="gap-2">
                        {model}
                        <button type="button" onClick={() => removeCompareModel("resume", model)}>x</button>
                      </Badge>
                    ))}
                  </div>
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {filteredResumeModels.map((model) => (
                      <button
                        type="button"
                        key={model.id}
                        className="w-full rounded border px-2 py-1 text-left text-xs hover:bg-muted"
                        onClick={() => addCompareModel("resume", model.id)}
                        disabled={resumeCompareModels.length >= 3}
                      >
                        <span className="font-medium">{model.id}</span>
                        <span className="ml-2 text-muted-foreground">{model.name}</span>
                        {model.isConfigured ? <Badge variant="outline" className="ml-2">Configured</Badge> : null}
                        {model.isDefaultForResumeTailoring ? <Badge className="ml-2">Resume Default</Badge> : null}
                      </button>
                    ))}
                  </div>
                  <Button onClick={handleCompareResume} disabled={comparisonRunning || resumeCompareModels.length === 0}>
                    {comparisonRunning ? "Running..." : "Run Resume Comparison"}
                  </Button>
                  {resumeCandidates.length > 0 ? (
                    <div className="space-y-2">
                      {resumeCandidates.map((candidate) => (
                        <div key={`resume-${candidate.modelName}`} className="rounded border p-2 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{candidate.modelName}</p>
                            <Badge variant={candidate.status === "failed" ? "destructive" : "outline"}>{candidate.status}</Badge>
                          </div>
                          <p className="text-muted-foreground whitespace-pre-wrap line-clamp-4">
                            {candidate.status === "failed" ? candidate.error : candidate.preview || candidate.notes || "No preview"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-md border p-3 space-y-3">
                  <p className="text-sm font-medium">Cover letter model comparison</p>
                  <Input
                    placeholder="Type model ID (e.g. anthropic/claude-3.5-haiku)"
                    value={coverModelQuery}
                    onChange={(e) => setCoverModelQuery(e.target.value)}
                    disabled={catalogLoading}
                  />
                  <div className="flex flex-wrap gap-2">
                    {coverCompareModels.map((model) => (
                      <Badge key={model} variant="secondary" className="gap-2">
                        {model}
                        <button type="button" onClick={() => removeCompareModel("cover", model)}>x</button>
                      </Badge>
                    ))}
                  </div>
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {filteredCoverModels.map((model) => (
                      <button
                        type="button"
                        key={model.id}
                        className="w-full rounded border px-2 py-1 text-left text-xs hover:bg-muted"
                        onClick={() => addCompareModel("cover", model.id)}
                        disabled={coverCompareModels.length >= 3}
                      >
                        <span className="font-medium">{model.id}</span>
                        <span className="ml-2 text-muted-foreground">{model.name}</span>
                        {model.isConfigured ? <Badge variant="outline" className="ml-2">Configured</Badge> : null}
                        {model.isDefaultForCoverLetter ? <Badge className="ml-2">Cover Default</Badge> : null}
                      </button>
                    ))}
                  </div>
                  <Button onClick={handleCompareCover} disabled={comparisonRunning || coverCompareModels.length === 0}>
                    {comparisonRunning ? "Running..." : "Run Cover Comparison"}
                  </Button>
                  {coverCandidates.length > 0 ? (
                    <div className="space-y-2">
                      {coverCandidates.map((candidate) => (
                        <div key={`cover-${candidate.modelName}`} className="rounded border p-2 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{candidate.modelName}</p>
                            <Badge variant={candidate.status === "failed" ? "destructive" : "outline"}>{candidate.status}</Badge>
                          </div>
                          <p className="text-muted-foreground whitespace-pre-wrap line-clamp-4">
                            {candidate.status === "failed" ? candidate.error : candidate.preview || candidate.notes || "No preview"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Badge variant={resumeVersionId ? "default" : "outline"}>
                Resume Draft {resumeVersionId ? `#${resumeVersionId}` : "not created"}
              </Badge>
              <Badge variant={coverLetterVersionId ? "default" : "outline"}>
                Cover Letter Draft {coverLetterVersionId ? `#${coverLetterVersionId}` : "not created"}
              </Badge>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("role")}>Back</Button>
              <Button variant="outline" onClick={handleSaveSession} disabled={savingSession}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {savingSession ? "Saving..." : "Save & Continue Later"}
              </Button>
              <Button
                onClick={() => setStep("approve")}
                disabled={
                  useCustomComparison
                    ? resumeCandidates.length === 0 || coverCandidates.length === 0
                    : !resumeVersionId || !coverLetterVersionId
                }
                className="gamify-gradient-primary"
              >
                Continue
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Continue requires both draft artifacts: one resume version and one cover letter version.
            </p>
          </CardContent>
        </ContentCard>
      ) : null}

      {step === "approve" ? (
        <ContentCard className="gamify-radius-chunky">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              5) Human Approval & Selection
            </CardTitle>
            <CardDescription>
              {useCustomComparison
                ? "Compare candidates from different models, pick winners, and approve for final use."
                : "Review and explicitly approve/reject drafts before application prep."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Resume Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Resume
                </h3>
                {resumeVersionId && (
                  <Badge variant={resumeVersion?.status === "approved" ? "default" : "secondary"}>
                    {resumeVersion?.status === "approved" ? "Approved" : "Pending Approval"}
                  </Badge>
                )}
              </div>

              {useCustomComparison && resumeCandidates.length > 0 ? (
                <div className="rounded-md border bg-card overflow-hidden">
                  <div className="flex border-b bg-muted/30 overflow-x-auto no-scrollbar">
                    {resumeCandidates.map((c) => (
                      <button
                        key={c.modelName}
                        onClick={() => setActiveResumeTab(c.modelName)}
                        className={`px-4 py-2 text-xs font-medium border-r transition-colors flex items-center gap-2 whitespace-nowrap
                          ${activeResumeTab === c.modelName ? "bg-background border-b-2 border-b-primary" : "text-muted-foreground hover:bg-muted/50"}
                          ${c.status === "failed" ? "text-destructive" : ""}
                        `}
                      >
                        {c.modelName}
                        {selectedResumeWinner === c.modelName && <Check className="h-3 w-3 text-primary" />}
                        {c.status === "failed" && <AlertCircle className="h-3 w-3" />}
                      </button>
                    ))}
                  </div>
                  <div className="p-4">
                    {(() => {
                      const activeCandidate = resumeCandidates.find((c) => c.modelName === activeResumeTab);
                      if (activeCandidate?.status === "failed") {
                        return (
                          <div className="p-8 text-center space-y-2">
                            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
                            <p className="text-sm font-medium">Generation Failed</p>
                            <p className="text-xs text-muted-foreground">{activeCandidate.error}</p>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-4">
                          <div className="max-h-[28rem] overflow-y-auto bg-muted/50 rounded-md border p-4 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                            {activeCandidate?.preview || "No preview content available."}
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant={selectedResumeWinner === activeResumeTab ? "default" : "outline"}
                                onClick={() => setSelectedResumeWinner(activeResumeTab)}
                              >
                                {selectedResumeWinner === activeResumeTab ? (
                                  <><Check className="h-4 w-4 mr-1.5" /> Winner Selected</>
                                ) : (
                                  "Select as Winner"
                                )}
                              </Button>
                            </div>
                            {selectedResumeWinner === activeResumeTab && (
                              <Button
                                size="sm"
                                onClick={handlePromoteResumeWinner}
                                disabled={promoting === "resume" || resumeVersionId != null}
                              >
                                {promoting === "resume" ? "Promoting..." : resumeVersionId ? "Promoted" : "Promote & Use"}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : null}

              {(!useCustomComparison || resumeVersionId) && (
                <div className="space-y-3">
                  <div className="max-h-96 overflow-y-auto bg-muted/50 rounded-md border p-4 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                    {resumeVersion?.tailoredDocumentText || (resumeVersionId ? "No tailored content available." : "Generate a resume in Step 4 first.")}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={resumeVersion?.status === "approved" ? "outline" : "default"}
                      onClick={handleApproveResume}
                      disabled={resumeVersion?.status === "approved" || !resumeVersionId}
                    >
                      {resumeVersion?.status === "approved" ? <><Check className="h-4 w-4 mr-2" /> Resume Approved</> : "Approve Resume"}
                    </Button>
                    <Button variant="outline" onClick={handleRejectResume} disabled={!resumeVersionId}>
                      Reject & Regenerate
                    </Button>
                    {resumeVersion?.status === "approved" && (
                      <Button variant="secondary" asChild>
                        <a href={`/api/resume-versions/${resumeVersionId}/export`} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" /> Export DOCX
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Cover Letter Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-primary" />
                  Cover Letter
                </h3>
                {coverLetterVersionId && (
                  <Badge variant={coverLetterVersion?.status === "approved" ? "default" : "secondary"}>
                    {coverLetterVersion?.status === "approved" ? "Approved" : "Pending Approval"}
                  </Badge>
                )}
              </div>

              {useCustomComparison && coverCandidates.length > 0 ? (
                <div className="rounded-md border bg-card overflow-hidden">
                  <div className="flex border-b bg-muted/30 overflow-x-auto no-scrollbar">
                    {coverCandidates.map((c) => (
                      <button
                        key={c.modelName}
                        onClick={() => setActiveCoverTab(c.modelName)}
                        className={`px-4 py-2 text-xs font-medium border-r transition-colors flex items-center gap-2 whitespace-nowrap
                          ${activeCoverTab === c.modelName ? "bg-background border-b-2 border-b-primary" : "text-muted-foreground hover:bg-muted/50"}
                          ${c.status === "failed" ? "text-destructive" : ""}
                        `}
                      >
                        {c.modelName}
                        {selectedCoverWinner === c.modelName && <Check className="h-3 w-3 text-primary" />}
                        {c.status === "failed" && <AlertCircle className="h-3 w-3" />}
                      </button>
                    ))}
                  </div>
                  <div className="p-4">
                    {(() => {
                      const activeCandidate = coverCandidates.find((c) => c.modelName === activeCoverTab);
                      if (activeCandidate?.status === "failed") {
                        return (
                          <div className="p-8 text-center space-y-2">
                            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
                            <p className="text-sm font-medium">Generation Failed</p>
                            <p className="text-xs text-muted-foreground">{activeCandidate.error}</p>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-4">
                          <div className="max-h-[28rem] overflow-y-auto bg-muted/50 rounded-md border p-4 text-sm whitespace-pre-wrap leading-relaxed">
                            {activeCandidate?.preview || "No preview content available."}
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant={selectedCoverWinner === activeCoverTab ? "default" : "outline"}
                                onClick={() => setSelectedCoverWinner(activeCoverTab)}
                              >
                                {selectedCoverWinner === activeCoverTab ? (
                                  <><Check className="h-4 w-4 mr-1.5" /> Winner Selected</>
                                ) : (
                                  "Select as Winner"
                                )}
                              </Button>
                            </div>
                            {selectedCoverWinner === activeCoverTab && (
                              <Button
                                size="sm"
                                onClick={handlePromoteCoverWinner}
                                disabled={promoting === "cover" || coverLetterVersionId != null}
                              >
                                {promoting === "cover" ? "Promoting..." : coverLetterVersionId ? "Promoted" : "Promote & Use"}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : null}

              {(!useCustomComparison || coverLetterVersionId) && (
                <div className="space-y-3">
                  <div className="max-h-[32rem] overflow-y-auto rounded-md border p-4 bg-muted/30">
                    {coverLetterVersion?.annotatedParagraphs && Array.isArray(coverLetterVersion.annotatedParagraphs) && coverLetterVersion.annotatedParagraphs.length > 0 ? (
                      <div className="space-y-3">
                        {(coverLetterVersion.annotatedParagraphs as any[]).map((para, i) => (
                          <div
                            key={i}
                            className={`p-3 rounded-md border text-sm ${ROLE_COLORS[para.role] || "bg-card"}`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-[10px] font-bold uppercase rounded px-1.5 py-0.5 ${ROLE_LABEL_COLORS[para.role] || "bg-muted"}`}>
                                {para.role}
                              </span>
                              {para.claimIds?.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  <Tag className="h-3 w-3 text-muted-foreground" />
                                  {para.claimIds.map((cid: number) => {
                                    const claim = claimMatches.find((m: any) => m.claim?.id === cid)?.claim;
                                    return (
                                      <span
                                        key={cid}
                                        className="text-[10px] bg-primary/10 text-primary rounded px-1.5 py-0.5"
                                        title={claim?.summary}
                                      >
                                        {claim ? claim.summary.slice(0, 30) + (claim.summary.length > 30 ? "…" : "") : `Claim #${cid}`}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <p className="leading-relaxed">{para.text}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">
                        {coverLetterVersionId ? "No tailored content available." : "Generate a cover letter in Step 4 first."}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={coverLetterVersion?.status === "approved" ? "outline" : "default"}
                      onClick={handleApproveCover}
                      disabled={coverLetterVersion?.status === "approved" || !coverLetterVersionId}
                    >
                      {coverLetterVersion?.status === "approved" ? <><Check className="h-4 w-4 mr-2" /> Cover Approved</> : "Approve Cover Letter"}
                    </Button>
                    <Button variant="outline" onClick={handleRejectCover} disabled={!coverLetterVersionId}>
                      Reject & Regenerate
                    </Button>
                    {coverLetterVersion?.status === "approved" && (
                      <Button variant="secondary" asChild>
                        <a href={`/api/cover-letter-versions/${coverLetterVersionId}/export`} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" /> Export DOCX
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("tailor")}>Back</Button>
              <Button variant="outline" onClick={handleSaveSession} disabled={savingSession}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {savingSession ? "Saving..." : "Save & Continue Later"}
              </Button>
              <Button
                size="lg"
                className="px-8 gamify-gradient-primary"
                onClick={() => setStep("assisted")}
                disabled={resumeVersion?.status !== "approved" || coverLetterVersion?.status !== "approved"}
              >
                Continue to Submission <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </ContentCard>
      ) : null}

      {step === "assisted" ? (
        <ContentCard className="gamify-radius-chunky">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MousePointerClick className="h-5 w-5" />
              6) Assisted Apply Preparation
            </CardTitle>
            <CardDescription>
              Prepare audit-first assisted session. Final submission remains manual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                placeholder="Platform"
                value={assistedForm.platform}
                onChange={(e) => setAssistedForm((prev) => ({ ...prev, platform: e.target.value }))}
              />
              <Input
                placeholder="Human checkpoint"
                value={assistedForm.humanCheckpoint}
                onChange={(e) => setAssistedForm((prev) => ({ ...prev, humanCheckpoint: e.target.value }))}
              />
              <Input
                placeholder="Target apply URL"
                value={assistedForm.targetUrl}
                onChange={(e) => setAssistedForm((prev) => ({ ...prev, targetUrl: e.target.value }))}
              />
            </div>
            <Textarea
              placeholder="Current guided step"
              value={assistedForm.currentStep}
              onChange={(e) => setAssistedForm((prev) => ({ ...prev, currentStep: e.target.value }))}
            />
            <Textarea
              placeholder="Optional notes"
              value={assistedForm.notes}
              onChange={(e) => setAssistedForm((prev) => ({ ...prev, notes: e.target.value }))}
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleCreateAssistedSession} disabled={createSession.isPending || !assistedForm.platform} className="gamify-gradient-primary">
                {createSession.isPending ? "Creating Session..." : "Create Assisted Session"}
              </Button>
              {assistedSessionId ? (
                <Badge>
                  Session #{assistedSessionId} ready - <Link className="underline ml-1" to="/assisted-apply">open</Link>
                </Badge>
              ) : null}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("approve")}>Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSaveSession} disabled={savingSession}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {savingSession ? "Saving..." : "Save & Continue Later"}
                </Button>
                <Button variant="secondary" onClick={() => setStep("intake")}>Start New Job</Button>
              </div>
            </div>
          </CardContent>
        </ContentCard>
      ) : null}
      </motion.div>
      </AnimatePresence>

      <ContentCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Wizard Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <p>
            Job ID: <strong>{jobId ?? "-"}</strong>
            {jobId ? <Link className="ml-2 text-primary underline" to={`/jobs/${jobId}`}>open</Link> : null}
          </p>
          <p>
            Role Profile: <strong>{selectedRoleProfileId ?? "-"}</strong>
            {selectedRoleProfileId ? <Link className="ml-2 text-primary underline" to="/role-profiles">open</Link> : null}
          </p>
          <p>Selected Claims: <strong>{selectedClaimIds.length}</strong></p>
          <p>
            Resume Version: <strong>{resumeVersionId ?? "-"}</strong>
            {resumeVersionId ? <Link className="ml-2 text-primary underline" to="/resume-versions">open queue</Link> : null}
          </p>
          <p>
            Cover Letter Version: <strong>{coverLetterVersionId ?? "-"}</strong>
            {coverLetterVersionId ? <Link className="ml-2 text-primary underline" to="/cover-letters">open queue</Link> : null}
          </p>
          <p>
            Assisted Session: <strong>{assistedSessionId ?? "-"}</strong>
            {assistedSessionId ? <Link className="ml-2 text-primary underline" to="/assisted-apply">open</Link> : null}
          </p>
        </CardContent>
      </ContentCard>
    </div>
  );
}

function StatusCard({ title, ok }: { title: string; ok: boolean }) {
  return (
    <ContentCard>
      <CardContent className="p-3 flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <Badge variant={ok ? "default" : "outline"}>{ok ? "Done" : "Pending"}</Badge>
      </CardContent>
    </ContentCard>
  );
}
