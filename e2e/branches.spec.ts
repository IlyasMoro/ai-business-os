import { test, expect, type Page } from "@playwright/test";
import { createCustomer, randomSuffix, waitForHydration } from "./fixtures";

async function switchBranch(page: Page, label: string) {
  const trigger = page.locator('header button[aria-haspopup="listbox"]');
  await waitForHydration(page, 'header button[aria-haspopup="listbox"]');
  await trigger.click();
  await page.getByRole("listbox", { name: "Choose a branch" }).getByRole("button", { name: label }).click();
  await expect(trigger).toContainText(label);
}

test("orders belong to a branch and the switcher filters by it", async ({ page }) => {
  // Runs in the shared suite company. Other specs keep working once it has
  // two branches: their forms default to the main branch.
  const code = "N" + randomSuffix().slice(0, 4).toUpperCase();
  await page.goto("/dashboard/branches");
  // Each existing branch has a collapsed edit form with the same fields.
  const createForm = page.locator('form:has(button:has-text("Create branch"))');
  await createForm.locator('input[name="code"]').fill(code);
  await createForm.locator('input[name="name"]').fill("North " + code);
  await createForm.getByRole("button", { name: "Create branch" }).click();
  await page.waitForURL(/saved=1/);

  const northCustomer = "North Buyer " + randomSuffix();
  const mainCustomer = "Main Buyer " + randomSuffix();
  await createCustomer(page, northCustomer);
  await createCustomer(page, mainCustomer);

  // With "All branches" in view, the form defaults to Main; pick North.
  await page.goto("/dashboard/sales/new");
  await page.selectOption('select[name="customerId"]', { label: northCustomer });
  await page.selectOption('select[name="branchId"]', { label: `North ${code} (${code})` });
  await page.getByRole("button", { name: "Create order" }).click();
  await page.waitForURL(/\/dashboard\/sales\/(?!new$)[^/]+$/, { timeout: 45000 });

  await page.goto("/dashboard/sales/new");
  await page.selectOption('select[name="customerId"]', { label: mainCustomer });
  await page.getByRole("button", { name: "Create order" }).click();
  await page.waitForURL(/\/dashboard\/sales\/(?!new$)[^/]+$/, { timeout: 45000 });

  await page.goto("/dashboard/sales");
  await expect(page.getByText(northCustomer).first()).toBeVisible();
  await expect(page.getByText(mainCustomer).first()).toBeVisible();

  await switchBranch(page, `North ${code}`);
  await page.goto("/dashboard/sales");
  await expect(page.getByText(northCustomer).first()).toBeVisible();
  await expect(page.getByText(mainCustomer)).toHaveCount(0);

  // New records follow the branch in view.
  await page.goto("/dashboard/sales/new");
  await expect(page.locator('select[name="branchId"]')).toHaveValue(
    await page.locator(`select[name="branchId"] option:has-text("(${code})")`).getAttribute("value") ?? ""
  );

  await switchBranch(page, "Main branch");
  await page.goto("/dashboard/sales");
  await expect(page.getByText(mainCustomer).first()).toBeVisible();
  await expect(page.getByText(northCustomer)).toHaveCount(0);
});
