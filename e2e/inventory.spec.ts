import { test, expect } from "@playwright/test";
import { randomSuffix } from "./fixtures";

test("create an inventory product and see it in the list", async ({ page }) => {
  const suffix = randomSuffix();
  const name = "Widget " + suffix;

  await page.goto("/dashboard/inventory/new");
  await page.fill('input[name="sku"]', "SKU-" + suffix);
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="cost"]', "5.50");
  await page.fill('input[name="unitPrice"]', "12.99");
  await page.fill('input[name="stockQty"]', "20");
  await page.getByRole("button", { name: "Create product" }).click();
  await page.waitForURL(/\/dashboard\/inventory\/(?!new$)[^/]+$/, { timeout: 45000 });

  await page.goto("/dashboard/inventory");
  await expect(page.getByRole("link", { name })).toBeVisible();
});
