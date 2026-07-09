import { test, expect } from "@playwright/test";
import { randomSuffix } from "./fixtures";

test("create a supplier and a purchase order", async ({ page }) => {
  const supplierName = "Supplier " + randomSuffix();

  await page.goto("/dashboard/procurement/suppliers");
  await page.fill('input[name="name"]', supplierName);
  await page.getByRole("button", { name: "Add supplier" }).click();
  await expect(page.getByText(supplierName).first()).toBeVisible({ timeout: 45000 });

  await page.goto("/dashboard/procurement/new");
  await page.selectOption('select[name="supplierId"]', { label: supplierName });
  await page.getByRole("button", { name: "Create purchase order" }).click();
  await page.waitForURL(/\/dashboard\/procurement\/(?!new$|suppliers$)[^/]+$/, { timeout: 45000 });

  await page.goto("/dashboard/procurement");
  await expect(page.getByText(supplierName).first()).toBeVisible();
});
