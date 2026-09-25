import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { createCustomer, randomSuffix, selectAndSave } from "./fixtures";

// Every test here shares one company and changes its planning settings,
// so they have to run one after another.
test.describe.configure({ mode: "serial", timeout: 240_000 });

const SHOTS = process.env.E2E_SCREENSHOT_DIR;
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

async function applyPreset(page: Page, label: string) {
  await page.goto("/dashboard/mrp/settings");
  await page.locator("form", { hasText: label }).getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Saved.")).toBeVisible({ timeout: 45000 });
}

async function createProduct(page: Page, name: string, sku: string, stock: number, cost: string) {
  await page.goto("/dashboard/inventory/new");
  await page.fill('input[name="sku"]', sku);
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="cost"]', cost);
  await page.fill('input[name="unitPrice"]', "100.00");
  await page.fill('input[name="stockQty"]', String(stock));
  await page.fill('input[name="reorderLevel"]', "0");
  await page.getByRole("button", { name: "Create product" }).click();
  await page.waitForURL(/\/dashboard\/inventory\/(?!new$)[^/]+$/, { timeout: 45000 });
  return page.url();
}

async function addComponent(page: Page, productUrl: string, componentLabel: string, qty: string) {
  await page.goto(productUrl);
  await page.selectOption('select[name="componentId"]', { label: componentLabel });
  await page.fill('input[placeholder="Qty per unit"]', qty);
  await page.getByRole("button", { name: "Add component" }).click();
}

/** Value in the Plan column for a product on the Planning page. */
async function planned(page: Page, productName: string) {
  const row = page.locator("tbody tr", { hasText: productName });
  return Number(await row.locator("td").nth(7).textContent());
}

async function stockOf(page: Page, productUrl: string) {
  await page.goto(productUrl);
  return Number(await page.getByText("Stock quantity").locator("xpath=following-sibling::p[1]").textContent());
}

async function changeStatus(page: Page, button: string, expected: string) {
  await page.getByRole("button", { name: button, exact: true }).click();
  await expect(page.getByText(expected).first()).toBeVisible({ timeout: 45000 });
}

const s = randomSuffix();
const names = { bike: `Bike ${s}`, wheel: `Wheel ${s}`, spoke: `Spoke ${s}` };
const skus = { bike: `BK${s}`, wheel: `WH${s}`, spoke: `SP${s}` };
const supplierName = `Spoke Supplier ${s}`;
const urls: Record<keyof typeof names, string> = { bike: "", wheel: "", spoke: "" };

test("planning templates fill in the settings", async ({ page }) => {
  await applyPreset(page, "Make to order");
  await expect(page.locator('input[name="includePendingOrders"]')).toBeChecked();
  await expect(page.locator('input[name="useSafetyStock"]')).not.toBeChecked();
  await shot(page, "mrp-01-settings");
});

test("bills of materials, with loops blocked", async ({ page }) => {
  await page.goto("/dashboard/procurement/suppliers");
  await page.fill('input[name="name"]', supplierName);
  await page.getByRole("button", { name: "Add supplier" }).click();
  await expect(page.getByText(supplierName).first()).toBeVisible({ timeout: 45000 });

  urls.spoke = await createProduct(page, names.spoke, skus.spoke, 10, "0.50");
  urls.wheel = await createProduct(page, names.wheel, skus.wheel, 2, "5.00");
  urls.bike = await createProduct(page, names.bike, skus.bike, 0, "40.00");

  await addComponent(page, urls.bike, `${names.wheel} (${skus.wheel})`, "2");
  await expect(page.getByText("Made in house")).toBeVisible({ timeout: 45000 });
  await addComponent(page, urls.wheel, `${names.spoke} (${skus.spoke})`, "32");
  await expect(page.getByText("32 per unit")).toBeVisible({ timeout: 45000 });

  // Spoke inside Wheel inside Bike: Spoke can't also contain Bike.
  await addComponent(page, urls.spoke, `${names.bike} (${skus.bike})`, "1");
  await expect(page.getByText("would create a loop")).toBeVisible({ timeout: 45000 });

  // Spokes are bought in boxes of 100 from one supplier, 5 days away.
  await page.goto(urls.spoke);
  await page.fill('input[name="leadTimeDays"]', "5");
  await page.fill('input[name="lotSize"]', "100");
  await page.selectOption('select[name="preferredSupplierId"]', { label: supplierName });
  await page.getByRole("button", { name: "Save planning" }).click();
  await expect(page.getByText("Saved.")).toBeVisible({ timeout: 45000 });

  await page.goto(urls.bike);
  await expect(page.getByText("Component cost per unit: $10.00")).toBeVisible();
  await shot(page, "mrp-02-bike-bom");
});

