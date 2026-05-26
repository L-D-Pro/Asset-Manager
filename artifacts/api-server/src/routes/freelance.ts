import { Router, type IRouter, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  freelanceProfilesTable,
  projectSourcesTable,
  freelanceProjectsTable,
  proposalVersionsTable,
  proposalOutcomesTable,
  clientMessageTemplatesTable,
  eventLogsTable,
  insertFreelanceProfileSchema,
  insertProjectSourceSchema,
  insertFreelanceProjectSchema,
  insertProposalVersionSchema,
  insertProposalOutcomeSchema,
  insertClientMessageTemplateSchema,
} from "@workspace/db";
import { draftProposalForProject } from "../lib/pipelines/proposal-draft";
import type { JobOpsRequest } from "../lib/http-types";
import { currentUserId, withoutUserId, withoutUserIds } from "../lib/ownership";

const router: IRouter = Router();
const IdParams = z.object({ id: z.coerce.number().int().positive() });

router.get("/freelance-profiles", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const query = z.object({ isActive: z.coerce.boolean().optional() }).safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(freelanceProfilesTable)
    .where(
      query.data.isActive != null
        ? and(eq(freelanceProfilesTable.userId, userId), eq(freelanceProfilesTable.isActive, query.data.isActive))
        : eq(freelanceProfilesTable.userId, userId),
    )
    .orderBy(desc(freelanceProfilesTable.createdAt));
  res.json(withoutUserIds(rows));
});

router.post("/freelance-profiles", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const parsed = insertFreelanceProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(freelanceProfilesTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(withoutUserId(row!));
});

router.patch("/freelance-profiles/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = IdParams.safeParse(req.params);
  const parsed = insertFreelanceProfileSchema.partial().safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.success ? parsed.error?.message : params.error.message });
    return;
  }
  const [row] = await db
    .update(freelanceProfilesTable)
    .set(parsed.data)
    .where(and(eq(freelanceProfilesTable.id, params.data.id), eq(freelanceProfilesTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Freelance profile not found" });
    return;
  }
  res.json(withoutUserId(row));
});

router.get("/project-sources", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const rows = await db
    .select()
    .from(projectSourcesTable)
    .where(eq(projectSourcesTable.userId, userId))
    .orderBy(desc(projectSourcesTable.createdAt));
  res.json(withoutUserIds(rows));
});

router.post("/project-sources", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const parsed = insertProjectSourceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(projectSourcesTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(withoutUserId(row!));
});

router.get("/freelance-projects", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const query = z.object({
    profileId: z.coerce.number().int().positive().optional(),
    status: z.string().optional(),
    platform: z.string().optional(),
  }).safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const conditions = [eq(freelanceProjectsTable.userId, userId)];
  if (query.data.profileId != null) {
    conditions.push(eq(freelanceProjectsTable.profileId, query.data.profileId));
  }
  if (query.data.status) {
    conditions.push(eq(freelanceProjectsTable.status, query.data.status));
  }
  if (query.data.platform) {
    conditions.push(eq(freelanceProjectsTable.platform, query.data.platform));
  }
  const rows = await db
    .select()
    .from(freelanceProjectsTable)
    .where(and(...conditions))
    .orderBy(desc(freelanceProjectsTable.createdAt));
  res.json(withoutUserIds(rows));
});

router.post("/freelance-projects", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const parsed = insertFreelanceProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.profileId != null) {
    const [profile] = await db.select({ id: freelanceProfilesTable.id }).from(freelanceProfilesTable)
      .where(and(eq(freelanceProfilesTable.id, parsed.data.profileId), eq(freelanceProfilesTable.userId, userId)));
    if (!profile) { res.status(404).json({ error: "Freelance profile not found" }); return; }
  }
  if (parsed.data.sourceId != null) {
    const [source] = await db.select({ id: projectSourcesTable.id }).from(projectSourcesTable)
      .where(and(eq(projectSourcesTable.id, parsed.data.sourceId), eq(projectSourcesTable.userId, userId)));
    if (!source) { res.status(404).json({ error: "Project source not found" }); return; }
  }
  const [row] = await db.insert(freelanceProjectsTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(withoutUserId(row!));
});

