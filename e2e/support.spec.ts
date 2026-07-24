import { test, expect } from "@playwright/test";
import { createCustomer, randomSuffix } from "./fixtures";

test("create a support ticket for an existing customer", async ({ page }) => {
  const customerName = "Support Customer " + randomSuffix();
  await createCustomer(page, customerName);

  const subject = "Cannot log in " + randomSuffix();
  await page.goto("/dashboard/support/new");
  await page.selectOption('select[name="customerId"]', { label: customerName });
  await page.fill('input[name="subject"]', subject);
  await page.getByRole("button", { name: "Create ticket" }).click();
  await page.waitForURL(/\/dashboard\/support\/(?!new$)[^/]+$/, { timeout: 45000 });

  await page.goto("/dashboard/support");
  await expect(page.getByText(subject).first()).toBeVisible();
});

test("reply to a ticket and see it in the conversation thread", async ({ page }) => {
  const customerName = "Support Customer " + randomSuffix();
  await createCustomer(page, customerName);

  const subject = "Reply thread check " + randomSuffix();
  const replyText = "Looking into this now " + randomSuffix();

  await page.goto("/dashboard/support/new");
  await page.selectOption('select[name="customerId"]', { label: customerName });
  await page.fill('input[name="subject"]', subject);
  await page.getByRole("button", { name: "Create ticket" }).click();
  await page.waitForURL(/\/dashboard\/support\/(?!new$)[^/]+$/, { timeout: 45000 });

  await page.fill('textarea[name="content"]', replyText);
  await page.getByRole("button", { name: "Reply" }).click();
  await expect(page.getByText(replyText).first()).toBeVisible({ timeout: 45000 });
});
