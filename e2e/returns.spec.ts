import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { createCustomer, randomSuffix } from "./fixtures";

// Every test here shares one company and changes its return policy, so
// they have to run one after another.
test.describe.configure({ mode: "serial", timeout: 180_000 });

const SHOTS = process.env.E2E_SCREENSHOT_DIR;
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

async function applyPreset(page: Page, label: string) {
  await page.goto("/dashboard/returns/policy");
  await page.locator("form", { hasText: label }).getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Saved.")).toBeVisible({ timeout: 45000 });
}

/** Creates a product, sells `qty` of it and fulfils the order. Returns the product and order URLs. */
async function sellAndFulfil(page: Page, qty: number) {
  const suffix = randomSuffix();
  const customerName = "Returns Customer " + suffix;
  const productName = "Returns Widget " + suffix;
  const sku = "RW" + suffix;

  await createCustomer(page, customerName);

  await page.goto("/dashboard/inventory/new");
  await page.fill('input[name="sku"]', sku);
  await page.fill('input[name="name"]', productName);
  await page.fill('input[name="cost"]', "8.00");
  await page.fill('input[name="unitPrice"]', "20.00");
  await page.fill('input[name="stockQty"]', "10");
  await page.getByRole("button", { name: "Create product" }).click();
  await page.waitForURL(/\/dashboard\/inventory\/(?!new$)[^/]+$/, { timeout: 45000 });
  const productUrl = page.url();

  await page.goto("/dashboard/sales/new");
  await page.selectOption('select[name="customerId"]', { label: customerName });
  await page.getByRole("button", { name: "Create order" }).click();
  await page.waitForURL(/\/dashboard\/sales\/(?!new$)[^/]+$/, { timeout: 45000 });
  const orderUrl = page.url();

  const productOption = page.locator('select[name="productId"] option', { hasText: `${productName} (${sku})` });
  await page.selectOption('select[name="productId"]', (await productOption.getAttribute("value"))!);
  await page.fill('input[name="quantity"]', String(qty));
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText(`${qty} ×`)).toBeVisible({ timeout: 45000 });

  // Each status change is a server action; wait for it to land before the
  // next one, or the second change is dropped while the select is disabled.
  for (const status of ["CONFIRMED", "FULFILLED"]) {
    const done = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/dashboard/sales/"));
    await page.selectOption('select[name="status"]', status);
    await done;
    await expect(page.locator('select[name="status"]')).toBeEnabled();
  }
  await page.reload();
  await expect(page.locator('select[name="status"]')).toHaveValue("FULFILLED");

  return { productUrl, orderUrl, customerName };
}

async function stockOf(page: Page, productUrl: string) {
  await page.goto(productUrl);
  const value = page.getByText("Stock quantity").locator("xpath=following-sibling::p[1]");
  return Number(await value.textContent());
}

test("status labels render as readable pills", async ({ page }) => {
  await sellAndFulfil(page, 1);
  await page.goto("/dashboard/sales");
  const table = page.locator("table");
  await expect(table.getByText("Fulfilled").first()).toBeVisible();
  await expect(table.getByText("FULFILLED", { exact: true })).toHaveCount(0);
  await shot(page, "01-sales-status-pills");
});

test("return policy templates fill in the policy", async ({ page }) => {
  await applyPreset(page, "Electronics");
  await expect(page.locator('input[name="windowDays"]')).toHaveValue("14");
  await expect(page.locator('input[name="restockingFeePercent"]')).toHaveValue("15");
  await expect(page.locator('input[name="requireApproval"]')).toBeChecked();
  await shot(page, "02-return-policy-electronics");
});

