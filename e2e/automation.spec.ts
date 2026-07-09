import { test, expect } from "@playwright/test";

test("manually trigger automations", async ({ page }) => {
  await page.goto("/dashboard/automation");
  await page.getByRole("button", { name: "Run automations now" }).click();
  await expect(page.getByText("Automations ran successfully.")).toBeVisible({ timeout: 15000 });
});
