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

test("invoice PDF download works and marking Paid books an Accounting transaction", async ({ page }) => {
  const customerName = "Invoice Customer " + randomSuffix();
  await createCustomer(page, customerName);

  await page.goto("/dashboard/invoicing/new");
  await page.selectOption('select[name="customerId"]', { label: customerName });
  await page.getByRole("button", { name: "Create invoice" }).click();
  await page.waitForURL(/\/dashboard\/invoicing\/(?!new$)[^/]+$/, { timeout: 45000 });
  const invoiceUrl = page.url();
  const invoiceId = invoiceUrl.split("/").pop()!;

  await page.fill('input[name="description"]', "Consulting");
  await page.fill('input[name="quantity"]', "1");
  await page.fill('input[name="unitPrice"]', "321");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("Total: $321.00")).toBeVisible({ timeout: 45000 });

  const pdfResponse = await page.request.get(`/api/invoices/${invoiceId}/pdf`);
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()["content-type"]).toBe("application/pdf");

  await page.selectOption('select[name="status"]', "PAID");
  await expect(page.getByText("PAID").first()).toBeVisible({ timeout: 45000 });

  await page.goto("/dashboard/accounting");
  await expect(page.getByText("Invoice payment").first()).toBeVisible({ timeout: 45000 });
});
