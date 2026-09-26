import { test, expect, type Page } from "@playwright/test";
import { createCustomer, randomSuffix, selectAndSave, waitForHydration } from "./fixtures";

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

test("stock is kept per branch and orders ship from their own branch", async ({ page }) => {
  const suffix = randomSuffix();
  const code = "S" + suffix.slice(0, 4).toUpperCase();
  const branchName = "South " + code;
  const productName = "Branch Widget " + suffix;
  const sku = "BW" + suffix;
  const customerName = "South Buyer " + suffix;

  await page.goto("/dashboard/branches");
  const createForm = page.locator('form:has(button:has-text("Create branch"))');
  await createForm.locator('input[name="code"]').fill(code);
  await createForm.locator('input[name="name"]').fill(branchName);
  await createForm.getByRole("button", { name: "Create branch" }).click();
  await page.waitForURL(/saved=1/);

  // Opening stock lands at the main branch (the form's default).
  await page.goto("/dashboard/inventory/new");
  await page.fill('input[name="sku"]', sku);
  await page.fill('input[name="name"]', productName);
  await page.fill('input[name="cost"]', "5.00");
  await page.fill('input[name="unitPrice"]', "12.00");
  await page.fill('input[name="stockQty"]', "10");
  await page.getByRole("button", { name: "Create product" }).click();
  await page.waitForURL(/\/dashboard\/inventory\/(?!new$)[^/]+$/, { timeout: 45000 });
  const productUrl = page.url();

  await createCustomer(page, customerName);
  await page.goto("/dashboard/sales/new");
  await page.selectOption('select[name="customerId"]', { label: customerName });
  await page.selectOption('select[name="branchId"]', { label: `${branchName} (${code})` });
  await page.getByRole("button", { name: "Create order" }).click();
  await page.waitForURL(/\/dashboard\/sales\/(?!new$)[^/]+$/, { timeout: 45000 });
  const orderUrl = page.url();

  // The picker counts stock at the order's branch, which has none yet.
  const option = page.locator('select[name="productId"] option', { hasText: `${productName} (${sku})` });
  await expect(option).toContainText("0 in stock");
  await page.selectOption('select[name="productId"]', (await option.getAttribute("value"))!);
  await page.fill('input[name="quantity"]', "4");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("4 ×")).toBeVisible({ timeout: 45000 });

  // Main's 10 units don't count for a South order.
  await selectAndSave(page, 'select[name="status"]', "CONFIRMED");
  await expect(page.getByText(`0 at ${branchName}, 10 more at other branches, 4 requested`)).toBeVisible();

  // A stock take at South, made with South in view.
  await switchBranch(page, branchName);
  await page.goto(`${productUrl}/edit`);
  await expect(page.getByText(`Stock at ${branchName}`)).toBeVisible();
  await page.fill('input[name="stockQty"]', "6");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL(productUrl, { timeout: 45000 });

  await page.goto(orderUrl);
  for (const status of ["CONFIRMED", "FULFILLED"]) {
    await selectAndSave(page, 'select[name="status"]', status);
  }
  await page.reload();
  await expect(page.locator('select[name="status"]')).toHaveValue("FULFILLED");

  // South shipped 4 of its 6; Main still has 10; the total is 12.
  await page.goto(productUrl);
  await expect(page.getByText("Stock quantity").locator("xpath=following-sibling::p[1]")).toHaveText("12");
  const southRow = page.getByRole("row", { name: new RegExp(branchName) });
  await expect(southRow.getByRole("cell").nth(1)).toHaveText("2");
  await expect(page.getByRole("row", { name: /Main branch/ }).getByRole("cell").nth(1)).toHaveText("10");

  // A branch level of its own flags South as low without touching Main.
  await southRow.getByRole("spinbutton").fill("3");
  await southRow.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/saved=1/);
  await expect(page.getByRole("row", { name: new RegExp(branchName) }).getByText("Low")).toBeVisible();
  await expect(page.getByRole("row", { name: /Main branch/ }).getByText("Low")).toHaveCount(0);
});

