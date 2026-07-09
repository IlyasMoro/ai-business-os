import { execFileSync } from "node:child_process";
import path from "node:path";

const TSX_CLI = require.resolve("tsx/cli");
const SCRIPTS_DIR = path.join(__dirname, "scripts");

function runScript(script: string, args: string[] = []): void {
  execFileSync(process.execPath, [TSX_CLI, path.join(SCRIPTS_DIR, script), ...args], {
    stdio: "inherit",
  });
}

export async function deleteCompanyByName(name: string): Promise<void> {
  runScript("delete-company.ts", [name]);
}

export async function deletePlatformSettings(): Promise<void> {
  runScript("delete-platform-settings.ts");
}
