import "dotenv/config";
import { db } from "../../src/lib/db";

const name = process.argv[2];
(async () => {
  if (!name) return;
  await db.company.deleteMany({ where: { name } });
})().finally(() => db.$disconnect());
