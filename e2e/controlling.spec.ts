import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { randomSuffix, waitForHydration } from "./fixtures";

test.describe.configure({ mode: "serial", timeout: 240_000 });

const SHOTS = process.env.E2E_SCREENSHOT_DIR;
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

const s = randomSuffix().slice(0, 4).toUpperCase();
const cc = { admin: `A${s}`, sales: `S${s}`, it: `I${s}` };
const today = new Date().toISOString().slice(0, 10);

async function createCostCenter(page: Page, code: string, name: string) {
  await page.goto("/dashboard/controlling/cost-centers");
  await page.fill('input[name="code"]', code);
  await page.fill('input[name="name"]', name);
  await page.getByRole("button", { name: "Create cost center" }).click();
  await page.waitForURL(/\/cost-centers\/[^/?]+/, { timeout: 45000 });
  return page.url().split("?")[0];
}

/** Books an expense in Accounting against a cost object label, e.g. "S1AB Sales". */
async function expense(page: Page, amount: string, costObject: string | null, category = "Travel") {
  await page.goto("/dashboard/accounting/new");
  await waitForHydration(page, 'input[name="category"]');
  await page.selectOption('select[name="type"]', "EXPENSE");
  await page.fill('input[name="amount"]', amount);
  await page.fill('input[name="category"]', category);
  await page.fill('input[name="date"]', today);
  if (costObject) await page.selectOption('select[name="costObject"]', { label: costObject });
  await page.getByRole("button", { name: "Create transaction" }).click();
}

async function applyPreset(page: Page, label: string) {
  await page.goto("/dashboard/controlling/settings");
  await page.locator("form", { hasText: label }).getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Saved.")).toBeVisible({ timeout: 45000 });
}

const urls = { admin: "", sales: "", it: "" };

test("cost centers and a monthly budget", async ({ page }) => {
  urls.admin = await createCostCenter(page, cc.admin, "Administration");
  urls.sales = await createCostCenter(page, cc.sales, "Sales");
  urls.it = await createCostCenter(page, cc.it, "IT");

  await page.goto(urls.sales);
  await page.fill('input[name="fillAll"]', "1000");
  await page.getByRole("button", { name: "Save budget" }).click();
  await expect(page.getByText("Saved.")).toBeVisible({ timeout: 45000 });
  await expect(page.getByText(/plan \$12,000\.00/)).toBeVisible();
});

test("availability control warns by default", async ({ page }) => {
  await expense(page, "600", `${cc.sales} Sales`);
  await page.waitForURL(/\/dashboard\/accounting\/(?!new)[^/?]+$/, { timeout: 45000 });

  await expense(page, "500", `${cc.sales} Sales`);
  await page.waitForURL(/warning=budget/, { timeout: 45000 });
  await expect(page.getByText(`Saved, but this expense puts cost center ${cc.sales} $100.00 over its budget.`)).toBeVisible();
  await shot(page, "co-01-warning");

  await page.goto("/dashboard/controlling");
  await expect(page.getByRole("row", { name: new RegExp(`${cc.sales} Sales`) }).getByText("Over budget")).toBeVisible();
  await expect(page.getByText("by $100.00")).toBeVisible();
  await shot(page, "co-02-overview");
});

test("strict budgets block overspending and require a cost object", async ({ page }) => {
  await applyPreset(page, "Strict budgets");

  await expense(page, "50", `${cc.sales} Sales`);
  await expect(page.getByText(/Blocked by budget control: this would put cost center .* \$150\.00 over budget/)).toBeVisible({ timeout: 45000 });
  await shot(page, "co-03-blocked");

  await expense(page, "50", null);
  await expect(page.getByText("Choose a cost center or internal order for this expense.")).toBeVisible({ timeout: 45000 });
});

