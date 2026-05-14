import { test, expect } from "@playwright/test";

// TODO unskip once Agent A's GET /ai-pipeline/overview is live
test.skip("edit agent role personality and verify it persists", async ({ page }) => {
  await page.goto("/pipeline-diagram");
  await page.getByRole("button", { name: /resume_tailoring/i }).click();
  await page.getByRole("tab", { name: "Role" }).click();

  const personalityField = page.getByLabel("Personality");
  const newText = `Test personality ${Date.now()}`;
  await personalityField.fill(newText);
  await page.getByRole("button", { name: /save/i }).click();
  await expect(page.getByText(/saved|updated/i)).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /resume_tailoring/i }).click();
  await page.getByRole("tab", { name: "Role" }).click();
  await expect(personalityField).toHaveValue(newText);
});