router.post("/freelance-projects/:id/score", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = IdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [project] = await db
    .select()
    .from(freelanceProjectsTable)
    .where(and(eq(freelanceProjectsTable.id, params.data.id), eq(freelanceProjectsTable.userId, userId)));
  if (!project) {
    res.status(404).json({ error: "Freelance project not found" });
    return;
  }
  const [profile] = project.profileId
    ? await db
        .select()
        .from(freelanceProfilesTable)
        .where(and(eq(freelanceProfilesTable.id, project.profileId), eq(freelanceProfilesTable.userId, userId)))
    : [];

  const profileSkills = new Set((profile?.skills ?? []).map((s) => s.toLowerCase()));
  const requiredSkills = project.requiredSkills ?? [];
  const matchedSkills = requiredSkills.filter((s) => profileSkills.has(s.toLowerCase()));
  const fitScore = requiredSkills.length
    ? Math.round((matchedSkills.length / requiredSkills.length) * 100)
    : Math.min(80, Math.max(20, profileSkills.size * 8));
  const riskFlags = [
    project.budgetType == null ? "budget_unspecified" : null,
    project.descriptionText.length < 200 ? "thin_project_description" : null,
  ].filter((flag): flag is string => Boolean(flag));

  const [row] = await db
    .update(freelanceProjectsTable)
    .set({
      fitScore,
      riskFlags,
      metadata: {
        ...(project.metadata as Record<string, unknown>),
        matchedSkills,
        scoredAt: new Date().toISOString(),
      },
    })
    .where(and(eq(freelanceProjectsTable.id, params.data.id), eq(freelanceProjectsTable.userId, userId)))
    .returning();
  res.json(row ? withoutUserId(row) : row);
});

router.post("/freelance-projects/:id/draft-proposal", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = IdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [project] = await db
    .select()
    .from(freelanceProjectsTable)
    .where(and(eq(freelanceProjectsTable.id, params.data.id), eq(freelanceProjectsTable.userId, userId)));
  if (!project) {
    res.status(404).json({ error: "Freelance project not found" });
    return;
  }

  const profileBody = z
    .object({ profileId: z.coerce.number().int().positive().optional() })
    .safeParse(req.body);
  const profileId = profileBody.success ? profileBody.data.profileId : undefined;
  const resolvedProfileId = profileId ?? project.profileId;
  if (!resolvedProfileId) {
    res.status(400).json({ error: "A freelance profile is required before drafting a proposal." });
    return;
  }
  const [profile] = await db
    .select()
    .from(freelanceProfilesTable)
    .where(and(eq(freelanceProfilesTable.id, resolvedProfileId), eq(freelanceProfilesTable.userId, userId)));
  if (!profile) {
    res.status(404).json({ error: "Freelance profile not found" });
    return;
  }

  const row = await draftProposalForProject(project, profile, userId);
  await db.insert(eventLogsTable).values({
    userId,
    entityType: "proposal_version",
    entityId: row.id,
    eventType: "proposal_drafted",
    actorType: "system",
    metadata: {
      projectId: project.id,
      profileId: profile.id,
      status: "pending_approval",
      submissionPolicy: "human_final_submit_required",
    },
  });
  res.status(201).json(withoutUserId(row));
});

router.get("/proposal-versions", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const query = z.object({
    projectId: z.coerce.number().int().positive().optional(),
    status: z.string().optional(),
  }).safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const conditions = [eq(proposalVersionsTable.userId, userId)];
  if (query.data.projectId != null) {
    conditions.push(eq(proposalVersionsTable.projectId, query.data.projectId));
  }
  if (query.data.status) {
    conditions.push(eq(proposalVersionsTable.status, query.data.status));
  }
  const rows = await db
    .select()
    .from(proposalVersionsTable)
    .where(and(...conditions))
    .orderBy(desc(proposalVersionsTable.createdAt));
  res.json(withoutUserIds(rows));
});

