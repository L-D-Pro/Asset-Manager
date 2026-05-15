import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Handshake, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { smartApi, smartApiError } from "@/lib/smart-ai-api";
import { useState } from "react";
import { AiProgressButton } from "@/components/ai/ai-progress-button";

interface FreelanceProfile {
 id: number;
 name: string;
 skills: string[];
 contractorResumeText: string;
}

interface FreelanceProject {
 id: number;
 profileId: number | null;
 platform: string;
 title: string;
 projectUrl: string | null;
 descriptionText: string;
 requiredSkills: string[];
 fitScore: number | null;
 riskFlags: string[];
 status: string;
}

interface ProposalVersion {
 id: number;
 projectId: number;
 status: string;
 proposalText: string;
 clientMessageText: string | null;
 bidAmount: string | null;
 bidType: string | null;
 riskNotes: string | null;
}

export default function FreelancePage() {
 const { toast } = useToast();
 const queryClient = useQueryClient();
 const [profileForm, setProfileForm] = useState({
 name: "",
 skills: "",
 contractorResumeText: "",
 });
 const [projectForm, setProjectForm] = useState({
 profileId: "",
 title: "",
 projectUrl: "",
 descriptionText: "",
 requiredSkills: "",
 });

 const { data: profiles = [] } = useQuery({
 queryKey: ["freelance-profiles"],
 queryFn: () => smartApi<FreelanceProfile[]>("/freelance-profiles"),
 });
 const { data: projects = [] } = useQuery({
 queryKey: ["freelance-projects"],
 queryFn: () => smartApi<FreelanceProject[]>("/freelance-projects"),
 });
 const { data: proposals = [] } = useQuery({
 queryKey: ["proposal-versions"],
 queryFn: () => smartApi<ProposalVersion[]>("/proposal-versions"),
 });

 const createProfile = useMutation({
 mutationFn: () =>
 smartApi("/freelance-profiles", {
 method: "POST",
 body: JSON.stringify({
 name: profileForm.name,
 contractorResumeText: profileForm.contractorResumeText,
 skills: splitList(profileForm.skills),
 isActive: true,
 }),
 }),
 onSuccess: () => {
 toast({ title: "Contractor profile created" });
 setProfileForm({ name: "", skills: "", contractorResumeText: "" });
 queryClient.invalidateQueries({ queryKey: ["freelance-profiles"] });
 },
 onError: (error) =>
 toast({
 title: "Failed to create profile",
 description: smartApiError(error, "Please check the profile fields."),
 variant: "destructive",
 }),
 });

 const createProject = useMutation({
 mutationFn: () =>
 smartApi("/freelance-projects", {
 method: "POST",
 body: JSON.stringify({
 profileId: projectForm.profileId ? Number(projectForm.profileId) : null,
 platform: "upwork",
 title: projectForm.title,
 projectUrl: projectForm.projectUrl || null,
 descriptionText: projectForm.descriptionText,
 requiredSkills: splitList(projectForm.requiredSkills),
 status: "new",
 }),
 }),
 onSuccess: () => {
 toast({ title: "Project captured" });
 setProjectForm({ profileId: "", title: "", projectUrl: "", descriptionText: "", requiredSkills: "" });
 queryClient.invalidateQueries({ queryKey: ["freelance-projects"] });
 },
 onError: (error) =>
 toast({
 title: "Failed to create project",
 description: smartApiError(error, "Please check the project fields."),
 variant: "destructive",
 }),
 });

 const scoreProject = useMutation({
 mutationFn: (id: number) =>
 smartApi(`/freelance-projects/${id}/score`, { method: "POST", body: JSON.stringify({}) }),
 onSuccess: () => {
 toast({ title: "Project scored" });
 queryClient.invalidateQueries({ queryKey: ["freelance-projects"] });
 },
 });

 const draftProposal = useMutation({
 mutationFn: (id: number) =>
 smartApi(`/freelance-projects/${id}/draft-proposal`, { method: "POST", body: JSON.stringify({}) }),
 onSuccess: () => {
 toast({ title: "Proposal draft created for review" });
 queryClient.invalidateQueries({ queryKey: ["proposal-versions"] });
 },
 onError: (error) =>
 toast({
 title: "Failed to draft proposal",
 description: smartApiError(error, "Check AI config for proposal_drafting or default."),
 variant: "destructive",
 }),
 });

 return (
 <div>
 <PageHeader
 title="Freelance Assist"
 subtitle="Manage your freelance pipeline — from proposals to retainer tracking."
 variant="workflow"
 />

 <div>
 <ContentCard>
 <CardHeader>
 <CardTitle>Contractor Profile</CardTitle>
 <CardDescription>Source-of-truth material used by proposal drafting.</CardDescription>
 </CardHeader>
 <CardContent>
 <Input
 value={profileForm.name}
 onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })}
 placeholder="Profile name"
 />
 <Input
 value={profileForm.skills}
 onChange={(event) => setProfileForm({ ...profileForm, skills: event.target.value })}
 placeholder="Skills, comma separated"
 />
 <Textarea
 value={profileForm.contractorResumeText}
 onChange={(event) => setProfileForm({ ...profileForm, contractorResumeText: event.target.value })}
 placeholder="Contractor resume, portfolio summary, proof points"
 />
 <Button
 disabled={!profileForm.name || createProfile.isPending}
 onClick={() => createProfile.mutate()}
 >
 Create Profile
 </Button>
 </CardContent>
 </ContentCard>

 <ContentCard>
 <CardHeader>
 <CardTitle>Capture Project</CardTitle>
 <CardDescription>Paste project text manually or from a user-opened page capture.</CardDescription>
 </CardHeader>
 <CardContent>
 <Input
 value={projectForm.profileId}
 onChange={(event) => setProjectForm({ ...projectForm, profileId: event.target.value })}
 placeholder={`Profile ID ${profiles[0]?.id ? `(e.g. ${profiles[0].id})` : ""}`}
 type="number"
 />
 <Input
 value={projectForm.title}
 onChange={(event) => setProjectForm({ ...projectForm, title: event.target.value })}
 placeholder="Project title"
 />
 <Input
 value={projectForm.projectUrl}
 onChange={(event) => setProjectForm({ ...projectForm, projectUrl: event.target.value })}
 placeholder="Project URL optional"
 />
 <Input
 value={projectForm.requiredSkills}
 onChange={(event) => setProjectForm({ ...projectForm, requiredSkills: event.target.value })}
 placeholder="Required skills, comma separated"
 />
 <Textarea
 value={projectForm.descriptionText}
 onChange={(event) => setProjectForm({ ...projectForm, descriptionText: event.target.value })}
 placeholder="Project description"
 />
 <Button
 disabled={!projectForm.title || !projectForm.descriptionText || createProject.isPending}
 onClick={() => createProject.mutate()}
 >
 Capture Project
 </Button>
 </CardContent>
 </ContentCard>
 </div>

 <ContentCard>
 <CardHeader>
 <CardTitle>
 <Target />
 Projects
 </CardTitle>
 <CardDescription>Score fit first, then draft a proposal only when it looks worth your time.</CardDescription>
 </CardHeader>
 <CardContent>
  {projects.length === 0 ? <p>No freelance projects yet.</p> : null}
 {projects.map((project) => (
  <div key={project.id}>
 <div>
 <span>{project.title}</span>
 <Badge variant={project.fitScore != null && project.fitScore >= 70 ? "default" : "outline"}>
 {project.fitScore == null ? "unscored" : `${project.fitScore}% fit`}
 </Badge>
 </div>
 <p>{project.descriptionText}</p>
 {project.riskFlags.length ? (
 <p>Risks: {project.riskFlags.join(", ")}</p>
 ) : null}
 <div>
 <Button size="sm" variant="outline" onClick={() => scoreProject.mutate(project.id)}>
 Score
 </Button>
 <AiProgressButton
 size="sm"
 onClick={() => draftProposal.mutate(project.id)}
 isPending={draftProposal.isPending}
 idleLabel="Draft Proposal"
 data-testid={`btn-draft-proposal-${project.id}`}
 />
 </div>
 </div>
 ))}
 </CardContent>
 </ContentCard>

 <ContentCard>
 <CardHeader>
 <CardTitle>Proposal Queue</CardTitle>
 <CardDescription>Drafts stay pending until you review and manually submit outside the app.</CardDescription>
 </CardHeader>
 <CardContent>
  {proposals.length === 0 ? <p>No proposal drafts yet.</p> : null}
 {proposals.map((proposal) => (
  <div key={proposal.id}>
 <div>
 <span>Project #{proposal.projectId}</span>
 <Badge>{proposal.status}</Badge>
 </div>
 <pre>{proposal.proposalText}</pre>
 {proposal.clientMessageText ? (
 <pre>{proposal.clientMessageText}</pre>
 ) : null}
 {proposal.riskNotes ? <p>{proposal.riskNotes}</p> : null}
 </div>
 ))}
 </CardContent>
 </ContentCard>
 </div>
 );
}

function splitList(value: string): string[] {
 return value
 .split(",")
 .map((item) => item.trim())
 .filter(Boolean);
}
