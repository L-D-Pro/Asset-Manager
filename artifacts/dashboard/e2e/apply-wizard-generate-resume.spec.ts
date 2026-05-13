/**
 * End-to-end tests for the Apply Wizard — Generate Resume and Cover Letter flows.
 *
 * AI-calling API routes are intercepted via page.route() and return deterministic
 * mock responses so these tests do not depend on the AI service. All other
 * endpoints (auth, job creation, job parsing) use the real dev API.
 *
 * Mocked endpoints:
 *   POST /api/jobs/:id/tailor        → 201 with tailoredDocumentText set
 *   POST /api/jobs/:id/cover-letter  → 201 with draftContent set
 *
 * Prerequisites (dev DB must have):
 *   - Admin user: username "admin", password "TestPassword123!", email_verified, no TOTP
 *   - At least one current base resume in base_resume_versions (is_current = true)
 *   - At least one active claim in the claims_ledger table
 *     (required: the cover letter button is disabled when activeClaims.length === 0)
 *   - VITE_ENABLE_APPLY_WIZARD=true in artifacts/dashboard/.env
 *
 * Covered assertions:
 *   1. Resume: after clicking "Generate Resume" the error banner MUST NOT appear
 *      and the draft preview MUST be visible.
 *   2. Cover Letter: after generating the resume and clicking "Generate Cover Letter"
 *      a labelled draft MUST appear — this assertion is mandatory (no bypass path).
 *
 * Running locally:
 *   PLAYWRIGHT_BASE_URL=http://localhost:<PORT> pnpm --filter @workspace/dashboard run test:e2e
 */

import { test, expect, type Page, type Route } from "@playwright/test";

// ─── Mock response fixtures ───────────────────────────────────────────────────

