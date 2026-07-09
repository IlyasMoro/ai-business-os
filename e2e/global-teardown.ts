import fs from "node:fs";
import { INFO_PATH } from "./global-setup";
import { deleteCompanyByName } from "./db-cleanup";

export default async function globalTeardown() {
  if (!fs.existsSync(INFO_PATH)) return;

  const { companyName } = JSON.parse(fs.readFileSync(INFO_PATH, "utf-8")) as {
    companyName: string;
  };

  await deleteCompanyByName(companyName);
}
