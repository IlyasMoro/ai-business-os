import { test, expect } from "@playwright/test";
import { registerCompany, randomSuffix } from "./fixtures";
import { deleteCompanyByName, deletePlatformSettings } from "./db-cleanup";

const adminEmail = process.env.PLATFORM_ADMIN_EMAIL;
const isTestAdminEmail = !!adminEmail && adminEmail.includes("e2e");

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("platform settings access control", () => {
  test.describe.configure({ retries: 0 });
  test.skip(!isTestAdminEmail, "requires PLATFORM_ADMIN_EMAIL set to a dedicated e2e test address");

  const createdCompanies: string[] = [];

  test.afterEach(async () => {
    for (const name of createdCompanies.splice(0)) {
      await deleteCompanyByName(name);
    }
  });

  test("regular user cannot see or access platform settings", async ({ page }) => {
    const { companyName } = await registerCompany(page);
    createdCompanies.push(companyName);

    await expect(page.getByRole("link", { name: "Platform Settings" })).toHaveCount(0);

    await page.goto("/dashboard/platform-settings");
    await expect(page.getByText("Page not found")).toBeVisible();
  });

  test("platform admin can see and save platform settings", async ({ page }) => {
    const { companyName } = await registerCompany(page, { email: adminEmail });
    createdCompanies.push(companyName);

    await expect(page.getByRole("link", { name: "Platform Settings" })).toBeVisible();

    await page.goto("/dashboard/platform-settings");
    await page.fill("#resendApiKey", "re_e2e_fake_key_" + randomSuffix());
    await page.fill("#resendFromEmail", "e2e@example.com");
    await page.locator('form:has(#resendApiKey) button[type="submit"]').click();
    await page.waitForURL(/\?saved=1/, { timeout: 15000 });

    await deletePlatformSettings();
  });
});