test("planning run explodes demand through every level", async ({ page }) => {
  const customer = "Bike Customer " + s;
  await createCustomer(page, customer);
  await page.goto("/dashboard/sales/new");
  await page.selectOption('select[name="customerId"]', { label: customer });
  await page.getByRole("button", { name: "Create order" }).click();
  await page.waitForURL(/\/dashboard\/sales\/(?!new$)[^/]+$/, { timeout: 45000 });
  const bikeOption = page.locator('select[name="productId"] option', { hasText: `${names.bike} (${skus.bike})` });
  await page.selectOption('select[name="productId"]', (await bikeOption.getAttribute("value"))!);
  await page.fill('input[name="quantity"]', "3");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("3 ×")).toBeVisible({ timeout: 45000 });
  // Left as pending on purpose: the Make to order template counts it.

  await page.goto("/dashboard/mrp");
  // 3 bikes, none in stock: make 3.
  expect(await planned(page, names.bike)).toBe(3);
  // 3 bikes need 6 wheels, 2 in stock: make 4.
  expect(await planned(page, names.wheel)).toBe(4);
  // 4 wheels need 128 spokes, 10 in stock: 118 short, boxes of 100 means 200.
  expect(await planned(page, names.spoke)).toBe(200);
  await shot(page, "mrp-03-planning-run");
});

test("buy suggestions become purchase orders; make suggestions become work orders", async ({ page }) => {
  await page.goto("/dashboard/mrp");
  await page.getByRole("button", { name: `Order from ${supplierName}` }).click();
  await page.waitForURL(/\/dashboard\/procurement\/(?!new$|suppliers$)[^/]+$/, { timeout: 45000 });
  await expect(page.getByText("200 ×")).toBeVisible();
  const poUrl = page.url();
  await shot(page, "mrp-04-purchase-order");

  // The draft now counts as on order, so spokes drop off the suggestions.
  await page.goto("/dashboard/mrp");
  await expect(page.locator("tbody tr", { hasText: names.spoke })).toHaveCount(0);

  await page.locator("tbody tr", { hasText: names.wheel }).getByRole("button", { name: "Create work order" }).click();
  await page.waitForURL(/\/dashboard\/mrp\/work-orders\/(?!new$)[^/]+$/, { timeout: 45000 });
  await expect(page.getByRole("heading", { name: /^WO\d{4,}$/ })).toBeVisible();
  await expect(page.getByText("Some components are short")).toBeVisible();
  const wheelWo = page.url();

  // Can't finish without the spokes.
  await changeStatus(page, "Start", "In progress");
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(page.getByText("Not enough components in stock")).toBeVisible({ timeout: 45000 });
  await shot(page, "mrp-05-work-order-short");

  // Receive the spokes, then the wheels can be built.
  await page.goto(poUrl);
  await selectAndSave(page, 'select[name="status"]', "RECEIVED");
  expect(await stockOf(page, urls.spoke)).toBe(210);

  await page.goto(wheelWo);
  await expect(page.getByText("All components in stock")).toBeVisible();
  await changeStatus(page, "Complete", "Completed");
  await shot(page, "mrp-06-work-order-completed");
  expect(await stockOf(page, urls.wheel)).toBe(6);
  expect(await stockOf(page, urls.spoke)).toBe(82);

  // Wheels are covered now; only the bikes are left to make.
  await page.goto("/dashboard/mrp");
  await expect(page.locator("tbody tr", { hasText: names.wheel })).toHaveCount(0);
  await page.locator("tbody tr", { hasText: names.bike }).getByRole("button", { name: "Create work order" }).click();
  await page.waitForURL(/\/dashboard\/mrp\/work-orders\/(?!new$)[^/]+$/, { timeout: 45000 });
  await changeStatus(page, "Start", "In progress");
  await changeStatus(page, "Complete", "Completed");
  expect(await stockOf(page, urls.bike)).toBe(3);
  expect(await stockOf(page, urls.wheel)).toBe(0);

  await page.goto("/dashboard/mrp");
  await expect(page.getByText("Nothing to buy or make")).toBeVisible();
  await page.goto("/dashboard/mrp/work-orders");
  await shot(page, "mrp-07-work-orders");
});

test("services only template hides planning", async ({ page }) => {
  await applyPreset(page, "Services only");
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Planning", exact: true })).toHaveCount(0);
  await page.goto(urls.bike);
  await expect(page.getByText("Bill of materials")).toHaveCount(0);

  await applyPreset(page, "Make to stock");
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Planning", exact: true }).first()).toBeAttached();
});
