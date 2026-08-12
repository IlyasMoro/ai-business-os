import { NextResponse } from "next/server";
import { runAutomations } from "@/lib/automations";

/** Called on a schedule by .github/workflows/automations.yml — nothing
 * inside the app itself or on Railway triggers runAutomations() on a timer,
 * so this route is the only thing that does. Bearer-token authenticated so
 * it can't be triggered by anyone who doesn't hold CRON_SECRET. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runAutomations();
  return NextResponse.json(result);
}
