import "server-only";
import Groq from "groq-sdk";
import { db } from "@/lib/db";

export async function getGroqClient() {
  const settings = await db.platformSettings.findUnique({ where: { id: "platform" } });
  return new Groq(settings?.groqApiKey ? { apiKey: settings.groqApiKey } : undefined);
}
