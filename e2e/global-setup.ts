import { chromium, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const AUTH_DIR = path.join(__dirname, ".auth");
const STATE_PATH = path.join(AUTH_DIR, "user.json");
export const INFO_PATH = path.join(AUTH_DIR, "info.json");

export default async function globalSetup(config: FullConfig) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const baseURL =
    config.projects[0]?.use?.baseURL ?? process.env.E2E_BASE_URL ?? "http://localhost:3000";

  const suffix = Math.random().toString(36).slice(2, 10);
  const companyName = "E2E Suite Co " + suffix;
  const email = `e2e-suite+${suffix}@example.com`;
  const password = "Password123!";

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${baseURL}/register`);
  await page.fill('input[name="companyName"]', companyName);
  await page.fill('input[name="name"]', "E2E Tester");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.locator('form:has(input[name="companyName"]) button[type="submit"]').click();
  await page.waitForURL("**/dashboard**", { timeout: 30000 });

  await page.context().storageState({ path: STATE_PATH });
  fs.writeFileSync(INFO_PATH, JSON.stringify({ companyName, email }));

  await browser.close();
}
