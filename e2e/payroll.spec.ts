import { test, expect } from "@playwright/test";

test("create a payroll run", async ({ page }) => {
  await page.goto("/dashboard/payroll/new");
  await page.getByRole("button", { name: "Create payroll run" }).click();
  await page.waitForURL(/\/dashboard\/payroll\/(?!new$)[^/]+$/, { timeout: 45000 });

  await page.goto("/dashboard/payroll");
  await expect(page.getByText("No payroll runs yet")).not.toBeVisible();
});
