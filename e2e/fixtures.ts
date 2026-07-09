import type { Page } from "@playwright/test";

export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function registerCompany(
  page: Page,
  opts?: { email?: string; companyName?: string; password?: string }
): Promise<{ email: string; companyName: string; password: string }> {
  const suffix = randomSuffix();
  const email = opts?.email ?? `e2e+${suffix}@example.com`;
  const companyName = opts?.companyName ?? `E2E Co ${suffix}`;
  const password = opts?.password ?? "Password123!";

  await page.goto("/register");
  await page.fill('input[name="companyName"]', companyName);
  await page.fill('input[name="name"]', "E2E Tester");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.locator('form:has(input[name="companyName"]) button[type="submit"]').click();
  await page.waitForURL("**/dashboard**", { timeout: 30000 });

  return { email, companyName, password };
}

export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.locator('form:has(input[name="email"]) button[type="submit"]').click();
  await page.waitForURL("**/dashboard**", { timeout: 30000 });
}

export async function createCustomer(page: Page, name: string): Promise<void> {
  await page.goto("/dashboard/crm/new");
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="email"]', `contact+${randomSuffix()}@example.com`);
  await page.getByRole("button", { name: "Create customer" }).click();
  await page.waitForURL(/\/dashboard\/crm\/(?!new$)[^/]+$/, { timeout: 45000 });
}
