import { pool } from "@workspace/db";

export interface ResetTableSummary {
  table: string;
  rowsBefore: number;
}

export interface AppTestResetSummary {
  mode: "app_test_data";
  resetsIdentity: true;
  preservedTables: string[];
  resetTables: ResetTableSummary[];
  missingTables: string[];
  totalRowsBefore: number;
}

export interface AppTestResetResult extends AppTestResetSummary {
  resetAt: string;
  resetByAdminId: number;
}

export const PRESERVED_APP_RESET_TABLES = [
  "admin_users",
  "ai_learning_config",
  "ai_model_configs",
  "ai_prompt_versions",
  "best_practices",
  "invite_codes",
  "job_sources",
  "site_adapters",
  "ui_shell_configs",
  "user_usage_limits",
  "waitlist",
] as const;

export const APP_TEST_RESET_TABLES = [
  "applications",
  "cover_letter_versions",
  "resume_versions",
  "event_logs",
  "feedback_signals",
  "ai_run_evaluations",
  "ai_training_examples",
  "ai_variant_comparisons",
  "ai_variant_stats",
  "wizard_sessions",
  "jobs",
  "claims",
  "base_resume_versions",
  "role_profiles",
  "application_actions",
  "application_form_fields",
  "application_sessions",
  "feedback",
  "freelance_profiles",
  "project_sources",
  "freelance_projects",
  "proposal_versions",
  "proposal_outcomes",
  "client_message_templates",
  "conversations",
  "messages",
  "job_listings",
  "trends_cache",
  "user_stats",
  "xp_log",
  "user_achievements",
  "user_quests",
  "streak_log",
  "user_onboarding_state",
] as const;

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function tableExists(client: Pick<typeof pool, "query">, table: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    "select to_regclass($1) is not null as exists",
    [`public.${table}`],
  );
  return result.rows[0]?.exists === true;
}

async function countRows(client: Pick<typeof pool, "query">, table: string): Promise<number> {
  const result = await client.query<{ count: string }>(
    `select count(*)::text as count from ${quoteIdentifier(table)}`,
  );
  return Number.parseInt(result.rows[0]?.count ?? "0", 10);
}

export async function getAppTestResetSummary(): Promise<AppTestResetSummary> {
  const client = await pool.connect();
  try {
    const resetTables: ResetTableSummary[] = [];
    const missingTables: string[] = [];

    for (const table of APP_TEST_RESET_TABLES) {
      if (!(await tableExists(client, table))) {
        missingTables.push(table);
        continue;
      }

      resetTables.push({
        table,
        rowsBefore: await countRows(client, table),
      });
    }

    return {
      mode: "app_test_data",
      resetsIdentity: true,
      preservedTables: [...PRESERVED_APP_RESET_TABLES],
      resetTables,
      missingTables,
      totalRowsBefore: resetTables.reduce((sum, row) => sum + row.rowsBefore, 0),
    };
  } finally {
    client.release();
  }
}

export async function resetAppTestData(adminId: number): Promise<AppTestResetResult> {
  const client = await pool.connect();
  try {
    await client.query("begin");

    const resetTables: ResetTableSummary[] = [];
    const missingTables: string[] = [];

    for (const table of APP_TEST_RESET_TABLES) {
      if (!(await tableExists(client, table))) {
        missingTables.push(table);
        continue;
      }

      resetTables.push({
        table,
        rowsBefore: await countRows(client, table),
      });
    }

    if (resetTables.length > 0) {
      const tableList = resetTables.map((row) => quoteIdentifier(row.table)).join(", ");
      await client.query(`truncate table ${tableList} restart identity cascade`);
    }

    if (await tableExists(client, "user_usage_limits")) {
      await client.query(
        "update user_usage_limits set weekly_used = 0, total_used = 0, period_start = now(), updated_at = now()",
      );
    }

    await client.query("commit");

    return {
      mode: "app_test_data",
      resetsIdentity: true,
      preservedTables: [...PRESERVED_APP_RESET_TABLES],
      resetTables,
      missingTables,
      totalRowsBefore: resetTables.reduce((sum, row) => sum + row.rowsBefore, 0),
      resetAt: new Date().toISOString(),
      resetByAdminId: adminId,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
