import { test, expect } from "@playwright/test";
import { randomSuffix } from "./fixtures";

test("create a marketing campaign and see it in the list", async ({ page }) => {
  const name = "Summer Launch " + randomSuffix();

  await page.goto("/dashboard/marketing/new");
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="budget"]', "500");
  await page.getByRole("button", { name: "Create campaign" }).click();
  await page.waitForURL(/\/dashboard\/marketing\/(?!new$)[^/]+$/, { timeout: 45000 });

  await page.goto("/dashboard/marketing");
  await expect(page.getByText(name).first()).toBeVisible();
});
