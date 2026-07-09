import { test, expect } from "@playwright/test";
import { registerCompany, loginAs, randomSuffix } from "./fixtures";
import { deleteCompanyByName } from "./db-cleanup";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("auth", () => {
  const createdCompanies: string[] = [];

  test.afterEach(async () => {
    for (const name of createdCompanies.splice(0)) {
      await deleteCompanyByName(name);
    }
  });

  test("register creates an account and reaches the dashboard", async ({ page }) => {
    const { companyName } = await registerCompany(page);
    createdCompanies.push(companyName);
    await expect(page.getByText(companyName, { exact: true })).toBeVisible();
  });

  test("login works with a case-insensitive email", async ({ page }) => {
    const { email, password, companyName } = await registerCompany(page, {
      email: `E2E.Case+${randomSuffix()}@Example.com`,
    });
    createdCompanies.push(companyName);

    await page.goto("/api/session/clear");
    await page.waitForURL("**/login**", { timeout: 15000 });
    await loginAs(page, email.toUpperCase(), password);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