test("a transfer moves stock and its lots from one branch to another", async ({ page }) => {
  const suffix = randomSuffix();
  const code = "E" + suffix.slice(0, 4).toUpperCase();
  const branchName = "East " + code;
  const productName = "Transfer Widget " + suffix;
  const sku = "TW" + suffix;

  await page.goto("/dashboard/branches");
  const createForm = page.locator('form:has(button:has-text("Create branch"))');
  await createForm.locator('input[name="code"]').fill(code);
  await createForm.locator('input[name="name"]').fill(branchName);
  await createForm.getByRole("button", { name: "Create branch" }).click();
  await page.waitForURL(/saved=1/);

  // 10 at Main, then lot tracked: the shelf becomes Main's OPENING lot.
  await page.goto("/dashboard/inventory/new");
  await page.fill('input[name="sku"]', sku);
  await page.fill('input[name="name"]', productName);
  await page.fill('input[name="cost"]', "3.00");
  await page.fill('input[name="unitPrice"]', "9.00");
  await page.fill('input[name="stockQty"]', "10");
  await page.getByRole("button", { name: "Create product" }).click();
  await page.waitForURL(/\/dashboard\/inventory\/(?!new$)[^/]+$/, { timeout: 45000 });
  const productUrl = page.url();
  await page.selectOption('select[name="trackingMode"]', "LOT");
  await page.getByRole("button", { name: "Save tracking" }).click();
  await expect(page.getByText("Saved.")).toBeVisible({ timeout: 45000 });

  // Main → East, 4 units.
  await page.goto("/dashboard/transfers/new");
  await page.selectOption('select[name="toBranchId"]', { label: `${branchName} (${code})` });
  await page.getByRole("button", { name: "Create transfer" }).click();
  await page.waitForURL(/\/dashboard\/transfers\/(?!new$)[^/]+$/, { timeout: 45000 });
  const transferUrl = page.url();

  const option = page.locator('select[name="productId"] option', { hasText: `${productName} (${sku})` });
  await expect(option).toContainText("10 at Main branch");
  await page.selectOption('select[name="productId"]', (await option.getAttribute("value"))!);
  await page.fill('input[name="quantity"]', "4");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByText("10 at Main branch").first()).toBeVisible({ timeout: 45000 });

  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("In transit:")).toBeVisible({ timeout: 45000 });
  await expect(page.getByText("OPENING")).toBeVisible();

  // In transit: gone from Main, shown as arriving at East, not yet counted.
  await page.goto(productUrl);
  const eastRow = page.getByRole("row", { name: new RegExp(branchName) });
  await expect(page.getByRole("row", { name: /Main branch/ }).getByRole("cell").nth(1)).toHaveText("6");
  await expect(eastRow.getByRole("cell").nth(1)).toContainText("+4 arriving");
  await expect(page.getByText("Stock quantity").locator("xpath=following-sibling::p[1]")).toHaveText("6");

  await page.goto(transferUrl);
  await page.getByRole("button", { name: "Receive" }).click();
  await expect(page.getByText("Received", { exact: true })).toBeVisible({ timeout: 45000 });

  await page.goto(productUrl);
  await expect(page.getByRole("row", { name: new RegExp(branchName) }).getByRole("cell").nth(1)).toHaveText("4");
  await expect(page.getByText("Stock quantity").locator("xpath=following-sibling::p[1]")).toHaveText("10");
  // The lot kept its number: OPENING now sits at both branches.
  const lotRows = page.locator("li", { hasText: "OPENING" });
  await expect(lotRows.filter({ hasText: branchName })).toContainText("4");
  await expect(lotRows.filter({ hasText: "Main branch" })).toContainText("6");

  // East can't send more than it holds.
  await page.goto("/dashboard/transfers/new");
  await page.selectOption('select[name="fromBranchId"]', { label: `${branchName} (${code})` });
  await page.selectOption('select[name="toBranchId"]', { label: "Main branch (MAIN)" });
  await page.getByRole("button", { name: "Create transfer" }).click();
  await page.waitForURL(/\/dashboard\/transfers\/(?!new$)[^/]+$/, { timeout: 45000 });
  const back = page.locator('select[name="productId"] option', { hasText: `${productName} (${sku})` });
  await page.selectOption('select[name="productId"]', (await back.getAttribute("value"))!);
  await page.fill('input[name="quantity"]', "5");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByText(`4 at ${branchName}`).first()).toBeVisible({ timeout: 45000 });
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(`Not enough stock to send: ${productName} (4 at ${branchName}, 6 more at other branches, 5 requested).`)).toBeVisible({ timeout: 45000 });
});

test("money is booked per branch and Reports compares branch profit", async ({ page }) => {
  const suffix = randomSuffix();
  const code = "W" + suffix.slice(0, 4).toUpperCase();
  const branchName = "West " + code;
  const incomeCategory = "West sales " + suffix;
  const expenseCategory = "West rent " + suffix;

  await page.goto("/dashboard/branches");
  const createForm = page.locator('form:has(button:has-text("Create branch"))');
  await createForm.locator('input[name="code"]').fill(code);
  await createForm.locator('input[name="name"]').fill(branchName);
  await createForm.getByRole("button", { name: "Create branch" }).click();
  await page.waitForURL(/saved=1/);

  for (const [type, amount, category] of [
    ["INCOME", "500", incomeCategory],
    ["EXPENSE", "200", expenseCategory],
  ] as const) {
    await page.goto("/dashboard/accounting/new");
    await page.selectOption('select[name="type"]', type);
    await page.fill('input[name="amount"]', amount);
    await page.fill('input[name="category"]', category);
    await page.selectOption('select[name="branchId"]', { label: `${branchName} (${code})` });
    await page.getByRole("button", { name: "Create transaction" }).click();
    await page.waitForURL(/\/dashboard\/accounting\/(?!new$)[^/]+$/, { timeout: 45000 });
    await expect(page.getByText(branchName)).toBeVisible();
  }

  // Side by side on Reports, and in the CSV export.
  await page.goto("/dashboard/reports");
  const westRow = page.getByRole("row", { name: new RegExp(branchName) });
  await expect(westRow).toContainText("60.0%");
  const csv = await (await page.request.get("/api/export/branch-profit")).text();
  expect(csv).toContain(`${branchName},500.00,200.00,300.00,60.0`);

  // With West in view, Accounting and Reports only show West's money.
  await switchBranch(page, branchName);
  await page.goto("/dashboard/accounting");
  await expect(page.getByText(incomeCategory).first()).toBeVisible();
  await expect(page.getByText(expenseCategory).first()).toBeVisible();
  await page.goto("/dashboard/reports");
  await expect(page.getByText(`over the last 6 months at ${branchName}`)).toBeVisible();
  await expect(page.getByText("Net (6 months)").locator("xpath=following-sibling::p[1]")).toContainText("$300");
  const pdf = await page.request.get("/api/reports/pdf");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
});
