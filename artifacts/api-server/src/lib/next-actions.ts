import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  baseResumeVersionsTable,
  roleProfilesTable,
  jobsTable,
  applicationsTable,
  wizardSessionsTable,
} from "@workspace/db/schema";

export interface NextAction {
  id: string;
  title: string;
  description: string;
  href: string;
  priority: number;
  category: "setup" | "action" | "review";
}

export async function getNextActions(userId: number): Promise<NextAction[]> {
  const actions: NextAction[] = [];

  const [resume] = await db
    .select()
    .from(baseResumeVersionsTable)
    .where(eq(baseResumeVersionsTable.userId, userId))
    .limit(1);
  if (!resume) {
    actions.push({
      id: "add_resume",
      title: "Add your base resume",
      description: "Upload or paste your resume so AI can tailor it for jobs",
      href: "/base-resume",
      priority: 1,
      category: "setup",
    });
  }

  const [profile] = await db
    .select()
    .from(roleProfilesTable)
    .where(eq(roleProfilesTable.userId, userId))
    .limit(1);
  if (!profile) {
    actions.push({
      id: "create_profile",
      title: "Create a role profile",
      description: "Define your target role for better job matching and scoring",
      href: "/role-profiles",
      priority: 2,
      category: "setup",
    });
  }

  const jobCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobsTable)
    .where(eq(jobsTable.userId, userId));
  if (jobCount[0].count === 0) {
    actions.push({
      id: "ingest_job",
      title: "Ingest your first job",
      description: "Paste a job URL or description to start tracking opportunities",
      href: "/jobs",
      priority: 3,
      category: "setup",
    });
  }

  const appCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(applicationsTable)
    .where(eq(applicationsTable.userId, userId));
  if (appCount[0].count === 0 && jobCount[0].count > 0) {
    actions.push({
      id: "track_application",
      title: "Track an application",
      description: "Log an application to monitor your pipeline progress",
      href: "/applications",
      priority: 4,
      category: "action",
    });
  }

  const wizardCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(wizardSessionsTable)
    .where(eq(wizardSessionsTable.userId, userId));
  if (wizardCount[0].count === 0 && jobCount[0].count > 0) {
    actions.push({
      id: "try_wizard",
      title: "Try the Apply Wizard",
      description: "Let AI guide you through tailoring and applying",
      href: "/apply-wizard",
      priority: 5,
      category: "action",
    });
  }

  return actions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
}
