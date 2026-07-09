import { test, expect } from "@playwright/test";
import { createCustomer, randomSuffix } from "./fixtures";

test("create an invoice for an existing customer", async ({ page }) => {
  const customerName = "Invoice Customer " + randomSuffix();
  await createCustomer(page, customerName);

  await page.goto("/dashboard/invoicing/new");
  await page.selectOption('select[name="customerId"]', { label: customerName });
  await page.getByRole("button", { name: "Create invoice" }).click();
  await page.waitForURL(/\/dashboard\/invoicing\/(?!new$)[^/]+$/, { timeout: 45000 });

  await page.goto("/dashboard/invoicing");
  await expect(page.getByText(customerName).first()).toBeVisible();
});
