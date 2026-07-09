import { test, expect } from "@playwright/test";
import { createCustomer, randomSuffix } from "./fixtures";

test("create a CRM customer and see it in the list", async ({ page }) => {
  const name = "Acme Corp " + randomSuffix();
  await createCustomer(page, name);

  await page.goto("/dashboard/crm");
  await expect(page.getByText(name).first()).toBeVisible();
});
