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

test("marking a purchase order Received increments the product's stock", async ({ page }) => {
  const suffix = randomSuffix();
  const supplierName = "StockSync Supplier " + suffix;
  const productName = "StockSync Widget " + suffix;
  const sku = "SKU-" + suffix;

  await page.goto("/dashboard/procurement/suppliers");
  await page.fill('input[name="name"]', supplierName);
  await page.getByRole("button", { name: "Add supplier" }).click();
  await expect(page.getByText(supplierName).first()).toBeVisible({ timeout: 45000 });

  await page.goto("/dashboard/inventory/new");
  await page.fill('input[name="sku"]', sku);
  await page.fill('input[name="name"]', productName);
  await page.fill('input[name="cost"]', "2.00");
  await page.fill('input[name="unitPrice"]', "5.00");
  await page.fill('input[name="stockQty"]', "10");
  await page.getByRole("button", { name: "Create product" }).click();
  await page.waitForURL(/\/dashboard\/inventory\/(?!new$)[^/]+$/, { timeout: 45000 });
  const productUrl = page.url();

  await page.goto("/dashboard/procurement/new");
  await page.selectOption('select[name="supplierId"]', { label: supplierName });
  await page.getByRole("button", { name: "Create purchase order" }).click();
  await page.waitForURL(/\/dashboard\/procurement\/(?!new$|suppliers$)[^/]+$/, { timeout: 45000 });

  await page.selectOption('select[name="productId"]', { label: `${productName} (${sku})` });
  await page.fill('input[name="quantity"]', "25");
  await page.fill('input[name="unitCost"]', "2.00");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("25 ×")).toBeVisible({ timeout: 45000 });

  // This is the fix under regression test: receiving a PO must atomically
  // increment the product's stock by the ordered quantity. It previously
  // did not, and stock silently drifted from what was actually on hand.
  await page.selectOption('select[name="status"]', "RECEIVED");
  await expect(page.getByText("RECEIVED").first()).toBeVisible({ timeout: 45000 });

  await page.goto(productUrl);
  await expect(page.getByText("Stock quantity")).toBeVisible();
  await expect(page.getByText("35", { exact: true })).toBeVisible({ timeout: 45000 });
});
