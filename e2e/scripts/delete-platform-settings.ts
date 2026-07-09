import "dotenv/config";
import { db } from "../../src/lib/db";

(async () => {
  await db.platformSettings.deleteMany({ where: { id: "platform" } });
})().finally(() => db.$disconnect());
