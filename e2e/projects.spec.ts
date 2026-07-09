import { test, expect } from "@playwright/test";
import { randomSuffix } from "./fixtures";

test("create a project and add a task to it", async ({ page }) => {
  const projectName = "Project " + randomSuffix();
  const taskTitle = "Task " + randomSuffix();

  await page.goto("/dashboard/projects/new");
  await page.fill('input[name="name"]', projectName);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/dashboard\/projects\/(?!new$)[^/]+$/, { timeout: 45000 });

  await page.fill('input[name="title"]', taskTitle);
  await page.getByRole("button", { name: /Add task/i }).click();
  await expect(page.getByText(taskTitle).first()).toBeVisible({ timeout: 45000 });

  await page.goto("/dashboard/projects");
  await expect(page.getByText(projectName).first()).toBeVisible();
});
