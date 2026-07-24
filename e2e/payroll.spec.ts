import { test, expect } from "@playwright/test";
import { randomSuffix } from "./fixtures";

test("create a payroll run", async ({ page }) => {
  await page.goto("/dashboard/payroll/new");
  await page.getByRole("button", { name: "Create payroll run" }).click();
  await page.waitForURL(/\/dashboard\/payroll\/(?!new$)[^/]+$/, { timeout: 45000 });

  await page.goto("/dashboard/payroll");
  await expect(page.getByText("No payroll runs yet")).not.toBeVisible();
});

test("download a payslip and copy a run's items into a new period", async ({ page }) => {
  const employeeName = "Payroll Employee " + randomSuffix();

  await page.goto("/dashboard/hr/new");
  await page.fill('input[name="name"]', employeeName);
  await page.fill('input[name="salary"]', "60000");
  await page.getByRole("button", { name: "Create employee" }).click();
  await page.waitForURL(/\/dashboard\/hr\/(?!new$)[^/]+$/, { timeout: 45000 });

  await page.goto("/dashboard/payroll/new");
  await page.getByRole("button", { name: "Create payroll run" }).click();
  await page.waitForURL(/\/dashboard\/payroll\/(?!new$)[^/]+$/, { timeout: 45000 });

  await page.selectOption('select[name="employeeId"]', { label: employeeName });
  await page.fill('input[name="grossPay"]', "5000");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText(employeeName).first()).toBeVisible({ timeout: 45000 });

  const payslipLink = page.getByRole("link", { name: /Payslip/i });
  const payslipHref = await payslipLink.getAttribute("href");
  const payslipResponse = await page.request.get(payslipHref!);
  expect(payslipResponse.status()).toBe(200);
  expect(payslipResponse.headers()["content-type"]).toBe("application/pdf");

  await page.getByRole("button", { name: "Copy to new run" }).click();
  await page.waitForURL(/\/dashboard\/payroll\/(?!new$)[^/]+$/, { timeout: 45000 });
  await expect(page.getByText(employeeName).first()).toBeVisible({ timeout: 45000 });
});