test("internal order: budget control, then settlement to a cost center", async ({ page }) => {
  await page.goto("/dashboard/controlling/orders");
  await page.fill('input[name="name"]', "Trade fair");
  await page.fill('input[name="budget"]', "2000");
  await page.selectOption('select[name="settleToId"]', { label: `${cc.admin} Administration` });
  await page.getByRole("button", { name: "Create internal order" }).click();
  await page.waitForURL(/\/orders\/[^/?]+$/, { timeout: 45000 });
  const orderUrl = page.url();
  const orderNumber = (await page.locator("h1 .font-mono").textContent())!.trim();
  expect(orderNumber).toMatch(/^IO\d{4}$/);

  await expense(page, "1500", `${orderNumber} Trade fair`, "Booth rental");
  await page.waitForURL(/\/dashboard\/accounting\/(?!new)[^/?]+$/, { timeout: 45000 });
  await expense(page, "600", `${orderNumber} Trade fair`, "Catering");
  await expect(page.getByText(/Blocked by budget control: this would put internal order .* \$100\.00 over budget \(\$500\.00 still available\)/)).toBeVisible({ timeout: 45000 });

  await page.goto(orderUrl);
  await expect(page.getByText("$500.00")).toBeVisible();
  await page.getByRole("button", { name: "Settle $1,500.00" }).click();
  await expect(page.getByText("Saved.")).toBeVisible({ timeout: 45000 });
  await expect(page.getByText("Settled").first()).toBeVisible();
  await shot(page, "co-04-order-settled");

  await page.goto(urls.admin);
  await expect(page.getByText(`Settlement of ${orderNumber} Trade fair`)).toBeVisible();
});

test("allocation moves IT cost to the departments, and can be reversed", async ({ page }) => {
  await expense(page, "300", `${cc.it} IT`, "Software");
  await page.waitForURL(/\/dashboard\/accounting\/(?!new)[^/?]+$/, { timeout: 45000 });

  await page.goto("/dashboard/controlling/allocations");
  await page.fill('input[name="name"]', "IT costs");
  await page.selectOption('select[name="senderId"]', { label: `${cc.it} IT` });
  await page.selectOption('select[name="receiver0"]', { label: `${cc.admin} Administration` });
  await page.fill('input[name="percent0"]', "60");
  await page.selectOption('select[name="receiver1"]', { label: `${cc.sales} Sales` });
  await page.fill('input[name="percent1"]', "40");
  await page.getByRole("button", { name: "Create cycle" }).click();
  await expect(page.getByText("Saved.")).toBeVisible({ timeout: 45000 });

  await page.getByRole("button", { name: "Run allocation" }).click();
  await expect(page.getByText("$300.00 allocated")).toBeVisible({ timeout: 45000 });
  await shot(page, "co-05-allocation");

  await page.goto(urls.it);
  await expect(page.getByText(/actual \$0\.00/)).toBeVisible();
  await page.goto(urls.sales);
  await expect(page.getByText("$120.00").first()).toBeVisible();

  // Running the same month twice is refused.
  await page.goto("/dashboard/controlling/allocations");
  await page.getByRole("button", { name: "Run allocation" }).click();
  await expect(page.getByText("already run for that month")).toBeVisible({ timeout: 45000 });

  await page.getByRole("button", { name: "Reverse" }).click();
  await expect(page.getByText("$300.00 allocated")).toHaveCount(0, { timeout: 45000 });
  await page.goto(urls.it);
  await expect(page.getByText(/actual \$300\.00/)).toBeVisible();
});

test("profitability and turning Controlling off", async ({ page }) => {
  await page.goto("/dashboard/controlling/profitability");
  await expect(page.getByRole("heading", { name: "By product" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "By customer" })).toBeVisible();

  await page.goto(urls.sales);
  await shot(page, "co-06-cost-center");

  await applyPreset(page, "Turn off");
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Controlling", exact: true })).toHaveCount(0);
  await page.goto("/dashboard/accounting/new");
  await expect(page.locator('select[name="costObject"]')).toHaveCount(0);

  await applyPreset(page, "Flexible");
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Controlling", exact: true }).first()).toBeAttached();
});