const MOCK_RESUME_VERSION = {
  id: 9001,
  jobId: null,
  baseResumeVersionId: 1,
  label: "AI tailored resume",
  templateId: "standard",
  status: "pending_approval",
  tailoredDocumentText: [
    "Jane Doe | jane@example.com | San Diego, CA",
    "",
    "SUMMARY",
    "Senior TypeScript engineer with 5+ years building scalable React applications.",
    "",
    "EXPERIENCE",
    "Software Engineer | Acme Corp | Jan 2020 - Present",
    "Built React dashboards used by 10,000 daily active users.",
    "Delivered REST APIs serving 500 req/s with 99.9% uptime.",
    "",
    "Backend Engineer | Beta Co | Feb 2017 - Dec 2019",
    "Architected microservices handling 5M requests per day.",
    "",
    "EDUCATION",
    "B.S. Computer Science — UC San Diego, 2016",
    "",
    "SKILLS",
    "TypeScript, React, Node.js, PostgreSQL, Docker, AWS",
  ].join("\n"),
  tailoredBullets: [],
  diffData: null,
  claimIds: [1, 2],
  fileUrl: null,
  rawContent: null,
  notes: "Mocked resume version for e2e testing.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_COVER_LETTER_VERSION = {
  id: 9002,
  jobId: null,
  label: "AI drafted — 5/13/2026",
  status: "pending_approval",
  claimIds: [1],
  draftContent: [
    "Dear Hiring Manager,",
    "",
    "I am applying for the TypeScript Engineer role at StreamTech.",
    "With 5+ years building scalable React applications and REST APIs, I bring",
    "the TypeScript depth your team needs to ship reliable, maintainable systems.",
    "",
    "I would love to discuss how my background aligns with StreamTech's mission.",
    "",
    "Sincerely,",
    "Jane Doe",
  ].join("\n"),
  annotatedParagraphs: [],
  notes: "Subject: Application for TypeScript Engineer at StreamTech",
  runId: null,
  eventLogId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ─── Route interceptor setup ──────────────────────────────────────────────────

async function mockAiEndpoints(page: Page): Promise<void> {
  await page.route("**/api/jobs/*/tailor", async (route: Route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RESUME_VERSION),
      });
    } else {
      await route.continue();
    }
  });

  await page.route("**/api/jobs/*/cover-letter", async (route: Route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(MOCK_COVER_LETTER_VERSION),
      });
    } else {
      await route.continue();
    }
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByRole("textbox", { name: /username/i }).fill("admin");
  await page.getByRole("textbox", { name: /password/i }).fill("TestPassword123!");
  await page.getByRole("button", { name: /sign in|log in|submit/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
}

/**
 * Fills the intake form and submits, landing on the parse step.
 */
async function fillIntakeAndAdvance(page: Page): Promise<void> {
  await page.goto("/apply-wizard");

  // If the wizard is disabled, the test cannot proceed
  await expect(page.getByText(/apply wizard is disabled/i)).not.toBeVisible({
    timeout: 5_000,
  });

  const titleField = page
    .getByRole("textbox", { name: /job title/i })
    .or(page.locator('input[placeholder*="title" i]'))
    .first();
  await expect(titleField).toBeVisible({ timeout: 5_000 });
  await titleField.fill("TypeScript Engineer");

  const companyField = page
    .getByRole("textbox", { name: /company/i })
    .or(page.locator('input[placeholder*="company" i]'))
    .first();
  await companyField.fill("StreamTech");

  const jdField = page
    .getByRole("textbox", { name: /job description|description|paste/i })
    .or(page.locator("textarea").first())
    .first();
  await jdField.fill(
    "We need a TypeScript Engineer to build React apps and REST APIs. " +
      "Required: 3+ years TypeScript, React, Node.js. " +
      "Responsibilities: build scalable systems, write tests, mentor engineers.",
  );

  const createBtn = page
    .getByRole("button", { name: /create job|continue|next/i })
    .first();
  await createBtn.click();

  await page.waitForTimeout(2_000);
}

/**
 * Advances through parse and role-selection steps to reach the tailor step
 * where both "Generate Resume" and "Generate Cover Letter" buttons live.
 *
 * Strategy: if a Parse Job button is visible, click it and wait. Then click
 * Continue/Next/Skip buttons until "Generate Resume" is visible (max 4 tries).
 * No catch-and-swallow; unexpected failures surface naturally.
 */
async function advanceToTailorStep(page: Page): Promise<void> {
  // Parse step: trigger parsing if the button exists
  const parseBtn = page.getByRole("button", { name: /parse job/i });
  if (await parseBtn.isVisible({ timeout: 3_000 })) {
    await parseBtn.click();
    await page.waitForTimeout(4_000);
  }

  const generateResumeBtn = page.getByRole("button", { name: /generate resume/i });

  for (let i = 0; i < 5; i++) {
    if (await generateResumeBtn.isVisible({ timeout: 1_500 })) break;

    // Click the first enabled Continue / Next / Skip button
    const continueBtn = page
      .getByRole("button", { name: /^(continue|next|skip)$/i })
      .first();
    if (await continueBtn.isVisible({ timeout: 1_000 })) {
      await continueBtn.click();
      await page.waitForTimeout(1_500);
    }
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Apply Wizard — Generate Resume flow (mocked AI endpoint)", () => {
  test.beforeEach(async ({ page }) => {
    await mockAiEndpoints(page);
    await login(page);
  });

  test("Generate Resume shows Resume Draft Preview and not the regeneration error banner", async ({
    page,
  }) => {
    await fillIntakeAndAdvance(page);
    await advanceToTailorStep(page);

    const generateResumeBtn = page.getByRole("button", {
      name: /generate resume/i,
    });
    await expect(generateResumeBtn).toBeVisible({ timeout: 10_000 });

    await generateResumeBtn.click();

    // The error banner must NOT appear (it renders when rawContent is set but
    // tailoredDocumentText is null — i.e. a fallback-validation-failed version)
    await expect(
      page.getByText(/resume must be regenerated before approval/i),
    ).not.toBeVisible({ timeout: 15_000 });

    // A draft preview section MUST be visible
    const draftPreview = page
      .getByText(/resume draft preview/i)
      .or(page.getByText(/resume version/i))
      .or(page.getByText(/tailored resume/i))
      .or(page.getByText(/ai tailored resume/i))
      .first();
    await expect(draftPreview).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Apply Wizard — Generate Cover Letter flow (mocked AI endpoint)", () => {
  test.beforeEach(async ({ page }) => {
    await mockAiEndpoints(page);
    await login(page);
  });

  /**
   * Prerequisite: the dev DB must contain at least one active claim so that
   * the "Generate Cover Letter" button is enabled (it is disabled when
   * activeClaims.length === 0). If this test fails with a disabled-button
   * assertion, seed claims via /claims before running e2e tests.
   */
  test("Generate Cover Letter shows a labelled draft after resume generation", async ({
    page,
  }) => {
    await fillIntakeAndAdvance(page);
    await advanceToTailorStep(page);

    // Step 1: generate the resume (mocked) — required before cover letter
    const generateResumeBtn = page.getByRole("button", {
      name: /generate resume/i,
    });
    await expect(generateResumeBtn).toBeVisible({ timeout: 10_000 });
    await generateResumeBtn.click();

    // Wait for the resume draft to render (mocked endpoint responds immediately)
    const draftPreview = page
      .getByText(/resume draft preview/i)
      .or(page.getByText(/ai tailored resume/i))
      .first();
    await expect(draftPreview).toBeVisible({ timeout: 15_000 });

    // Step 2: generate the cover letter — button must be enabled
    // (If it is disabled, the dev DB is missing active claims — see prerequisite above)
    const generateCLBtn = page.getByRole("button", {
      name: /generate cover letter/i,
    });
    await expect(generateCLBtn).toBeEnabled({ timeout: 10_000 });
    await generateCLBtn.click();

    // A labelled cover letter draft MUST appear
    const clResult = page
      .getByText(/cover letter draft/i)
      .or(page.getByText(/cover letter version/i))
      .or(page.getByText(/ai drafted/i))
      .first();
    await expect(clResult).toBeVisible({ timeout: 15_000 });

    // The page must not be in a broken error state
    await expect(
      page.getByText(/something went wrong|unhandled error/i),
    ).not.toBeVisible();
  });
});
