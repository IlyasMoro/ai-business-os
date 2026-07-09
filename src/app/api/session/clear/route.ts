import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/session";

export async function GET(request: Request) {
  await deleteSession();
  const base = process.env.APP_BASE_URL ?? new URL(request.url).origin;
  return NextResponse.redirect(new URL("/login", base));
}
