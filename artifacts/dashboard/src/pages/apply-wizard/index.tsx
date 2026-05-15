import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
 approveCoverLetterVersion,
 approveResumeVersion,
 createApplication as createApplicationRequest,
 createJob as createJobRequest,
 draftCoverLetter as draftCoverLetterRequest,
 getJobClaimMatches,
 parseJobDescription,
 tailorJobResume as tailorJobResumeRequest,
 updateApplication as updateApplicationRequest,
 updateJob as updateJobRequest,
 useApproveCoverLetterVersion,
 useApproveResumeVersion,
 useCreateApplicationSession,
 useCreateClaim,
 useCreateJob,
 useCreateRoleProfile,
 useCreateWizardSession,
 useDeleteWizardSession,
 useDraftClaims,
 useDraftCoverLetter,
 useListClaims,
 useListCoverLetterVersions,
 useListResumeVersions,
 useListResumeTemplates,
 useListWizardSessions,
 getGetCoverLetterVersionQueryKey,
 getGetBaseResumeQueryKey,
 getGetJobClaimMatchesQueryKey,
 getGetJobQueryKey,
 getGetResumeVersionQueryKey,
 getListClaimsQueryKey,
 getListCoverLetterVersionsQueryKey,
 getListResumeTemplatesQueryKey,
 getListResumeVersionsQueryKey,
 getListRoleProfilesQueryKey,
 getListWizardSessionsQueryKey,
 useGetCoverLetterVersion,
 useGetBaseResume,
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
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Link2, ClipboardCheck, Wand2, ShieldCheck, MousePointerClick, UserCircle, Tag, Check, AlertCircle, ChevronRight, ChevronDown, Download, Save, Upload, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage, hasHttpStatus } from "@/lib/api-errors";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

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
 versionId?: number;
 modelName: string;
 provider: string;
 status: "succeeded" | "failed";
 preview?: string;
 notes?: string;
 templateId?: string | null;
 runId?: string | null;
 eventLogId?: number | null;
 error?: string;
};

const ROLE_COLORS: Record<string, string> = {
 opening: "bg-primary/10 border-primary/20",
 hook: "bg-accent/10 border-accent/20",
 body: "bg-success/10 border-success/20",
 closing: "bg-warning/10 border-warning/20",
};

const ROLE_LABEL_COLORS: Record<string, string> = {
 opening: "text-primary bg-primary/10",
 hook: "text-accent bg-accent/10",
 body: "text-success bg-success/10",
 closing: "text-warning bg-warning/10",
};

function truthBadgeClass(status?: string): string {
 if (status === "supported") return "border-success/50 text-success";
 if (status === "partial") return "border-warning/50 text-warning";
 if (status === "unsupported") return "border-destructive/50 text-destructive";
 return "border-border text-muted-foreground";
}

function truthBadgeText(status?: string): string {
 if (status === "supported") return "Supported";
 if (status === "partial") return "Needs Review";
 if (status === "unsupported") return "Unsupported";
 return "Truth Pending";
}

const STEP_ORDER: WizardStep[] = ["intake", "parse", "role", "tailor", "approve", "assisted"];
const WIZARD_STABLE_QUERY = {
 staleTime: 300_000,
 refetchOnWindowFocus: false,
 refetchOnReconnect: false,
 refetchOnMount: false,
};

function getMatchClaimId(match: unknown): number | null {
 const maybeClaim = (match as { claim?: { id?: unknown } })?.claim;
 return typeof maybeClaim?.id === "number" ? maybeClaim.id : null;
}

