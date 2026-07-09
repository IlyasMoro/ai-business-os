import { test, expect } from "@playwright/test";
import { randomSuffix } from "./fixtures";

test("create an HR employee and see it in the list", async ({ page }) => {
  const name = "Employee " + randomSuffix();

  await page.goto("/dashboard/hr/new");
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="salary"]', "55000");
  await page.getByRole("button", { name: "Create employee" }).click();
  await page.waitForURL(/\/dashboard\/hr\/(?!new$)[^/]+$/, { timeout: 45000 });

  await page.goto("/dashboard/hr");
  await expect(page.getByText(name).first()).toBeVisible();
});
