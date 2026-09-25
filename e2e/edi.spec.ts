import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { createCustomer, randomSuffix, selectAndSave } from "./fixtures";
import { buildInterchange, segments850 } from "../src/lib/edi/x12";

test.describe.configure({ mode: "serial", timeout: 240_000 });

const SHOTS = process.env.E2E_SCREENSHOT_DIR;
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

const s = randomSuffix().toUpperCase();
const ourId = `AIBOS${s}`;
const partnerId = `BUYER${s}`;
const customerName = `EDI Buyer ${s}`;
const supplierName = `EDI Supplier ${s}`;
const partnerName = `Buyer Network ${s}`;
const sku = `EDI${s}`;

/** An 850 the way the customer's EDI system would send it. */
function inbound850(poNumber: string, lines: { sku: string; quantity: number; unitPrice: number }[]) {
  return buildInterchange({
    format: { version: "004010", usageIndicator: "T", elementSeparator: "*", subElementSeparator: ">", segmentTerminator: "~" },
    sender: { qualifier: "ZZ", isaId: partnerId, gsId: partnerId },
    receiver: { qualifier: "ZZ", isaId: ourId, gsId: ourId },
    transactionSet: "850",
    controlNumber: 7001,
    segments: segments850({ number: poNumber, date: new Date(), buyerName: customerName, sellerName: "Us", lines }),
  });
}

async function importText(page: Page, text: string) {
  await page.goto("/dashboard/edi/import");
  await page.fill('textarea[name="content"]', text);
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.waitForURL(/\/dashboard\/edi\/(?!import$|partners$|settings$)[^/]+$/, { timeout: 45000 });
}

async function setStatus(page: Page, status: string) {
  await selectAndSave(page, 'select[name="status"]', status);
}

test("set up our EDI identity and a trading partner", async ({ page }) => {
  await page.goto("/dashboard/edi");
  await expect(page.getByText("EDI isn't set up yet")).toBeVisible();

  await page.goto("/dashboard/edi/settings");
  await page.fill('input[name="isaId"]', ourId);
  await page.fill('input[name="gsId"]', ourId);
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Saved.")).toBeVisible({ timeout: 45000 });
  await shot(page, "edi-01-settings");

  await createCustomer(page, customerName);
  await page.goto("/dashboard/procurement/suppliers");
  await page.fill('input[name="name"]', supplierName);
  await page.getByRole("button", { name: "Add supplier" }).click();
  await expect(page.getByText(supplierName).first()).toBeVisible({ timeout: 45000 });

  await page.goto("/dashboard/inventory/new");
  await page.fill('input[name="sku"]', sku);
  await page.fill('input[name="name"]', `EDI Widget ${s}`);
  await page.fill('input[name="cost"]', "8.00");
  await page.fill('input[name="unitPrice"]', "20.00");
  await page.fill('input[name="stockQty"]', "50");
  await page.getByRole("button", { name: "Create product" }).click();
  await page.waitForURL(/\/dashboard\/inventory\/(?!new$)[^/]+$/, { timeout: 45000 });

  await page.goto("/dashboard/edi/partners");
  await page.fill('input[name="name"]', partnerName);
  await page.fill('input[name="isaId"]', partnerId);
  await page.fill('input[name="gsId"]', partnerId);
  await page.selectOption('select[name="customerId"]', { label: customerName });
  await page.selectOption('select[name="supplierId"]', { label: supplierName });
  await page.getByRole("button", { name: "Add partner" }).click();
  await expect(page.getByText("Saved.")).toBeVisible({ timeout: 45000 });
  await expect(page.getByText(`ISA ZZ:${partnerId}`)).toBeVisible();
  await shot(page, "edi-02-partners");
});

test("an inbound 850 becomes a sales order with a 997 back", async ({ page }) => {
  await importText(page, inbound850(`PO${s}`, [{ sku, quantity: 4, unitPrice: 18.5 }]));
  await expect(page.getByText("Processed").first()).toBeVisible();
  await expect(page.getByText("997 acknowledgment sent back")).toBeVisible();
  await expect(page.getByText("$74.00")).toBeVisible();
  await shot(page, "edi-03-inbound-850-processed");

  await page.getByRole("link", { name: "997 acknowledgment sent back" }).click();
  await expect(page.locator("pre")).toContainText("AK9*A*1*1*1~");
  await shot(page, "edi-04-997-accepted");

  // The order carries the customer's PO number and their agreed price.
  await page.goBack();
  await page.getByRole("link", { name: "open order" }).click();
  await expect(page.getByText(`Customer PO PO${s}`)).toBeVisible();
  await expect(page.getByText("4 × $18.50")).toBeVisible();
});

