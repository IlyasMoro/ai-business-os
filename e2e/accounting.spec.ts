import { test, expect } from "@playwright/test";
import { randomSuffix } from "./fixtures";

test("create a transaction linked to a project and see it in the list", async ({ page }) => {
  const projectName = "Accounting Project " + randomSuffix();
  const category = "Consulting " + randomSuffix();

  await page.goto("/dashboard/projects/new");
  await page.fill('input[name="name"]', projectName);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/dashboard\/projects\/(?!new$)[^/]+$/, { timeout: 45000 });

  await page.goto("/dashboard/accounting/new");
  await page.selectOption('select[name="type"]', "INCOME");
  await page.fill('input[name="amount"]', "1500");
  await page.fill('input[name="category"]', category);
  await page.selectOption('select[name="projectId"]', { label: projectName });
  await page.getByRole("button", { name: "Create transaction" }).click();
  await page.waitForURL(/\/dashboard\/accounting\/(?!new$)[^/]+$/, { timeout: 45000 });

  await page.goto("/dashboard/accounting");
  await expect(page.getByText(category).first()).toBeVisible();

  // The transaction's project link should feed the project's profitability view.
  await page.goto("/dashboard/projects");
  await page.getByRole("link", { name: projectName }).click();
  await page.waitForURL(/\/dashboard\/projects\/[^/]+$/, { timeout: 45000 });
  await expect(page.getByText("Profitability")).toBeVisible({ timeout: 45000 });
  await expect(page.getByText("$1500.00").first()).toBeVisible();
});