test("full RMA lifecycle: request, approve, receive, refund", async ({ page }) => {
  const { productUrl, orderUrl } = await sellAndFulfil(page, 5);
  expect(await stockOf(page, productUrl)).toBe(5);

  // The order page offers a return and shows the deadline.
  await page.goto(orderUrl);
  await expect(page.getByText(/Returnable until/)).toBeVisible();
  await shot(page, "03-order-returns-card");
  await page.getByRole("link", { name: "Create return" }).click();
  await page.waitForURL(/\/dashboard\/returns\/new\?orderId=/);
  await page.selectOption('select[name="reason"]', "Faulty or not working");
  await page.fill('textarea[name="notes"]', "Customer says it will not power on.");
  await shot(page, "04-new-return-form");
  await page.getByRole("button", { name: "Create return" }).click();
  await page.waitForURL(/\/dashboard\/returns\/(?!new$|policy$)[^/?]+$/, { timeout: 45000 });

  // Numbered without a hyphen, waiting for approval under the Electronics policy.
  await expect(page.getByRole("heading", { name: /^RMA\d{4,}$/ })).toBeVisible();
  await expect(page.getByText("Requested").first()).toBeVisible();

  // Moving forward with no items is blocked.
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Add at least one item")).toBeVisible({ timeout: 45000 });

  // Two resellable, one damaged.
  const itemSelect = page.locator('select[name="orderItemId"]');
  await itemSelect.selectOption({ index: 1 });
  await page.fill('input[name="quantity"]', "2");
  await page.selectOption('select[name="condition"]', "RESELLABLE");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("2 × $20.00")).toBeVisible({ timeout: 45000 });

  await itemSelect.selectOption({ index: 1 });
  await page.fill('input[name="quantity"]', "1");
  await page.selectOption('select[name="condition"]', "DAMAGED");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("1 × $20.00")).toBeVisible({ timeout: 45000 });

  // Only 2 of the 5 sold units are left to return.
  await itemSelect.selectOption({ index: 1 });
  await page.fill('input[name="quantity"]', "3");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("more than can still be returned")).toBeVisible({ timeout: 45000 });

  // 3 × $20 = $60, less the 15% fee = $51.
  await expect(page.getByText("Subtotal: $60.00")).toBeVisible();
  await expect(page.getByText("Restocking fee (15%): $9.00")).toBeVisible();
  await expect(page.getByText("Refund: $51.00")).toBeVisible();
  await shot(page, "05-return-items-and-refund");

  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("button", { name: "Mark received" })).toBeVisible({ timeout: 45000 });
  await page.getByRole("button", { name: "Mark received" }).click();
  await expect(page.getByRole("button", { name: "Issue refund" })).toBeVisible({ timeout: 45000 });
  // Items are locked once the goods are back.
  await expect(page.locator('select[name="orderItemId"]')).toHaveCount(0);
  const returnUrl = page.url();

  // Only the 2 resellable units went back on the shelf.
  expect(await stockOf(page, productUrl)).toBe(7);

  await page.goto(returnUrl);
  await page.getByRole("button", { name: "Issue refund" }).click();
  await expect(page.getByText("Refunded").first()).toBeVisible({ timeout: 45000 });
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await shot(page, "06-return-refunded");

  await page.goto("/dashboard/accounting");
  await expect(page.getByText("Refunds").first()).toBeVisible();
  await shot(page, "07-accounting-refund-expense");

  await page.goto("/dashboard/returns");
  await expect(page.getByText("$51").first()).toBeVisible();
  await shot(page, "08-returns-list");
});

test("retail template skips approval", async ({ page }) => {
  await applyPreset(page, "Retail store");
  const { orderUrl } = await sellAndFulfil(page, 1);
  await page.goto(orderUrl);
  await page.getByRole("link", { name: "Create return" }).click();
  await page.selectOption('select[name="reason"]', "Changed my mind");
  await page.getByRole("button", { name: "Create return" }).click();
  await page.waitForURL(/\/dashboard\/returns\/(?!new$|policy$)[^/?]+$/, { timeout: 45000 });
  await expect(page.getByText("Approved").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark received" })).toBeVisible();
});

test("services only template hides returns entirely", async ({ page }) => {
  await applyPreset(page, "Services only");
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Returns", exact: true })).toHaveCount(0);
  await shot(page, "09-services-only-no-returns-nav");

  await page.goto("/dashboard/returns/new");
  await expect(page.getByText("Returns are turned off").first()).toBeVisible({ timeout: 45000 });

  await applyPreset(page, "Retail store");
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Returns", exact: true }).first()).toBeAttached();
});