test("bad files are rejected with the reason, and never imported twice", async ({ page }) => {
  await importText(page, inbound850(`PO${s}`, [{ sku, quantity: 4, unitPrice: 18.5 }]));
  await expect(page.getByText("Rejected").first()).toBeVisible();
  await expect(page.getByText(/Already received: PO/)).toBeVisible();
  await page.getByRole("link", { name: "997 acknowledgment sent back" }).click();
  await expect(page.locator("pre")).toContainText("AK9*R*1*1*0~");

  await importText(page, inbound850(`PO2${s}`, [{ sku: "NOPE123", quantity: 1, unitPrice: 1 }]));
  await expect(page.getByText("Unknown product SKUs: NOPE123.")).toBeVisible();
  await shot(page, "edi-05-rejected-unknown-sku");

  await importText(page, "this is not an EDI file");
  await expect(page.getByText(/doesn't start with an ISA segment/)).toBeVisible();
});

test("outbound 856, 810 and 850 are generated from real records", async ({ page }) => {
  // Fulfil the EDI order, then send the ship notice.
  await page.goto("/dashboard/sales");
  await page.getByRole("link", { name: customerName }).first().click();
  await page.waitForURL(/\/dashboard\/sales\/[^/]+$/);
  await setStatus(page, "CONFIRMED");
  await setStatus(page, "FULFILLED");
  await page.reload();
  await page.getByRole("button", { name: "Send EDI 856" }).click();
  await page.waitForURL(/\/dashboard\/edi\/[^/]+$/, { timeout: 45000 });
  await expect(page.locator("pre")).toContainText(`PRF*PO${s}~`);
  await expect(page.locator("pre")).toContainText(`LIN**VP*${sku}~`);
  await shot(page, "edi-06-outbound-856");

  // Invoice the customer and send it as an 810.
  await page.goto("/dashboard/invoicing/new");
  await page.selectOption('select[name="customerId"]', { label: customerName });
  await page.getByRole("button", { name: "Create invoice" }).click();
  await page.waitForURL(/\/dashboard\/invoicing\/(?!new$)[^/]+$/, { timeout: 45000 });
  await page.fill('input[name="description"]', "Widgets");
  await page.fill('input[name="quantity"]', "4");
  await page.fill('input[name="unitPrice"]', "18.50");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("4 ×").first()).toBeVisible({ timeout: 45000 });
  await page.getByRole("button", { name: "Send EDI 810" }).click();
  await page.waitForURL(/\/dashboard\/edi\/[^/]+$/, { timeout: 45000 });
  await expect(page.locator("pre")).toContainText("IT1*1*4*EA*18.5**VP*Widgets~");

  // Order from the supplier and send it as an 850.
  await page.goto("/dashboard/procurement/new");
  await page.selectOption('select[name="supplierId"]', { label: supplierName });
  await page.getByRole("button", { name: "Create purchase order" }).click();
  await page.waitForURL(/\/dashboard\/procurement\/(?!new$|suppliers$)[^/]+$/, { timeout: 45000 });
  const option = page.locator('select[name="productId"] option', { hasText: sku });
  await page.selectOption('select[name="productId"]', (await option.getAttribute("value"))!);
  await page.fill('input[name="quantity"]', "10");
  await page.fill('input[name="unitCost"]', "8.00");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("10 ×")).toBeVisible({ timeout: 45000 });
  await page.getByRole("button", { name: "Send EDI 850" }).click();
  await page.waitForURL(/\/dashboard\/edi\/[^/]+$/, { timeout: 45000 });
  await expect(page.locator("pre")).toContainText(`PO1*1*10*EA*8**VP*${sku}~`);
  await expect(page.locator("pre")).toContainText(`*ZZ*${partnerId.padEnd(15, " ")}*`);

  // The file downloads as sent.
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download file" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^out_850_\d{9}\.edi$/);

  await page.goto("/dashboard/edi");
  await shot(page, "edi-07-document-log");
});
