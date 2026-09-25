import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { createCustomer, randomSuffix, selectAndSave, waitForHydration } from "./fixtures";

test.describe.configure({ mode: "serial", timeout: 240_000 });

const SHOTS = process.env.E2E_SCREENSHOT_DIR;
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

const s = randomSuffix().toUpperCase();
const supplier = `Dairy Supplier ${s}`;
const customer = `Grocer ${s}`;
const milk = { name: `Milk ${s}`, sku: `MLK${s}` };
const router = { name: `Router ${s}`, sku: `RTR${s}` };
const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);
const urls = { milk: "", router: "" };

async function createProduct(page: Page, p: { name: string; sku: string }) {
  await page.goto("/dashboard/inventory/new");
  await page.fill('input[name="sku"]', p.sku);
  await page.fill('input[name="name"]', p.name);
  await page.fill('input[name="cost"]', "1.00");
  await page.fill('input[name="unitPrice"]', "2.00");
  await page.fill('input[name="stockQty"]', "0");
  await page.getByRole("button", { name: "Create product" }).click();
  await page.waitForURL(/\/dashboard\/inventory\/(?!new$)[^/?]+$/, { timeout: 45000 });
  return page.url();
}

async function setTracking(page: Page, url: string, mode: "LOT" | "SERIAL", expiry: boolean) {
  await page.goto(url);
  await page.selectOption('select[name="trackingMode"]', mode);
  if (expiry) await page.locator('input[name="tracksExpiry"]').check({ force: true });
  await page.getByRole("button", { name: "Save tracking" }).click();
  await expect(page.getByText("Saved.")).toBeVisible({ timeout: 45000 });
}

/** Creates a purchase order for one product and returns its URL. */
async function purchase(page: Page, p: { name: string; sku: string }, qty: number) {
  await page.goto("/dashboard/procurement/new");
  await page.selectOption('select[name="supplierId"]', { label: supplier });
  await page.getByRole("button", { name: "Create purchase order" }).click();
  await page.waitForURL(/\/dashboard\/procurement\/(?!new$|suppliers$)[^/]+$/, { timeout: 45000 });
  const option = page.locator('select[name="productId"] option', { hasText: p.sku });
  await page.selectOption('select[name="productId"]', (await option.getAttribute("value"))!);
  await page.fill('input[name="quantity"]', String(qty));
  await page.fill('input[name="unitCost"]', "1.00");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText(`${qty} ×`)).toBeVisible({ timeout: 45000 });
  return page.url();
}

/** Creates a sales order for `qty` milk, confirms it and tries to fulfil it. */
async function sell(page: Page, qty: number) {
  await page.goto("/dashboard/sales/new");
  await page.selectOption('select[name="customerId"]', { label: customer });
  await page.getByRole("button", { name: "Create order" }).click();
  await page.waitForURL(/\/dashboard\/sales\/(?!new$)[^/]+$/, { timeout: 45000 });
  const option = page.locator('select[name="productId"] option', { hasText: milk.sku });
  await page.selectOption('select[name="productId"]', (await option.getAttribute("value"))!);
  await page.fill('input[name="quantity"]', String(qty));
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText(`${qty} ×`)).toBeVisible({ timeout: 45000 });
  await selectAndSave(page, 'select[name="status"]', "CONFIRMED");
  await selectAndSave(page, 'select[name="status"]', "FULFILLED");
}

test("setup: food template, supplier, customer and a lot tracked product", async ({ page }) => {
  await page.goto("/dashboard/inventory/settings");
  await page.locator("form", { hasText: "Food and pharmacy" }).getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Saved.")).toBeVisible({ timeout: 45000 });
  await expect(page.locator('select[name="pickingRule"]')).toHaveValue("FEFO");

  await page.goto("/dashboard/procurement/suppliers");
  await page.fill('input[name="name"]', supplier);
  await page.getByRole("button", { name: "Add supplier" }).click();
  await expect(page.getByText(supplier).first()).toBeVisible({ timeout: 45000 });
  await createCustomer(page, customer);

  urls.milk = await createProduct(page, milk);
  await setTracking(page, urls.milk, "LOT", true);
});

