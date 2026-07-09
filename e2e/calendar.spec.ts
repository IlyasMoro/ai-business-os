import { test, expect } from "@playwright/test";
import { randomSuffix } from "./fixtures";

test("create a calendar event and see it on the agenda", async ({ page }) => {
  const title = "Client Call " + randomSuffix();

  await page.goto("/dashboard/calendar");
  await page.fill('input[name="title"]', title);

  const startAt = page.locator('input[name="startAt"]');
  await startAt.evaluate((el: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, "2027-01-15T10:00");

  await page.getByRole("button", { name: "Add event" }).click();
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 15000 });
});
