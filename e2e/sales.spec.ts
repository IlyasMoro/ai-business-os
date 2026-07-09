import { test, expect } from "@playwright/test";
import { createCustomer, randomSuffix } from "./fixtures";

test("create a sales order for an existing customer", async ({ page }) => {
  const customerName = "Sales Customer " + randomSuffix();
  await createCustomer(page, customerName);

  await page.goto("/dashboard/sales/new");
  await page.selectOption('select[name="customerId"]', { label: customerName });
  await page.getByRole("button", { name: "Create order" }).click();
  await page.waitForURL(/\/dashboard\/sales\/(?!new$)[^/]+$/, { timeout: 45000 });

  await page.goto("/dashboard/sales");
  await expect(page.getByText(customerName).first()).toBeVisible();
});