function getResumeDiagnosticMessage(notes?: string | null): string {
 const fallback =
 "The model returned a readable resume, but not the structured format needed for claim attribution and truth review. Regenerate this resume before approval.";
 if (!notes) return fallback;
 const normalized = notes.toLowerCase();
 if (normalized.includes("structured json") || normalized.includes("could not be parsed")) {
 return fallback;
 }
 return notes;
}

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
 const [applicationId, setApplicationId] = useState<number | null>(null);
 const [submissionRef, setSubmissionRef] = useState("");
 const [submissionDate, setSubmissionDate] = useState(() => new Date().toISOString().slice(0, 10));
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
 const [activeDraftPreview, setActiveDraftPreview] = useState<"resume" | "cover" | null>(null);
 const [selectedResumeTemplateId, setSelectedResumeTemplateId] = useState("software_developer");
 const [resumeReviewChecked, setResumeReviewChecked] = useState(false);
 const [coverReviewChecked, setCoverReviewChecked] = useState(false);
 const [resumeAiSummaryOpen, setResumeAiSummaryOpen] = useState(true);
 const [coverAiSummaryOpen, setCoverAiSummaryOpen] = useState(true);

 const [quickProfile, setQuickProfile] = useState({
 name: "",
 requiredKeywords: "",
 blockedKeywords: "",
 minSalary: "",
 softKeywords: "",
 });
 const [skipClaims, setSkipClaims] = useState(false);
 const [seedSourceText, setSeedSourceText] = useState("");
 const [seedDrafts, setSeedDrafts] = useState<Array<{ clientId: string; summary: string; selected: boolean }>>([]);
 const [seedingClaims, setSeedingClaims] = useState(false);

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
 const draftClaimsHook = useDraftClaims();
 const createClaim = useCreateClaim();
 const queryClient = useQueryClient();

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

 const { data: roleProfiles = [] } = useListRoleProfiles({ query: { ...WIZARD_STABLE_QUERY, queryKey: getListRoleProfilesQueryKey() } });
 const { data: activeClaims = [] } = useListClaims({ isActive: true }, { query: { ...WIZARD_STABLE_QUERY, queryKey: getListClaimsQueryKey({ isActive: true }) } });
 const { data: resumeVersions = [], isFetched: resumeVersionsFetched } = useListResumeVersions(undefined, { query: { ...WIZARD_STABLE_QUERY, queryKey: getListResumeVersionsQueryKey() } });
 const { data: coverLetterVersions = [], isFetched: coverLetterVersionsFetched } = useListCoverLetterVersions(undefined, { query: { ...WIZARD_STABLE_QUERY, queryKey: getListCoverLetterVersionsQueryKey() } });
 const { data: resumeTemplatesData } = useListResumeTemplates({ query: { ...WIZARD_STABLE_QUERY, queryKey: getListResumeTemplatesQueryKey() } });
 const resumeTemplates = resumeTemplatesData?.templates ?? [];
 const selectedResumeTemplate = resumeTemplates.find((template) => template.id === selectedResumeTemplateId);
 const { data: apiSessions, refetch: refetchSessions } = useListWizardSessions({ query: { ...WIZARD_STABLE_QUERY, queryKey: getListWizardSessionsQueryKey() } });
 const { data: job, isLoading: jobLoading, refetch: refetchJob } = useGetJob(jobId ?? 0, {
 query: { enabled: !!jobId, queryKey: getGetJobQueryKey(jobId ?? 0), ...WIZARD_STABLE_QUERY },
 });
 const {
 data: baseResume,
 error: baseResumeError,
 isLoading: baseResumeLoading,
 } = useGetBaseResume({
 query: {
 queryKey: getGetBaseResumeQueryKey(),
 retry: false,
 staleTime: 30_000,
 refetchOnWindowFocus: false,
 refetchOnReconnect: false,
 },
 });
 const baseResumeMissing = !baseResumeLoading && !baseResume;

 const { data: claimMatches = [] } = useGetJobClaimMatches(jobId ?? 0, {
 query: {
 enabled: !!jobId,
 queryKey: getGetJobClaimMatchesQueryKey(jobId ?? 0),
 ...WIZARD_STABLE_QUERY,
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

 const resumeVersionExistsInQueue = Boolean(
 resumeVersionId && resumeVersions.some((version) => version.id === resumeVersionId),
 );
 const coverLetterVersionExistsInQueue = Boolean(
 coverLetterVersionId && coverLetterVersions.some((version) => version.id === coverLetterVersionId),
 );
 const hasCachedResumeVersion = Boolean(
 resumeVersionId && queryClient.getQueryData(getGetResumeVersionQueryKey(resumeVersionId)),
 );
 const hasCachedCoverLetterVersion = Boolean(
 coverLetterVersionId && queryClient.getQueryData(getGetCoverLetterVersionQueryKey(coverLetterVersionId)),
 );

 const { data: resumeVersion, error: resumeVersionError, refetch: refetchResumeVersion } = useGetResumeVersion(resumeVersionId ?? 0, {
 query: {
 enabled: !!resumeVersionId && resumeVersionsFetched && (resumeVersionExistsInQueue || hasCachedResumeVersion),
 queryKey: getGetResumeVersionQueryKey(resumeVersionId ?? 0),
 retry: false,
 },
 });

 const { data: coverLetterVersion, error: coverLetterVersionError, refetch: refetchCoverLetterVersion } = useGetCoverLetterVersion(coverLetterVersionId ?? 0, {
 query: {
 enabled: !!coverLetterVersionId && coverLetterVersionsFetched && (coverLetterVersionExistsInQueue || hasCachedCoverLetterVersion),
 queryKey: getGetCoverLetterVersionQueryKey(coverLetterVersionId ?? 0),
 retry: false,
 },
 });

 useEffect(() => {
 if (!resumeVersionId || !resumeVersionsFetched || resumeVersionExistsInQueue || hasCachedResumeVersion) return;
 queryClient.removeQueries({ queryKey: getGetResumeVersionQueryKey(resumeVersionId) });
 setResumeVersionId(null);
 setActiveDraftPreview((current) => (current === "resume" ? (coverLetterVersionId ? "cover" : null) : current));
 }, [resumeVersionId, resumeVersionsFetched, resumeVersionExistsInQueue, hasCachedResumeVersion, coverLetterVersionId, queryClient]);

 useEffect(() => {
 if (!coverLetterVersionId || !coverLetterVersionsFetched || coverLetterVersionExistsInQueue || hasCachedCoverLetterVersion) return;
 queryClient.removeQueries({ queryKey: getGetCoverLetterVersionQueryKey(coverLetterVersionId) });
 setCoverLetterVersionId(null);
 setActiveDraftPreview((current) => (current === "cover" ? (resumeVersionId ? "resume" : null) : current));
 }, [coverLetterVersionId, coverLetterVersionsFetched, coverLetterVersionExistsInQueue, hasCachedCoverLetterVersion, resumeVersionId, queryClient]);

 useEffect(() => {
 if (!resumeVersionId || !hasHttpStatus(resumeVersionError, 404)) return;
 queryClient.removeQueries({ queryKey: getGetResumeVersionQueryKey(resumeVersionId) });
 setResumeVersionId(null);
 setActiveDraftPreview((current) => (current === "resume" ? (coverLetterVersionId ? "cover" : null) : current));
 toast({
 title: "Resume draft was deleted",
 description: "The wizard cleared the stale resume draft reference.",
 });
 }, [resumeVersionError, resumeVersionId, coverLetterVersionId, queryClient, toast]);

 useEffect(() => {
 if (!coverLetterVersionId || !hasHttpStatus(coverLetterVersionError, 404)) return;
 queryClient.removeQueries({ queryKey: getGetCoverLetterVersionQueryKey(coverLetterVersionId) });
 setCoverLetterVersionId(null);
 setActiveDraftPreview((current) => (current === "cover" ? (resumeVersionId ? "resume" : null) : current));
 toast({
 title: "Cover letter draft was deleted",
 description: "The wizard cleared the stale cover letter reference.",
 });
 }, [coverLetterVersionError, coverLetterVersionId, resumeVersionId, queryClient, toast]);

 useEffect(() => {
 if (resumeVersion?.templateId) {
 setSelectedResumeTemplateId(resumeVersion.templateId);
 }
 }, [resumeVersion?.templateId]);

 useEffect(() => {
 setResumeReviewChecked(false);
 setResumeAiSummaryOpen(true);
 }, [resumeVersionId]);

 useEffect(() => {
 setCoverReviewChecked(false);
 setCoverAiSummaryOpen(true);
 }, [coverLetterVersionId]);

 useEffect(() => {
 if (!job) return;
 const keywords = (job.parsedKeywords ?? []).join(", ");
 setParsedDraft({
 requiredSkills: (job.parsedRequiredSkills ?? []).join("\n"),
 niceSkills: (job.parsedNiceToHaveSkills ?? []).join("\n"),
 responsibilities: (job.parsedResponsibilities ?? []).join("\n"),
 keywords,
 });
 if (job.roleProfileId != null) {
 setSelectedRoleProfileId(job.roleProfileId);
 }
 if (keywords) {
 setQuickProfile((prev) => prev.requiredKeywords ? prev : { ...prev, requiredKeywords: keywords });
 }
 }, [job]);

 useEffect(() => {
 const matchedIds = claimMatches.map(getMatchClaimId).filter((id): id is number => id != null);
 if (matchedIds.length === 0) return;
 setSkipClaims(false);
 if (selectedClaimIds.length > 0) return;
 setSelectedClaimIds(matchedIds.slice(0, 15));
 }, [claimMatches]);

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

 const matchedClaimIds = useMemo(
 () => claimMatches.map(getMatchClaimId).filter((id): id is number => id != null),
 [claimMatches],
 );
 const canContinueFromRoleStep = selectedClaimIds.length > 0 || skipClaims;
 const resumePreviewText = resumeVersion?.tailoredDocumentText || resumeVersion?.rawContent || "";
 const resumePreviewIsRaw = Boolean(resumeVersion?.rawContent && !resumeVersion?.tailoredDocumentText);
 const resumeSourceValidation = (resumeVersion?.diffData as any)?.sourceValidation;
 const resumeSemanticValidation = (resumeVersion?.diffData as any)?.semanticValidation;
 const resumeAiAttemptSummary = (resumeVersion?.diffData as any)?.aiAttemptSummary as string | undefined;
 const resumeAiAttemptErrors = (resumeVersion?.diffData as any)?.aiAttemptErrors as Array<{ modelName?: string; error?: string; category?: string }> | undefined;
 const resumeModelName = (resumeVersion?.diffData as any)?.modelName as string | undefined;
 const resumePromptTokens = (resumeVersion?.diffData as any)?.promptTokens as number | undefined;
 const resumeCompletionTokens = (resumeVersion?.diffData as any)?.completionTokens as number | undefined;
 const resumeFactReview = (resumeVersion?.diffData as any)?.factReview as {
 findings?: Array<{ kind: string; value: string; line: string; lineIndex: number }>;
 sourceCharCount?: number;
 } | undefined;
 const resumeIsV2Pipeline = (resumeVersion?.diffData as any)?.modelContract === "resume_tailoring_v2_simple";
 const resumeRunSucceeded = (!resumeAiAttemptErrors || resumeAiAttemptErrors.length === 0) && resumeIsV2Pipeline;
 const resumeHasPassingSourceValidation = Boolean(
 resumeSourceValidation?.passed === true && Number(resumeSourceValidation?.validItemCount ?? 0) > 0,
 );
 const resumeHasPassingSemanticValidation = Boolean(resumeSemanticValidation?.passed === true);
 const resumeNeedsRegeneration = Boolean(
 resumeVersionId &&
 resumeVersion &&
 (!resumeVersion.tailoredDocumentText ||
 !resumeVersion.templateId ||
 !resumeHasPassingSourceValidation ||
 !resumeHasPassingSemanticValidation ||
 /could not be repaired|truth lock failure|quality check failed|truth review failed|generation failed|source validation failed|semantic template validation failed|base resume parse failed/i.test(resumeVersion.notes ?? "")),
 );

 const resumeTruthReview = (resumeVersion?.diffData as any)?.truthReview as {
 supportStatus?: string;
 supportedCount?: number;
 partialCount?: number;
 unsupportedCount?: number;
 seriousViolationCount?: number;
 unsupportedPhrases?: string[];
 gapNotes?: string[];
 } | undefined;

 const resumeHasWarnings = Boolean(
 resumeTruthReview && (
 (resumeTruthReview.partialCount ?? 0) > 0 ||
 (resumeTruthReview.unsupportedCount ?? 0) > 0 ||
 (resumeTruthReview.seriousViolationCount ?? 0) > 0
 )
 );

 const coverAnnotatedParagraphs = (
 coverLetterVersion?.annotatedParagraphs && Array.isArray(coverLetterVersion.annotatedParagraphs)
 ? coverLetterVersion.annotatedParagraphs as any[]
 : []
 );

 const coverTruthWarningParagraphs = coverAnnotatedParagraphs.filter((para) => {
 const status = para.supportStatus ?? para.truthReview?.supportStatus;
 return status === "partial" || status === "unsupported";
 });

 const coverHasWarnings = coverTruthWarningParagraphs.length > 0;

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
 skipClaims,
 selectedRoleProfileId,
 selectedClaimIds,
 selectedResumeTemplateId,
 resumeVersionId,
 coverLetterVersionId,
 assistedSessionId,
 applicationId,
 submissionRef,
 submissionDate,
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
 if (s.skipClaims != null) setSkipClaims(s.skipClaims as boolean);
 if (s.selectedRoleProfileId != null) setSelectedRoleProfileId(s.selectedRoleProfileId as number);
 if (s.selectedClaimIds) setSelectedClaimIds(s.selectedClaimIds as number[]);
 if (s.selectedResumeTemplateId) setSelectedResumeTemplateId(s.selectedResumeTemplateId as string);
 if (s.resumeVersionId) setResumeVersionId(s.resumeVersionId as number);
 if (s.coverLetterVersionId) setCoverLetterVersionId(s.coverLetterVersionId as number);
 if (s.assistedSessionId) setAssistedSessionId(s.assistedSessionId as number);
 if (s.applicationId) setApplicationId(s.applicationId as number);
 if (s.submissionRef) setSubmissionRef(s.submissionRef as string);
 if (s.submissionDate) setSubmissionDate(s.submissionDate as string);
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

 const resume = await tailorJobResumeRequest(created.id, { claimIds, templateId: selectedResumeTemplateId });
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

 const handleSeedDraftClaims = () => {
 if (!seedSourceText.trim()) {
 toast({ title: "Paste some notes first", variant: "destructive" });
 return;
 }
 draftClaimsHook.mutate(
 { data: { sourceText: seedSourceText.trim() } },
 {
 onSuccess: (response) => {
 setSeedDrafts(response.claims.map((c, i) => ({ clientId: `seed-${i}`, summary: c.summary, selected: true })));
 toast({ title: `${response.claims.length} claim drafts ready — review and save` });
 },
 onError: (error) => {
 const status = (error as { response?: { status?: number }; status?: number })?.response?.status
 ?? (error as { status?: number })?.status;
 if (status === 503) {
 toast({
 title: "Claim drafting timed out",
 description: "AI service is temporarily unavailable. Try again, or add claims manually.",
 variant: "destructive",
 });
 return;
 }
 toast({ title: "Draft failed", description: getErrorMessage(error, "Try again."), variant: "destructive" });
 },
 },
 );
 };

 const handleSeedSaveClaims = async () => {
 const toSave = seedDrafts.filter((d) => d.selected && d.summary.trim());
 if (toSave.length === 0) {
 toast({ title: "Select at least one claim", variant: "destructive" });
 return;
 }
 setSeedingClaims(true);
 try {
 for (const draft of toSave) {
 await createClaim.mutateAsync({ data: { summary: draft.summary, isActive: true, evidenceType: "self_attestation" } });
 }
 await queryClient.invalidateQueries({ queryKey: getListClaimsQueryKey() });
 setSeedDrafts([]);
 setSeedSourceText("");
 toast({ title: `${toSave.length} claim${toSave.length === 1 ? "" : "s"} added to ledger` });
 } catch (error) {
 toast({ title: "Failed to save claims", description: getErrorMessage(error, "Try again."), variant: "destructive" });
 } finally {
 setSeedingClaims(false);
 }
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
 toast({ title: `Role profile "${profile.name}" created` });
 queryClient.invalidateQueries({ queryKey: getListRoleProfilesQueryKey() });
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
 if (baseResumeLoading) {
 toast({ title: "Checking base resume...", description: "Try again in a moment." });
 return;
 }
 if (!baseResume || baseResumeMissing) {
 toast({
 title: "Base resume required",
 description: "Upload or paste your base resume before generating a tailored resume.",
 variant: "destructive",
 });
 return;
 }
 if (!selectedResumeTemplateId) {
 toast({ title: "Choose a resume template first", variant: "destructive" });
 return;
 }
 tailorResume.mutate(
 {
 id: jobId,
 data: { claimIds: selectedClaimIds, templateId: selectedResumeTemplateId },
 },
 {
 onSuccess: (version) => {
 setResumeVersionId(version.id);
 queryClient.setQueryData(getGetResumeVersionQueryKey(version.id), version);
 setActiveDraftPreview("resume");
 if (version.tailoredDocumentText) {
 toast({ title: `Resume draft created (#${version.id})` });
 } else {
 const attemptSummary = (version.diffData as any)?.aiAttemptSummary as string | undefined;
 const detail = attemptSummary ? attemptSummary.slice(0, 200) : getResumeDiagnosticMessage(version.notes);
 toast({ title: `Resume draft #${version.id} needs review`, description: detail, variant: "destructive" });
 }
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
 queryClient.setQueryData(getGetCoverLetterVersionQueryKey(version.id), version);
 setActiveDraftPreview("cover");
 if (version.draftContent) {
 toast({ title: `Cover letter draft created (#${version.id})` });
 } else {
 const detail = version.notes ? version.notes.slice(0, 200) : "Regenerate after checking your claims.";
 toast({ title: `Cover letter draft #${version.id} needs review`, description: detail, variant: "destructive" });
 }
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
 templateId: selectedResumeTemplateId,
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
 const winner = resumeCandidates.find((c) => c.modelName === selectedResumeWinner && c.status === "succeeded");
 if (!winner?.versionId) {
 toast({ title: "Winner candidate is missing version data", variant: "destructive" });
 return;
 }
 setPromoting("resume");
 try {
 const version = await requestJson<{ id: number }>(`/api/jobs/${jobId}/compare/promote-resume`, {
 method: "POST",
 body: JSON.stringify({
 claimIds: selectedClaimIds,
 templateId: selectedResumeTemplateId,
 model: { provider: "openrouter", modelName: selectedResumeWinner },
 candidateVersionId: winner.versionId,
 }),
 });
 setResumeVersionId(version.id);
 setActiveDraftPreview("resume");
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
 const winner = coverCandidates.find((c) => c.modelName === selectedCoverWinner && c.status === "succeeded");
 if (!winner?.versionId) {
 toast({ title: "Winner candidate is missing version data", variant: "destructive" });
 return;
 }
 setPromoting("cover");
 try {
 const version = await requestJson<{ id: number }>(`/api/jobs/${jobId}/compare/promote-cover-letter`, {
 method: "POST",
 body: JSON.stringify({
 claimIds: selectedClaimIds,
 model: { provider: "openrouter", modelName: selectedCoverWinner },
 candidateVersionId: winner.versionId,
 }),
 });
 setCoverLetterVersionId(version.id);
 setActiveDraftPreview("cover");
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
 toast({ title: "Resume rejected; generating a fresh draft" });
 handleGenerateResume();
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
 if (!jobId || !resumeVersionId || !coverLetterVersionId) return;
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
 (async () => {
 setAssistedSessionId(session.id);
 const createdApp = await createApplicationRequest({
 jobId,
 resumeVersionId,
 coverLetterVersionId,
 applyMode: "assisted",
 status: "draft",
 platform: assistedForm.platform || null,
 notes: assistedForm.notes || null,
 });
 setApplicationId(createdApp.id);
 toast({ title: `Assisted session created (#${session.id}) and linked to application #${createdApp.id}` });
 })().catch((error) => {
 toast({
 title: "Assisted session created, but failed to create application record",
 description: getErrorMessage(error, "Open Applications and create one manually."),
 variant: "destructive",
 });
 });
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

 const handleMarkSubmitted = async () => {
 if (!applicationId) return;
 try {
 await updateApplicationRequest(applicationId, {
 status: "submitted",
 appliedAt: submissionDate ? new Date(`${submissionDate}T12:00:00.000Z`).toISOString() : null,
 confirmationRef: submissionRef || null,
 notes: assistedForm.notes || null,
 });
 toast({ title: `Application #${applicationId} marked submitted` });
 } catch (error) {
 toast({
 title: "Failed to mark submitted",
 description: getErrorMessage(error, "Try again from Applications page."),
 variant: "destructive",
 });
 }
 };

 return (
 <div>
 <PageHeader title="Apply Wizard" subtitle="Multi-step AI-powered job application assistant." variant="workflow" />

 {savedSessions.length > 0 ? (
 <ContentCard>
 <CardHeader>
 <CardTitle>
 <Save />
 Saved Sessions
 </CardTitle>
 <CardDescription>Resume a previous wizard session or delete it.</CardDescription>
 </CardHeader>
 <CardContent>
 {savedSessions.map((session) => (
 <div key={session.id}>
 <div>
 <p>
 {(session.state as Record<string, unknown>)?.intake
 ? `${((session.state as Record<string, unknown>).intake as { title?: string; company?: string }).title || "Untitled"} — ${((session.state as Record<string, unknown>).intake as { company?: string }).company || "No company"}`
 : "New job"}
 </p>
 <p>
 Step: {session.currentStep} · {new Date(session.updatedAt ?? session.createdAt).toLocaleString()}
 </p>
 </div>
 <div>
 <Button size="sm" variant="outline" onClick={() => handleResumeSession(session)}>
 Resume
 </Button>
 <Button size="sm" variant="ghost" onClick={() => handleDeleteSession(session.id)}>
 <Trash2 />
 </Button>
 </div>
 </div>
 ))}
 </CardContent>
 </ContentCard>
 ) : null}

 <div>
 {STEP_ORDER.map((name, index) => {
 const isCompleted = index < currentStepIndex;
 const isActive = index === currentStepIndex;
 const isFuture = index > currentStepIndex;
 return (
 <div key={name}>
 {index > 0 && (
 <div
 />
 )}
 <div>
 <div
 >
 {isCompleted ? "✓" : index + 1}
 </div>
 <span>
 {name}
 </span>
 </div>
 </div>
 );
 })}
 </div>

 <div>
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
 transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
 >
 {step === "intake" ? (
 <ContentCard>
 <CardHeader>
 <CardTitle>
 <Link2 />
 1) Intake Job
 </CardTitle>
 <CardDescription>Use single mode for guided end-to-end, or batch mode for Phase 2 bulk intake.</CardDescription>
 </CardHeader>
 <CardContent>
 <div>
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
 <div>
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
 <div>
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
 value={intake.rawJdText}
 onChange={(e) => setIntake((prev) => ({ ...prev, rawJdText: e.target.value }))}
 />
 <div>
 <Button
 variant="outline"
 onClick={handleSaveSession}
 disabled={savingSession}
 >
 <Save />
 {savingSession ? "Saving..." : "Save & Continue Later"}
 </Button>
 <Button
 onClick={handleCreateJob}
 disabled={!intake.title || !intake.company || createJob.isPending}

 >
 {createJob.isPending ? "Ingesting..." : "Create Job & Continue"}
 </Button>
 </div>
 </>
 ) : (
 <>
 <div>
 <p>Batch paste / CSV format</p>
 <p>
 One row per job: <code>title,company,location,url,jd</code>. Optional header row supported.
 </p>
 <Textarea
 placeholder="title,company,location,url,jd"
 value={batchText}
 onChange={(e) => setBatchText(e.target.value)}
 />
 <div>
 <input
 ref={fileInputRef}
 type="file"
 accept=".csv,text/csv,text/plain"
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
 <Upload />
 Choose File
 </Button>
 <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}>
 <Download />
 Download Template
 </Button>
 <Button onClick={handleRunBatch} disabled={batchRunning || !batchText.trim()} >
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

 <div>
 <div>
 <p>Batch status</p>
 <div>
 <Button variant={batchFilter === "all" ? "default" : "outline"} onClick={() => setBatchFilter("all")}>All</Button>
 <Button variant={batchFilter === "failed" ? "default" : "outline"} onClick={() => setBatchFilter("failed")}>Failed</Button>
 <Button variant={batchFilter === "generated" ? "default" : "outline"} onClick={() => setBatchFilter("generated")}>Generated</Button>
 <Button variant={batchFilter === "approved" ? "default" : "outline"} onClick={() => setBatchFilter("approved")}>Approved</Button>
 </div>
 </div>

 {visibleBatchRuns.length === 0 ? (
 <p>No rows for this filter yet.</p>
 ) : (
 <div>
 {visibleBatchRuns.map((run) => (
 <div key={run.id}>
 <div>
 <p>#{run.index} {run.title} - {run.company}</p>
 <Badge variant={run.status === "failed" ? "destructive" : run.status === "approved" ? "default" : "outline"}>
 {run.status}
 </Badge>
 </div>
 <p>{run.message}</p>
 <div>
 {run.jobId ? <Link to={`/jobs/${run.jobId}`}>Job #{run.jobId}</Link> : null}
 {run.resumeVersionId ? <Link to="/resume-versions">Resume #{run.resumeVersionId}</Link> : null}
 {run.coverLetterVersionId ? <Link to="/cover-letters">Cover #{run.coverLetterVersionId}</Link> : null}
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
 <ContentCard>
 <CardHeader>
 <CardTitle>2) Parse and Edit JD</CardTitle>
 <CardDescription>
 Run parser, then edit parsed fields inline before continuing.
 </CardDescription>
 </CardHeader>
 <CardContent>
 {jobLoading ? <p>Loading job...</p> : null}
 <Textarea
 placeholder="Raw JD text"
 value={intake.rawJdText}
 onChange={(e) => setIntake((prev) => ({ ...prev, rawJdText: e.target.value }))}
 />

 <div>
 <Textarea
 placeholder="Required skills (one per line or comma separated)"
 value={parsedDraft.requiredSkills}
 onChange={(e) => setParsedDraft((prev) => ({ ...prev, requiredSkills: e.target.value }))}
 />
 <Textarea
 placeholder="Nice-to-have skills"
 value={parsedDraft.niceSkills}
 onChange={(e) => setParsedDraft((prev) => ({ ...prev, niceSkills: e.target.value }))}
 />
 </div>
 <div>
 <Textarea
 placeholder="Responsibilities"
 value={parsedDraft.responsibilities}
 onChange={(e) => setParsedDraft((prev) => ({ ...prev, responsibilities: e.target.value }))}
 />
 <Textarea
 placeholder="Keywords"
 value={parsedDraft.keywords}
 onChange={(e) => setParsedDraft((prev) => ({ ...prev, keywords: e.target.value }))}
 />
 </div>

 <div>
 <Button variant="outline" onClick={() => setStep("intake")}>Back</Button>
 <Button variant="outline" onClick={handleSaveSession} disabled={savingSession}>
 <Save />
 {savingSession ? "Saving..." : "Save & Continue Later"}
 </Button>
 <Button variant="secondary" onClick={handleParse} disabled={parseJob.isPending}>
 {parseJob.isPending ? "Parsing..." : "Run Parser"}
 </Button>
 <Button
 onClick={handleSaveParsedEdits}
 disabled={updateJob.isPending || !intake.rawJdText.trim()}

 >
 {updateJob.isPending ? "Saving..." : "Save & Continue"}
 </Button>
 </div>
 <p>
 Continue unlocks Role + Claims after saving and reparsing JD text.
 </p>
 </CardContent>
 </ContentCard>
 ) : null}

 {step === "role" ? (
 <ContentCard>
 <CardHeader>
 <CardTitle>
 <UserCircle />
 3) Claims &amp; Role Profile
 </CardTitle>
 <CardDescription>
 Review matched claims for this job, then optionally attach a role profile for scoring.
 </CardDescription>
 </CardHeader>
 <CardContent>
 {activeClaims.length === 0 && (
 <div>
 <div>
 <AlertCircle />
 <div>
 <p>Your Claims Ledger is empty</p>
 <p>
 AI tailoring needs claims — past achievements, skills, and projects — to personalise your resume and cover letter. Add a few now or{" "}
 <Link to="/claims">go to the full Claims Ledger</Link>.
 </p>
 </div>
 </div>
 <Textarea
 placeholder="Paste career notes, a resume, or a project summary…"
 value={seedSourceText}
 onChange={(e) => setSeedSourceText(e.target.value)}
 />
 {seedDrafts.length === 0 ? (
 <div>
 <Button size="sm" variant="secondary" onClick={handleSeedDraftClaims} disabled={draftClaimsHook.isPending}>
 <Sparkles />
 {draftClaimsHook.isPending ? "Drafting…" : "AI Draft Claims"}
 </Button>
 </div>
 ) : (
 <div>
 <p>Review drafts — uncheck any you don't want to save:</p>
 {seedDrafts.map((d) => (
 <label key={d.clientId}>
 <input type="checkbox" checked={d.selected} onChange={(e) => setSeedDrafts((prev) => prev.map((x) => x.clientId === d.clientId ? { ...x, selected: e.target.checked } : x))} />
 <Textarea value={d.summary} onChange={(e) => setSeedDrafts((prev) => prev.map((x) => x.clientId === d.clientId ? { ...x, summary: e.target.value } : x))} />
 </label>
 ))}
 <div>
 <Button size="sm" variant="outline" onClick={() => setSeedDrafts([])}>Discard</Button>
 <Button size="sm" onClick={handleSeedSaveClaims} disabled={seedingClaims}>
 {seedingClaims ? "Saving…" : `Save ${seedDrafts.filter((d) => d.selected).length} Claims`}
 </Button>
 </div>
 </div>
 )}
 </div>
 )}
 <div>
 <p>Select existing role profile <span>(optional)</span></p>
 <select
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
 <div>
 <Button
 variant="outline"
 disabled={selectedRoleProfileId == null || updateJob.isPending}
 onClick={() => selectedRoleProfileId != null && handleAttachRoleProfile(selectedRoleProfileId)}
 >
 Attach to Job
 </Button>
 </div>
 </div>

 <div>
 <p>Quick create role profile <span>(optional)</span></p>
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
 <div>
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
 <div>
 <Button variant="secondary" onClick={handleQuickCreateRoleProfile} disabled={createRoleProfile.isPending}>
 {createRoleProfile.isPending ? "Creating..." : "Quick Create & Attach"}
 </Button>
 </div>
 </div>

 <div>
 <p>Matched claims</p>
 {matchedClaimIds.length === 0 ? (
 <div>
 <p>
 No automatic matches yet. Select claims manually from your active ledger, or use Skip to let generation auto-select later.
 </p>
 {activeClaims.length > 0 ? (
 <div>
 {activeClaims.map((claim) => {
 const isSelected = selectedClaimIds.includes(claim.id);
 return (
 <label key={claim.id}>
 <input
 type="checkbox"
 checked={isSelected}
 onChange={() => handleToggleClaim(claim.id)}
 />
 <div>
 <p>{claim.summary}</p>
 <div>
 {claim.domain ? <span>{claim.domain}</span> : null}
 {claim.applicableTags?.slice(0, 4).map((tag) => (
 <span key={tag}>{tag}</span>
 ))}
 </div>
 </div>
 </label>
 );
 })}
 </div>
 ) : null}
 <label>
 <input
 type="checkbox"
 checked={skipClaims}
 onChange={(e) => setSkipClaims(e.target.checked)}
 />
 <span>
 Skip — let the AI auto-select relevant claims when generating drafts.
 </span>
 </label>
 </div>
 ) : (
 <div>
 {claimMatches.map((match: any) => {
 const claimId = getMatchClaimId(match);
 if (claimId == null) return null;
 const isSelected = selectedClaimIds.includes(claimId);
 return (
 <label key={claimId}>
 <input
 type="checkbox"
 checked={isSelected}
 onChange={() => handleToggleClaim(claimId)}
 />
 <div>
 <p>{match.claim?.summary ?? "Claim"}</p>
 <div>
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

 <div>
 <Button variant="outline" onClick={() => setStep("parse")}>Back</Button>
 <Button variant="outline" onClick={handleSaveSession} disabled={savingSession}>
 <Save />
 {savingSession ? "Saving..." : "Save & Continue Later"}
 </Button>
 <Button
 onClick={() => setStep("tailor")}
 disabled={!canContinueFromRoleStep}
 >
 Continue
 </Button>
 </div>
 <p>
 Continue requires at least one selected claim, or an explicit Skip choice to let the AI auto-select from your active Claims Ledger.
 </p>
 </CardContent>
 </ContentCard>
 ) : null}

 {step === "tailor" ? (
 <ContentCard>
 <CardHeader>
 <CardTitle>
 <Wand2 />
 4) Generate Drafts
 </CardTitle>
 <CardDescription>
 Generate tailored resume and cover letter from selected claims.
 </CardDescription>
 </CardHeader>
 <CardContent>
 {baseResumeMissing ? (
 <div>
 <AlertCircle />
 <p>
 Base resume is missing. The reset tool clears base resumes too, so upload or paste one on the{" "}
 <Link to="/base-resume">Base Resume</Link>{" "}
 page before generating a tailored resume.
 </p>
 </div>
 ) : null}
 {activeClaims.length === 0 ? (
 <div>
 <AlertCircle />
 <p>
 No active claims are selected. Resume generation can still use your base resume as a truth source, but claim-backed tailoring will be limited.
 </p>
 </div>
 ) : selectedClaimIds.length === 0 ? (
 <div>
 <AlertCircle />
 <p>
 No specific claims selected. The system will use your base resume and auto-select from your {activeClaims.length} active claim{activeClaims.length === 1 ? "" : "s"} when there is a strong match.
 </p>
 </div>
 ) : (
 <p>
 Selected claims: <span>{selectedClaimIds.length}</span>
 </p>
 )}

 <div>
 <Button variant={useCustomComparison ? "outline" : "default"} onClick={() => setUseCustomComparison(false)}>
 Use system defaults
 </Button>
 <Button variant={useCustomComparison ? "default" : "outline"} onClick={() => setUseCustomComparison(true)}>
 Compare custom models (up to 3)
 </Button>
 </div>

 <div>
 <div>
 <div>
 <p>Resume template</p>
 <p>
 Templates control headings, section order, spacing, and export style. Length remains adaptive up to 2 pages.
 </p>
 </div>
 <select
 value={selectedResumeTemplateId}
 onChange={(event) => {
 setSelectedResumeTemplateId(event.target.value);
 setResumeVersionId(null);
 setResumeCandidates([]);
 setSelectedResumeWinner(null);
 }}
 disabled={tailorResume.isPending || comparisonRunning}
 >
 {resumeTemplates.map((template) => (
 <option key={template.id} value={template.id}>
 {template.label}
 </option>
 ))}
 </select>
 </div>
 {selectedResumeTemplate ? (
 <div>
 <Badge variant="outline">{selectedResumeTemplate.lengthPolicy.target}</Badge>
 <Badge variant="outline">Max {selectedResumeTemplate.lengthPolicy.maxPages} pages</Badge>
 <span>{selectedResumeTemplate.sectionOrder.join(" -> ")}</span>
 </div>
 ) : (
 <p>Template metadata is still loading.</p>
 )}
 </div>

 {!useCustomComparison ? (
 <div>
 <Button variant="secondary" onClick={handleGenerateResume} disabled={tailorResume.isPending || !selectedResumeTemplate || baseResumeLoading || baseResumeMissing}>
 {tailorResume.isPending ? "Generating Resume..." : "Generate Resume"}
 </Button>
 <Button variant="secondary" onClick={handleGenerateCoverLetter} disabled={draftCoverLetter.isPending || activeClaims.length === 0}>
 {draftCoverLetter.isPending ? "Generating Cover Letter..." : "Generate Cover Letter"}
 </Button>
 </div>
 ) : (
 <div>
 <div>
 <p>Resume model comparison</p>
 <Input
 placeholder="Type model ID (e.g. openai/gpt-4o-mini)"
 value={resumeModelQuery}
 onChange={(e) => setResumeModelQuery(e.target.value)}
 disabled={catalogLoading}
 />
 <div>
 {resumeCompareModels.map((model) => (
 <Badge key={model} variant="secondary">
 {model}
 <button type="button" onClick={() => removeCompareModel("resume", model)}>x</button>
 </Badge>
 ))}
 </div>
 <div>
 {filteredResumeModels.map((model) => (
 <button
 type="button"
 key={model.id}
 onClick={() => addCompareModel("resume", model.id)}
 disabled={resumeCompareModels.length >= 3}
 >
 <span>{model.id}</span>
 <span>{model.name}</span>
 {model.isConfigured ? <Badge variant="outline">Configured</Badge> : null}
 {model.isDefaultForResumeTailoring ? <Badge>Resume Default</Badge> : null}
 </button>
 ))}
 </div>
 <Button onClick={handleCompareResume} disabled={comparisonRunning || resumeCompareModels.length === 0 || !selectedResumeTemplate}>
 {comparisonRunning ? "Running..." : "Run Resume Comparison"}
 </Button>
 {resumeCandidates.length > 0 ? (
 <div>
 {resumeCandidates.map((candidate) => (
 <div key={`resume-${candidate.modelName}`}>
 <div>
 <p>{candidate.modelName}</p>
 <Badge variant={candidate.status === "failed" ? "destructive" : "outline"}>{candidate.status}</Badge>
 </div>
 <p>
 {candidate.status === "failed" ? candidate.error : candidate.preview || candidate.notes || "No preview"}
 </p>
 </div>
 ))}
 </div>
 ) : null}
 </div>

 <div>
 <p>Cover letter model comparison</p>
 <Input
 placeholder="Type model ID (e.g. anthropic/claude-3.5-haiku)"
 value={coverModelQuery}
 onChange={(e) => setCoverModelQuery(e.target.value)}
 disabled={catalogLoading}
 />
 <div>
 {coverCompareModels.map((model) => (
 <Badge key={model} variant="secondary">
 {model}
 <button type="button" onClick={() => removeCompareModel("cover", model)}>x</button>
 </Badge>
 ))}
 </div>
 <div>
 {filteredCoverModels.map((model) => (
 <button
 type="button"
 key={model.id}
 onClick={() => addCompareModel("cover", model.id)}
 disabled={coverCompareModels.length >= 3}
 >
 <span>{model.id}</span>
 <span>{model.name}</span>
 {model.isConfigured ? <Badge variant="outline">Configured</Badge> : null}
 {model.isDefaultForCoverLetter ? <Badge>Cover Default</Badge> : null}
 </button>
 ))}
 </div>
 <Button onClick={handleCompareCover} disabled={comparisonRunning || coverCompareModels.length === 0}>
 {comparisonRunning ? "Running..." : "Run Cover Comparison"}
 </Button>
 {coverCandidates.length > 0 ? (
 <div>
 {coverCandidates.map((candidate) => (
 <div key={`cover-${candidate.modelName}`}>
 <div>
 <p>{candidate.modelName}</p>
 <Badge variant={candidate.status === "failed" ? "destructive" : "outline"}>{candidate.status}</Badge>
 </div>
 <p>
 {candidate.status === "failed" ? candidate.error : candidate.preview || candidate.notes || "No preview"}
 </p>
 </div>
 ))}
 </div>
 ) : null}
 </div>
 </div>
 )}
 <div>
 <Button
 type="button"
 size="sm"
 variant={activeDraftPreview === "resume" ? "default" : resumeVersionId ? "secondary" : "outline"}
 disabled={!resumeVersionId}
 onClick={() => setActiveDraftPreview("resume")}
 data-testid="btn-preview-resume-draft"
 >
 Resume Draft {resumeVersionId ? `#${resumeVersionId}` : "not created"}
 </Button>
 <Button
 type="button"
 size="sm"
 variant={activeDraftPreview === "cover" ? "default" : coverLetterVersionId ? "secondary" : "outline"}
 disabled={!coverLetterVersionId}
 onClick={() => setActiveDraftPreview("cover")}
 data-testid="btn-preview-cover-letter-draft"
 >
 Cover Letter Draft {coverLetterVersionId ? `#${coverLetterVersionId}` : "not created"}
 </Button>
 </div>
 {activeDraftPreview ? (
 <div>
 <div>
 <div>
 <p>
 {activeDraftPreview === "resume" ? "Resume Draft Preview" : "Cover Letter Draft Preview"}
 </p>
 <p>
 Review this content before continuing to approval.
 </p>
 {activeDraftPreview === "resume" ? (
 <p>
 Template: <span>{selectedResumeTemplate?.label ?? resumeVersion?.templateId ?? "Unknown"}</span>
 {selectedResumeTemplate ? ` (${selectedResumeTemplate.lengthPolicy.target}, max ${selectedResumeTemplate.lengthPolicy.maxPages} pages)` : ""}
 </p>
 ) : null}
 </div>
 <Button variant="outline" size="sm" onClick={() => setStep("approve")}>
 Open Full Review
 </Button>
 </div>

 {activeDraftPreview === "resume" ? (
 <div>
 {resumeVersionId && !resumeVersion ? (
 <Skeleton />
 ) : (
 <>
 {(resumePreviewIsRaw || resumeNeedsRegeneration) && (
 <div>
 <p>Resume must be regenerated before approval</p>
 <p>
 {resumePreviewIsRaw && !resumeVersion?.tailoredDocumentText
 ? "AI returned a draft but source attribution failed. Review the raw draft below or regenerate."
 : getResumeDiagnosticMessage(resumeVersion?.notes)}
 </p>
 </div>
 )}
 {resumeVersion ? (
 <div>
 <p>Template</p>
 <p>
 <span>
 {((resumeVersion.diffData as any)?.templateLabel as string | undefined) ?? selectedResumeTemplate?.label ?? resumeVersion.templateId ?? "Unknown"}
 </span>
 {" "}
 <span>
 {((resumeVersion.diffData as any)?.lengthPolicy?.target as string | undefined) ?? "Concise 1-2 pages"}
 </span>
 </p>
 {resumeRunSucceeded ? (
 <p>
 Model: <span>{resumeModelName ?? "unknown"}</span>
 {" · "}
 {resumePromptTokens ?? "?"} in / {resumeCompletionTokens ?? "?"} out tokens
 </p>
 ) : resumeAiAttemptSummary ? (
 <p>
 AI attempt summary: {resumeAiAttemptSummary}
 </p>
 ) : null}
 </div>
 ) : null}
 {resumeFactReview ? (
 <div>
 <div>
 <ShieldCheck />
 <span>Fact Review</span>
 {(resumeFactReview.findings?.length ?? 0) === 0 ? (
 <Badge variant="outline">
 No unverified facts detected
 </Badge>
 ) : (
 <Badge variant="outline">
 {resumeFactReview.findings!.length} item{resumeFactReview.findings!.length === 1 ? "" : "s"} need review
 </Badge>
 )}
 </div>
 {(resumeFactReview.findings?.length ?? 0) > 0 && (
 <details>
 <summary>
 Show findings ({resumeFactReview.findings!.length})
 </summary>
 <ul>
 {resumeFactReview.findings!.map((f, i) => (
 <li key={i}>
 <span>{f.kind}</span>
 <code>{f.value}</code>
 <span> — {f.line}</span>
 </li>
 ))}
 </ul>
 </details>
 )}
 </div>
 ) : (() => {
 // Legacy truthReview rendering for pre-v2 resume versions
 const truthReview = (resumeVersion?.diffData as any)?.truthReview;
 if (!truthReview) return null;
 return (
 <div>
 <div>
 <ShieldCheck />
 <span>Truth Review</span>
 <Badge variant="outline">
 {truthBadgeText(truthReview.supportStatus)}
 </Badge>
 <span>
 {truthReview.supportedCount ?? 0} supported, {truthReview.partialCount ?? 0} needs review, {truthReview.unsupportedCount ?? 0} unsupported
 </span>
 </div>
 {truthReview.seriousViolationCount > 0 && (
 <p>{truthReview.seriousViolationCount} serious issue{truthReview.seriousViolationCount === 1 ? "" : "s"} found before approval.</p>
 )}
 </div>
 );
 })()}
 <div>
 {resumePreviewText || "Resume content is still loading."}
 </div>
 </>
 )}
 </div>
 ) : (
 <div>
 {coverLetterVersionId && !coverLetterVersion ? (
 <Skeleton />
 ) : (
 <div>
 {coverLetterVersion?.annotatedParagraphs && Array.isArray(coverLetterVersion.annotatedParagraphs) && coverLetterVersion.annotatedParagraphs.length > 0 ? (
 <div>
 {(coverLetterVersion.annotatedParagraphs as any[]).map((para, i) => (
 <div
 key={i}
 >
 <div>
 <span>
 {para.role}
 </span>
 <Badge variant="outline">
 {truthBadgeText(para.supportStatus ?? para.truthReview?.supportStatus)}
 </Badge>
 {para.claimIds?.length > 0 && (
 <span>
 Claims: {para.claimIds.join(", ")}
 </span>
 )}
 </div>
 <p>{para.text}</p>
 {para.truthReview && (
 <div>
 {(para.truthReview.unsupportedPhrases?.length ?? 0) > 0 && (
 <p>Unsupported: {para.truthReview.unsupportedPhrases.join("; ")}</p>
 )}
 {(para.truthReview.gapNotes?.length ?? 0) > 0 && (
 <p>Gaps: {para.truthReview.gapNotes.join("; ")}</p>
 )}
 </div>
 )}
 </div>
 ))}
 </div>
 ) : (
 <div>
 {coverLetterVersion?.draftContent || "No tailored content available yet."}
 </div>
 )}
 </div>
 )}
 </div>
 )}
 </div>
 ) : null}
 <div>
 <Button variant="outline" onClick={() => setStep("role")}>Back</Button>
 <Button variant="outline" onClick={handleSaveSession} disabled={savingSession}>
 <Save />
 {savingSession ? "Saving..." : "Save & Continue Later"}
 </Button>
 <Button
 onClick={() => setStep("approve")}
 disabled={
 useCustomComparison
 ? resumeCandidates.length === 0 || coverCandidates.length === 0
 : !resumeVersionId || !coverLetterVersionId || resumeNeedsRegeneration
 }

 >
 Continue
 </Button>
 </div>
 <p>
 Continue requires both draft artifacts: one resume version and one cover letter version.
 </p>
 </CardContent>
 </ContentCard>
 ) : null}

 {step === "approve" ? (
 <ContentCard>
 <CardHeader>
 <CardTitle>
 <ShieldCheck />
 5) Human Approval & Selection
 </CardTitle>
 <CardDescription>
 {useCustomComparison
 ? "Compare candidates from different models, pick winners, and approve for final use."
 : "Review and explicitly approve/reject drafts before application prep."}
 </CardDescription>
 </CardHeader>
 <CardContent>
 {/* Resume Section */}
 <div>
 <div>
 <h3>
 <ClipboardCheck />
 Resume
 </h3>
 {resumeVersionId && (
 <Badge variant={resumeNeedsRegeneration ? "destructive" : resumeVersion?.status === "approved" ? "default" : "secondary"}>
 {resumeNeedsRegeneration ? "Needs Regeneration" : resumeVersion?.status === "approved" ? "Approved" : "Pending Approval"}
 </Badge>
 )}
 </div>

 {useCustomComparison && resumeCandidates.length > 0 ? (
 <div>
 <div>
 {resumeCandidates.map((c) => (
 <button
 key={c.modelName}
 onClick={() => setActiveResumeTab(c.modelName)}
 >
 {c.modelName}
 {selectedResumeWinner === c.modelName && <Check />}
 {c.status === "failed" && <AlertCircle />}
 </button>
 ))}
 </div>
 <div>
 {(() => {
 const activeCandidate = resumeCandidates.find((c) => c.modelName === activeResumeTab);
 if (activeCandidate?.status === "failed") {
 return (
 <div>
 <AlertCircle />
 <p>Generation Failed</p>
 <p>{activeCandidate.error}</p>
 </div>
 );
 }
 return (
 <div>
 <div>
 {activeCandidate?.preview || "No preview content available."}
 </div>
 <div>
 <div>
 <Button
 size="sm"
 variant={selectedResumeWinner === activeResumeTab ? "default" : "outline"}
 onClick={() => setSelectedResumeWinner(activeResumeTab)}
 >
 {selectedResumeWinner === activeResumeTab ? (
 <><Check /> Winner Selected</>
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
 <div>
 {resumeVersionId && !resumeVersion && (
 <Skeleton />
 )}
 {resumeVersion?.notes?.includes("No matching claims") && (
 <div>
 <AlertCircle />
 <div>
 <p>This is your unmodified base resume</p>
 <p>No claims were available when this was generated. Add claims in Step 3 and regenerate for a tailored version.</p>
 </div>
 </div>
 )}
 {(resumePreviewIsRaw || resumeNeedsRegeneration) && (
 <div>
 <AlertCircle />
 <div>
 <p>Resume must be regenerated before approval</p>
 <p>
 {resumePreviewIsRaw && !resumeVersion?.tailoredDocumentText
 ? "AI returned a draft but source attribution failed. Review the raw draft below or regenerate."
 : getResumeDiagnosticMessage(resumeVersion?.notes)}
 </p>
 {resumeAiAttemptSummary ? (
 <p>
 Attempts: {resumeAiAttemptSummary}
 </p>
 ) : null}
 </div>
 </div>
 )}
 {resumeTruthReview && (
 <div>
 <button
 type="button"
 onClick={() => setResumeAiSummaryOpen((v) => !v)}
 >
 <div>
 <ShieldCheck />
 <span>AI Review Summary</span>
 <Badge variant="outline">
 {truthBadgeText(resumeTruthReview.supportStatus)}
 </Badge>
 {resumeHasWarnings && (
 <Badge variant="outline">
 Review required
 </Badge>
 )}
 </div>
 {resumeAiSummaryOpen ? <ChevronDown /> : <ChevronRight />}
 </button>
 {resumeAiSummaryOpen && (
 <div>
 <div>
 <span><span>{resumeTruthReview.supportedCount ?? 0}</span> supported</span>
 <span><span>{resumeTruthReview.partialCount ?? 0}</span> needs review</span>
 <span><span>{resumeTruthReview.unsupportedCount ?? 0}</span> unsupported</span>
 {(resumeTruthReview.seriousViolationCount ?? 0) > 0 && (
 <span>{resumeTruthReview.seriousViolationCount} serious violation{resumeTruthReview.seriousViolationCount === 1 ? "" : "s"}</span>
 )}
 </div>
 {(resumeTruthReview.unsupportedPhrases?.length ?? 0) > 0 && (
 <div>
 <p>Unsupported phrases:</p>
 <ul>
 {resumeTruthReview.unsupportedPhrases!.map((phrase, i) => (
 <li key={i}>{phrase}</li>
 ))}
 </ul>
 </div>
 )}
 {(resumeTruthReview.gapNotes?.length ?? 0) > 0 && (
 <div>
 <p>Gap notes:</p>
 <ul>
 {resumeTruthReview.gapNotes!.map((note, i) => (
 <li key={i}>{note}</li>
 ))}
 </ul>
 </div>
 )}
 </div>
 )}
 </div>
 )}
 <div>
 {resumePreviewText || (resumeVersionId && !resumeVersion ? "" : resumeVersionId ? "Resume content is still loading." : "Generate a resume in Step 4 first.")}
 </div>
 {resumeHasWarnings && resumeVersion?.status !== "approved" && (
 <label>
 <input
 type="checkbox"
 checked={resumeReviewChecked}
 onChange={(e) => setResumeReviewChecked(e.target.checked)}
 data-testid="resume-review-checkbox"
 />
 <span>
 I have reviewed this draft and acknowledge the flagged items above before approving.
 </span>
 </label>
 )}
 <div>
 <Button
 variant={resumeVersion?.status === "approved" ? "outline" : "default"}
 onClick={handleApproveResume}
 disabled={resumeVersion?.status === "approved" || !resumeVersionId || resumeNeedsRegeneration || (resumeHasWarnings && !resumeReviewChecked)}
 data-testid="btn-approve-resume"
 >
 {resumeNeedsRegeneration ? "Regenerate Resume Required" : resumeVersion?.status === "approved" ? <><Check /> Resume Approved</> : resumeHasWarnings && !resumeReviewChecked ? "Check review box to approve" : "Approve Resume"}
 </Button>
 <Button
 variant="outline"
 onClick={handleRejectResume}
 disabled={!resumeVersionId || rejectResume.isPending || tailorResume.isPending || (resumeVersion?.status !== "pending_approval" && !resumeNeedsRegeneration)}
 >
 {rejectResume.isPending || tailorResume.isPending ? "Regenerating..." : "Reject & Regenerate"}
 </Button>
 {resumeVersion?.status === "approved" && !resumeNeedsRegeneration && (
 <Button variant="secondary" asChild>
 <a href={`/api/resume-versions/${resumeVersionId}/export`} target="_blank" rel="noopener noreferrer">
 <Download /> Export DOCX
 </a>
 </Button>
 )}
 </div>
 </div>
 )}
 </div>

 <Separator />

 {/* Cover Letter Section */}
 <div>
 <div>
 <h3>
 <Wand2 />
 Cover Letter
 </h3>
 {coverLetterVersionId && (
 <Badge variant={coverLetterVersion?.status === "approved" ? "default" : "secondary"}>
 {coverLetterVersion?.status === "approved" ? "Approved" : "Pending Approval"}
 </Badge>
 )}
 </div>

 {useCustomComparison && coverCandidates.length > 0 ? (
 <div>
 <div>
 {coverCandidates.map((c) => (
 <button
 key={c.modelName}
 onClick={() => setActiveCoverTab(c.modelName)}
 >
 {c.modelName}
 {selectedCoverWinner === c.modelName && <Check />}
 {c.status === "failed" && <AlertCircle />}
 </button>
 ))}
 </div>
 <div>
 {(() => {
 const activeCandidate = coverCandidates.find((c) => c.modelName === activeCoverTab);
 if (activeCandidate?.status === "failed") {
 return (
 <div>
 <AlertCircle />
 <p>Generation Failed</p>
 <p>{activeCandidate.error}</p>
 </div>
 );
 }
 return (
 <div>
 <div>
 {activeCandidate?.preview || "No preview content available."}
 </div>
 <div>
 <div>
 <Button
 size="sm"
 variant={selectedCoverWinner === activeCoverTab ? "default" : "outline"}
 onClick={() => setSelectedCoverWinner(activeCoverTab)}
 >
 {selectedCoverWinner === activeCoverTab ? (
 <><Check /> Winner Selected</>
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
 <div>
 {coverLetterVersionId && !coverLetterVersion && (
 <Skeleton />
 )}
 {coverLetterVersion?.notes?.includes("No matching claims") && (
 <div>
 <AlertCircle />
 <div>
 <p>This is a fallback cover letter</p>
 <p>No claims were available when this was generated. Add claims in Step 3 and regenerate.</p>
 </div>
 </div>
 )}
 <div>
 {coverLetterVersion?.annotatedParagraphs && Array.isArray(coverLetterVersion.annotatedParagraphs) && coverLetterVersion.annotatedParagraphs.length > 0 ? (
 <div>
 {(coverLetterVersion.annotatedParagraphs as any[]).map((para, i) => (
 <div
 key={i}
 >
 <div>
 <span>
 {para.role}
 </span>
 <Badge variant="outline">
 {truthBadgeText(para.supportStatus ?? para.truthReview?.supportStatus)}
 </Badge>
 {para.claimIds?.length > 0 && (
 <div>
 <Tag />
 {para.claimIds.map((cid: number) => {
 const claim = claimMatches.find((m: any) => m.claim?.id === cid)?.claim;
 return (
 <span
 key={cid}
 title={claim?.summary}
 >
 {claim ? claim.summary.slice(0, 30) + (claim.summary.length > 30 ? "…" : "") : `Claim #${cid}`}
 </span>
 );
 })}
 </div>
 )}
 </div>
 <p>{para.text}</p>
 {para.truthReview && (
 <div>
 {(para.truthReview.unsupportedPhrases?.length ?? 0) > 0 && (
 <p>{para.truthReview.unsupportedPhrases.join("; ")}</p>
 )}
 {(para.truthReview.gapNotes?.length ?? 0) > 0 && (
 <p>Gaps: {para.truthReview.gapNotes.join("; ")}</p>
 )}
 {(para.truthReview.jobKeywordsUsed?.length ?? 0) > 0 && (
 <p>JD keywords: {para.truthReview.jobKeywordsUsed.join(", ")}</p>
 )}
 </div>
 )}
 </div>
 ))}
 </div>
 ) : (
 <div>
 {coverLetterVersionId ? (coverLetterVersion?.draftContent || "No tailored content available.") : "Generate a cover letter in Step 4 first."}
 </div>
 )}
 </div>
 {coverHasWarnings && (
 <div>
 <button
 type="button"
 onClick={() => setCoverAiSummaryOpen((v) => !v)}
 >
 <div>
 <ShieldCheck />
 <span>AI Review Summary</span>
 <Badge variant="outline">
 {coverTruthWarningParagraphs.length} paragraph{coverTruthWarningParagraphs.length === 1 ? "" : "s"} need review
 </Badge>
 </div>
 {coverAiSummaryOpen ? <ChevronDown /> : <ChevronRight />}
 </button>
 {coverAiSummaryOpen && (
 <div>
 {coverTruthWarningParagraphs.map((para, i) => {
 const status = para.supportStatus ?? para.truthReview?.supportStatus;
 const unsupportedPhrases: string[] = para.truthReview?.unsupportedPhrases ?? [];
 const gapNotes: string[] = para.truthReview?.gapNotes ?? [];
 return (
 <div key={i}>
 <div>
 <span>{para.role}</span>
 <Badge variant="outline">{truthBadgeText(status)}</Badge>
 </div>
 {unsupportedPhrases.length > 0 && (
 <p>Unsupported: {unsupportedPhrases.join("; ")}</p>
 )}
 {gapNotes.length > 0 && (
 <p>Gaps: {gapNotes.join("; ")}</p>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 )}
 {coverHasWarnings && coverLetterVersion?.status !== "approved" && (
 <label>
 <input
 type="checkbox"
 checked={coverReviewChecked}
 onChange={(e) => setCoverReviewChecked(e.target.checked)}
 data-testid="cover-review-checkbox"
 />
 <span>
 I have reviewed this draft and acknowledge the flagged paragraphs above before approving.
 </span>
 </label>
 )}
 <div>
 <Button
 variant={coverLetterVersion?.status === "approved" ? "outline" : "default"}
 onClick={handleApproveCover}
 disabled={coverLetterVersion?.status === "approved" || !coverLetterVersionId || (coverHasWarnings && !coverReviewChecked)}
 data-testid="btn-approve-cover"
 >
 {coverLetterVersion?.status === "approved" ? <><Check /> Cover Approved</> : coverHasWarnings && !coverReviewChecked ? "Check review box to approve" : "Approve Cover Letter"}
 </Button>
 <Button variant="outline" onClick={handleRejectCover} disabled={!coverLetterVersionId || coverLetterVersion?.status !== "pending_approval"}>
 Reject & Regenerate
 </Button>
 {coverLetterVersion?.status === "approved" && (
 <Button variant="secondary" asChild>
 <a href={`/api/cover-letter-versions/${coverLetterVersionId}/export`} target="_blank" rel="noopener noreferrer">
 <Download /> Export DOCX
 </a>
 </Button>
 )}
 </div>
 </div>
 )}
 </div>

 <div>
 <Button variant="outline" onClick={() => setStep("tailor")}>Back to Generate</Button>
 <Button variant="outline" onClick={handleSaveSession} disabled={savingSession}>
 <Save />
 {savingSession ? "Saving..." : "Save & Continue Later"}
 </Button>
 <Button
 size="lg"
 onClick={() => setStep("assisted")}
 disabled={resumeVersion?.status !== "approved" || coverLetterVersion?.status !== "approved" || resumeNeedsRegeneration}
 >
 Continue to Submission <ChevronRight />
 </Button>
 </div>
 </CardContent>
 </ContentCard>
 ) : null}

 {step === "assisted" ? (
 <ContentCard>
 <CardHeader>
 <CardTitle>
 <MousePointerClick />
 6) Assisted Apply Preparation
 </CardTitle>
 <CardDescription>
 Prepare audit-first assisted session. Final submission remains manual.
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div>
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

 <div>
 <Button onClick={handleCreateAssistedSession} disabled={createSession.isPending || !assistedForm.platform || !resumeVersionId || !coverLetterVersionId} >
 {createSession.isPending ? "Creating Session..." : "Create Assisted Session"}
 </Button>
 {assistedSessionId ? (
 <Badge>
 Session #{assistedSessionId} ready - <Link to="/assisted-apply">open</Link>
 </Badge>
 ) : null}
 </div>

 {applicationId ? (
 <div>
 <p>Mark final submission (manual action completed)</p>
 <div>
 <Input
 type="date"
 value={submissionDate}
 onChange={(e) => setSubmissionDate(e.target.value)}
 />
 <Input
 placeholder="Confirmation/reference ID"
 value={submissionRef}
 onChange={(e) => setSubmissionRef(e.target.value)}
 />
 </div>
 <div>
 <Button variant="secondary" onClick={handleMarkSubmitted}>
 Mark Submitted
 </Button>
 <Badge>
 Application #{applicationId} - <Link to="/applications">open</Link>
 </Badge>
 </div>
 </div>
 ) : null}

 <div>
 <Button variant="outline" onClick={() => setStep("approve")}>Back</Button>
 <div>
 <Button variant="outline" onClick={handleSaveSession} disabled={savingSession}>
 <Save />
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
 <CardTitle>
 <ClipboardCheck />
 Wizard Summary
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p>
 Job ID: <strong>{jobId ?? "-"}</strong>
 {jobId ? <Link to={`/jobs/${jobId}`}>open</Link> : null}
 </p>
 <p>
 Role Profile: <strong>{selectedRoleProfileId ?? "-"}</strong>
 {selectedRoleProfileId ? <Link to="/role-profiles">open</Link> : null}
 </p>
 <p>Selected Claims: <strong>{selectedClaimIds.length}</strong></p>
 <p>
 Resume Version: <strong>{resumeVersionId ?? "-"}</strong>
 {resumeVersionId ? <Link to="/resume-versions">open queue</Link> : null}
 </p>
 <p>
 Cover Letter Version: <strong>{coverLetterVersionId ?? "-"}</strong>
 {coverLetterVersionId ? <Link to="/cover-letters">open queue</Link> : null}
 </p>
 <p>
 Application: <strong>{applicationId ?? "-"}</strong>
 {applicationId ? <Link to="/applications">open</Link> : null}
 </p>
 <p>
 Assisted Session: <strong>{assistedSessionId ?? "-"}</strong>
 {assistedSessionId ? <Link to="/assisted-apply">open</Link> : null}
 </p>
 </CardContent>
 </ContentCard>
 </div>
 );
}

function StatusCard({ title, ok }: { title: string; ok: boolean }) {
 return (
<ContentCard>
 <CardContent>
 <span>{title}</span>
 <Badge variant={ok ? "default" : "outline"}>{ok ? "Done" : "Pending"}</Badge>
 </CardContent>
 </ContentCard>
 );
}
