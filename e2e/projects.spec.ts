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

test("set a task's priority and post a comment on it", async ({ page }) => {
  const projectName = "Project " + randomSuffix();
  const taskTitle = "Task " + randomSuffix();
  const commentText = "Comment " + randomSuffix();

  await page.goto("/dashboard/projects/new");
  await page.fill('input[name="name"]', projectName);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/dashboard\/projects\/(?!new$)[^/]+$/, { timeout: 45000 });

  await page.fill('input[name="title"]', taskTitle);
  await page.selectOption('select[name="priority"]', "HIGH");
  await page.getByRole("button", { name: /Add task/i }).click();
  await expect(page.getByText(taskTitle).first()).toBeVisible({ timeout: 45000 });
  await expect(page.getByText("HIGH").first()).toBeVisible();

  await page.getByRole("link", { name: taskTitle }).click();
  await page.waitForURL(/\/dashboard\/projects\/[^/]+\/tasks\/[^/]+$/, { timeout: 45000 });

  await page.fill('textarea[name="content"]', commentText);
  await page.getByRole("button", { name: "Post" }).click();
  await expect(page.getByText(commentText).first()).toBeVisible({ timeout: 45000 });
});
