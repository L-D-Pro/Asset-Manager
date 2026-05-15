import {
  useListBaseResumeHistory,
  useCreateBaseResume,
  useImportBaseResume,
  useRestoreBaseResumeVersion,
  useDeleteBaseResumeVersion,
  getListBaseResumeHistoryQueryKey,
} from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileText, RotateCcw, Save, AlertCircle, History, Upload, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/api-errors";

export default function BaseResumePage() {
  const { data: history = [], isLoading: historyLoading } = useListBaseResumeHistory();
  const currentResume = history.find((version) => version.isCurrent);
  const saveResume = useCreateBaseResume();
  const importResume = useImportBaseResume();
  const restoreResume = useRestoreBaseResumeVersion();
  const deleteVersion = useDeleteBaseResumeVersion();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [contentText, setContentText] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  useEffect(() => {
  setContentText(currentResume?.contentText ?? "");
  }, [currentResume?.id, currentResume?.contentText]);

  const hasCurrentResume = Boolean(currentResume);
  const currentLoading = historyLoading;
  const showEmptyState = !historyLoading && !hasCurrentResume;
  const saveDisabled = saveResume.isPending || contentText.trim().length === 0;

  const refreshQueries = async () => {
  await queryClient.invalidateQueries({
  queryKey: getListBaseResumeHistoryQueryKey(),
  });
  };

  const handleSave = () => {
  saveResume.mutate(
  {
  data: {
  contentText: contentText.trim(),
  },
  },
  {
  onSuccess: async (saved) => {
  setContentText(saved.contentText);
  await refreshQueries();
  toast({ title: "Base resume saved" });
  },
  onError: (error) => {
  toast({
  title: "Failed to save base resume",
  description: getErrorMessage(error, "Please try again."),
  variant: "destructive",
  });
  },
  },
  );
  };

  const handleImport = () => {
  if (!uploadFile) {
  toast({
  title: "Choose a resume file",
  description: "Upload a DOCX or text-based PDF resume.",
  variant: "destructive",
  });
  return;
  }

  importResume.mutate(
  {
  data: {
  file: uploadFile,
  label: `Imported - ${uploadFile.name}`,
  },
  },
  {
  onSuccess: async (saved) => {
  setContentText(saved.contentText);
  setUploadFile(null);
  await refreshQueries();
  toast({ title: "Resume imported" });
  },
  onError: (error) => {
  toast({
  title: "Failed to import resume",
  description: getErrorMessage(error, "Upload a DOCX or text-based PDF."),
  variant: "destructive",
  });
  },
  },
  );
  };

  const handleRestore = (id: number) => {
  restoreResume.mutate(
  { id },
  {
  onSuccess: async (restored) => {
  setContentText(restored.contentText);
  await refreshQueries();
  toast({ title: "Base resume restored" });
  },
  onError: (error) => {
  toast({
  title: "Failed to restore version",
  description: getErrorMessage(error, "Please try again."),
  variant: "destructive",
  });
  },
  },
  );
  };

  const handleDelete = (id: number) => {
    deleteVersion.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Version deleted" });
          setDeleteTarget(null);
          refreshQueries();
        },
        onError: (error) => {
          toast({
            title: "Failed to delete version",
            description: getErrorMessage(error, "Please try again."),
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleBulkDelete = async () => {
    const targets = history.filter((v) => !v.isCurrent);
    if (targets.length === 0) {
      setIsBulkDeleteOpen(false);
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const version of targets) {
      try {
        await deleteVersion.mutateAsync({ id: version.id });
        successCount++;
      } catch {
        failCount++;
      }
    }

    await refreshQueries();
    setIsBulkDeleteOpen(false);

    if (failCount === 0) {
      toast({ title: `Cleaned up ${successCount} version${successCount === 1 ? "" : "s"}` });
    } else {
      toast({
        title: `Cleaned up ${successCount} version${successCount === 1 ? "" : "s"}`,
        description: `${failCount} failed to delete`,
        variant: "destructive",
      });
    }
  };

  const deletableVersions = history.filter((v) => !v.isCurrent);

  return (
  <div className="space-y-8">
  <PageHeader
  title="Base Resume"
  subtitle="Maintain the single source-of-truth resume that AI tailoring builds from."
  variant="workflow"
  />

  <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_360px]">
   <ContentCard>
  <CardHeader className="space-y-3">
  <div className="flex items-start justify-between gap-4">
  <div>
  <CardTitle className="flex items-center gap-2 text-foreground">
  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
  <FileText className="h-4 w-4 text-primary" />
  </div>
  Current Resume Text
  </CardTitle>
   <CardDescription className="mt-1 text-muted-foreground">
  Paste or edit your canonical plain-text resume here. Each save creates a new immutable version.
  </CardDescription>
  </div>
  {hasCurrentResume && <Badge variant="secondary">Current</Badge>}
  </div>
  {currentLoading ? (
  <Skeleton className="h-10 w-64" />
  ) : hasCurrentResume ? (
  <div className="text-xs text-muted-foreground space-y-1">
  <p>
  Last saved {format(new Date(currentResume!.createdAt), "MMM d, yyyy h:mm a")}
  </p>
  {currentResume!.label && <p>{currentResume!.label}</p>}
  </div>
  ) : showEmptyState ? (
  <Alert>
  <AlertCircle className="h-4 w-4" />
  <AlertDescription>
  No base resume exists yet. Save your current resume to unlock AI tailoring.
  </AlertDescription>
  </Alert>
  ) : null}
  </CardHeader>
  <CardContent className="space-y-4">
   <div className="rounded-xl bg-surface/50 p-4 space-y-3 border border-border/30">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
  <div className="flex-1 space-y-2">
  <label className="text-sm font-medium" htmlFor="base-resume-upload">
  Import DOCX or PDF
  </label>
  <Input
  id="base-resume-upload"
  type="file"
  accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
  data-testid="input-base-resume-upload"
  />
  </div>
  <Button
  type="button"
  variant="secondary"
  onClick={handleImport}
  disabled={!uploadFile || importResume.isPending}
  data-testid="btn-import-base-resume"
  >
  <Upload className="mr-2 h-4 w-4" />
  {importResume.isPending ? "Importing..." : "Import"}
  </Button>
  </div>
  <p className="text-xs text-muted-foreground">
  {uploadFile ? uploadFile.name : "Files are converted to text only; originals are not stored."}
  </p>
  </div>
  <Textarea
  value={contentText}
  onChange={(event) => setContentText(event.target.value)}
  placeholder="Paste your full plain-text resume here..."
  className="min-h-[28rem] resize-y font-mono text-sm leading-6"
  data-testid="textarea-base-resume"
  />
  <div className="flex items-center justify-between gap-3">
  <p className="text-xs text-muted-foreground">
  {contentText.trim().length} characters
  </p>
  <Button
  onClick={handleSave}
  disabled={saveDisabled}
  data-testid="btn-save-base-resume"
  variant="default"
  >
  <Save className="mr-2 h-4 w-4" />
  {saveResume.isPending ? "Saving..." : hasCurrentResume ? "Save New Version" : "Save Base Resume"}
  </Button>
  </div>
  </CardContent>
  </ContentCard>

   <ContentCard>
  <CardHeader>
  <div className="flex items-start justify-between gap-3">
    <div>
      <CardTitle className="flex items-center gap-2 text-foreground">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
      <History className="h-4 w-4 text-primary" />
      </div>
      Version History
      </CardTitle>
      <CardDescription>
      Restore any prior save as the new current version without overwriting history.
      </CardDescription>
    </div>
    {deletableVersions.length > 0 && (
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
        onClick={() => setIsBulkDeleteOpen(true)}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Clean Up
      </Button>
    )}
  </div>
  </CardHeader>
  <CardContent>
  {historyLoading ? (
  <div className="space-y-3">
  <Skeleton className="h-20 w-full" />
  <Skeleton className="h-20 w-full" />
  <Skeleton className="h-20 w-full" />
  </div>
  ) : history.length === 0 ? (
   <div className="rounded-xl border border-border/30 border-dashed p-6 text-center text-sm text-muted-foreground bg-surface/30">
  No saved resume versions yet.
  </div>
  ) : (
  <ScrollArea className="h-[36rem] pr-3">
  <div className="space-y-3">
  {history.map((version) => (
  <div
  key={version.id}
   className="quiet-card p-4 space-y-3"
  data-testid={`card-base-resume-history-${version.id}`}
  >
  <div className="flex items-start justify-between gap-3">
  <div className="space-y-1 min-w-0">
  <div className="flex items-center gap-2 flex-wrap">
  <p className="text-sm font-medium truncate">
  {version.label || `Version ${version.id}`}
  </p>
  {version.isCurrent && <Badge variant="secondary">Current</Badge>}
  </div>
  <p className="text-xs text-muted-foreground">
  {format(new Date(version.createdAt), "MMM d, yyyy h:mm a")}
  </p>
  </div>
  <div className="flex items-center gap-1 shrink-0">
    <Button
    variant="secondary"
    size="sm"
    disabled={restoreResume.isPending || version.isCurrent}
    onClick={() => handleRestore(version.id)}
    data-testid={`btn-restore-base-resume-${version.id}`}
    >
    <RotateCcw className="mr-1 h-3.5 w-3.5" />
    Restore
    </Button>
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive hover:bg-destructive/10"
      disabled={version.isCurrent && history.length > 1}
      onClick={() => setDeleteTarget(version.id)}
      data-testid={`btn-delete-base-resume-${version.id}`}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  </div>
  </div>
  <p className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-hidden">
  {version.contentText}
  </p>
  </div>
  ))}
  </div>
  </ScrollArea>
  )}
  </CardContent>
  </ContentCard>
  </div>

  {/* Single Delete Confirmation */}
  <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
    <DialogContent className="sm:max-w-md rounded-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Delete Version
        </DialogTitle>
        <DialogDescription>
          Are you sure you want to delete this base resume version? This cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => setDeleteTarget(null)}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          disabled={deleteVersion.isPending}
          onClick={() => { if (deleteTarget != null) handleDelete(deleteTarget); }}
        >
          {deleteVersion.isPending ? "Deleting..." : "Delete"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  {/* Bulk Clean Up Confirmation */}
  <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
    <DialogContent className="sm:max-w-md rounded-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Clean Up Versions
        </DialogTitle>
        <DialogDescription>
          This will permanently delete {deletableVersions.length} non-current version{deletableVersions.length === 1 ? "" : "s"}. This cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          disabled={deleteVersion.isPending}
          onClick={handleBulkDelete}
        >
          {deleteVersion.isPending ? "Deleting..." : "Delete All"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </div>
  );
}