router.post("/proposal-versions", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const parsed = insertProposalVersionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [project] = await db.select({ id: freelanceProjectsTable.id }).from(freelanceProjectsTable)
    .where(and(eq(freelanceProjectsTable.id, parsed.data.projectId), eq(freelanceProjectsTable.userId, userId)));
  if (!project) { res.status(404).json({ error: "Freelance project not found" }); return; }
  if (parsed.data.profileId != null) {
    const [profile] = await db.select({ id: freelanceProfilesTable.id }).from(freelanceProfilesTable)
      .where(and(eq(freelanceProfilesTable.id, parsed.data.profileId), eq(freelanceProfilesTable.userId, userId)));
    if (!profile) { res.status(404).json({ error: "Freelance profile not found" }); return; }
  }
  const [row] = await db.insert(proposalVersionsTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(withoutUserId(row!));
});

router.post("/proposal-versions/:id/approve", async (req: JobOpsRequest, res): Promise<void> => {
  await transitionProposal(req, res, "approved");
});

router.post("/proposal-versions/:id/reject", async (req: JobOpsRequest, res): Promise<void> => {
  await transitionProposal(req, res, "rejected");
});

router.get("/proposal-outcomes", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const rows = await db
    .select()
    .from(proposalOutcomesTable)
    .where(eq(proposalOutcomesTable.userId, userId))
    .orderBy(desc(proposalOutcomesTable.createdAt));
  res.json(withoutUserIds(rows));
});

router.post("/proposal-outcomes", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const parsed = insertProposalOutcomeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.projectId != null) {
    const [project] = await db.select({ id: freelanceProjectsTable.id }).from(freelanceProjectsTable)
      .where(and(eq(freelanceProjectsTable.id, parsed.data.projectId), eq(freelanceProjectsTable.userId, userId)));
    if (!project) { res.status(404).json({ error: "Freelance project not found" }); return; }
  }
  if (parsed.data.proposalVersionId != null) {
    const [proposal] = await db.select({ id: proposalVersionsTable.id }).from(proposalVersionsTable)
      .where(and(eq(proposalVersionsTable.id, parsed.data.proposalVersionId), eq(proposalVersionsTable.userId, userId)));
    if (!proposal) { res.status(404).json({ error: "Proposal version not found" }); return; }
  }
  const [row] = await db.insert(proposalOutcomesTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(withoutUserId(row!));
});

router.get("/client-message-templates", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const rows = await db
    .select()
    .from(clientMessageTemplatesTable)
    .where(eq(clientMessageTemplatesTable.userId, userId))
    .orderBy(desc(clientMessageTemplatesTable.createdAt));
  res.json(withoutUserIds(rows));
});

router.post("/client-message-templates", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const parsed = insertClientMessageTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(clientMessageTemplatesTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(withoutUserId(row!));
});

async function transitionProposal(
  req: JobOpsRequest,
  res: Response,
  status: "approved" | "rejected",
): Promise<void> {
  const userId = currentUserId(req);
  const params = IdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(proposalVersionsTable)
    .where(and(eq(proposalVersionsTable.id, params.data.id), eq(proposalVersionsTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Proposal version not found" });
    return;
  }
  if (existing.status !== "pending_approval") {
    res.status(409).json({
      error: `Cannot ${status === "approved" ? "approve" : "reject"} a proposal in status "${existing.status}".`,
    });
    return;
  }
  const [row] = await db
    .update(proposalVersionsTable)
    .set({ status })
    .where(and(eq(proposalVersionsTable.id, params.data.id), eq(proposalVersionsTable.userId, userId)))
    .returning();
  res.json(row ? withoutUserId(row) : row);
}

export default router;