test("receiving needs lot numbers and expiry dates", async ({ page }) => {
  const oldPo = await purchase(page, milk, 5);
  // The quick status change refuses: lots are required.
  await selectAndSave(page, 'select[name="status"]', "RECEIVED").catch(() => undefined);
  await page.waitForURL(/\/receive/, { timeout: 45000 });
  await expect(page.getByText("Enter their lot numbers or serials to receive it.")).toBeVisible();
  await page.fill('input[name^="lot_"]', `OLD${s}`);
  await page.fill('input[name^="expiry_"]', iso(-1));
  await page.getByRole("button", { name: "Receive into stock" }).click();
  await page.waitForURL(new RegExp(`${oldPo.split("/").pop()}$`), { timeout: 45000 });

  const newPo = await purchase(page, milk, 5);
  await page.goto(`${newPo}/receive`);
  await waitForHydration(page, 'input[name^="lot_"]');
  await page.fill('input[name^="lot_"]', `NEW${s}`);
  await page.fill('input[name^="expiry_"]', iso(60));
  await page.getByRole("button", { name: "Receive into stock" }).click();
  await page.waitForURL(new RegExp(`${newPo.split("/").pop()}$`), { timeout: 45000 });

  await page.goto(urls.milk);
  await expect(page.getByText(`OLD${s}`)).toBeVisible();
  await expect(page.getByText("Expired").first()).toBeVisible();
  await shot(page, "lot-01-lots-on-hand");
});

test("shipping skips expired lots, and says so when only expired stock is left", async ({ page }) => {
  await sell(page, 3);
  await page.reload();
  await expect(page.getByText(`Shipped from NEW${s} (3)`)).toBeVisible({ timeout: 45000 });
  await shot(page, "lot-02-shipped-from-lot");

  await sell(page, 5);
  await expect(page.getByText(/Cannot fulfil: Not enough usable lots for .*: 3 short\. Expired lots can't be shipped\./)).toBeVisible({ timeout: 45000 });
});

test("trace a lot to the customer who received it", async ({ page }) => {
  await page.goto(`/dashboard/inventory/trace?q=NEW${s}`);
  await expect(page.getByText("Customers who received it:")).toBeVisible();
  await expect(page.getByRole("link", { name: customer }).first()).toBeVisible();
  await expect(page.getByText(/Received from/)).toBeVisible();
  await shot(page, "lot-03-trace");

  await page.goto("/dashboard/inventory/trace");
  await expect(page.getByRole("row", { name: new RegExp(`OLD${s}`) }).getByText("Expired")).toBeVisible();
});

test("serial numbers, one per unit", async ({ page }) => {
  urls.router = await createProduct(page, router);
  await setTracking(page, urls.router, "SERIAL", false);
  const po = await purchase(page, router, 2);

  await page.goto(`${po}/receive`);
  await waitForHydration(page, 'textarea[name^="serials_"]');
  await page.fill('textarea[name^="serials_"]', `SN1${s}`);
  await page.getByRole("button", { name: "Receive into stock" }).click();
  await expect(page.getByText(/Enter exactly 2 serial numbers/)).toBeVisible({ timeout: 45000 });

  await waitForHydration(page, 'textarea[name^="serials_"]');
  await page.fill('textarea[name^="serials_"]', `SN1${s}\nSN2${s}`);
  await page.getByRole("button", { name: "Receive into stock" }).click();
  await page.waitForURL(new RegExp(`${po.split("/").pop()}$`), { timeout: 45000 });

  await page.goto(urls.router);
  await expect(page.getByText("Serials on hand")).toBeVisible();
  await expect(page.getByText(`SN2${s}`)).toBeVisible();
  await shot(page, "lot-04-serials");
});
