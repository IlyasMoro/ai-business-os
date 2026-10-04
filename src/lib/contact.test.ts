import { describe, it, expect } from "vitest";
import { ContactSchema, topicFromQuery, topicLabel } from "@/lib/contact";

describe("contact form", () => {
  it("accepts a normal message", () => {
    const r = ContactSchema.safeParse({ name: "Thandi", email: "t@example.com", topic: "ENTERPRISE", message: "We have 60 staff across 4 branches." });
    expect(r.success).toBe(true);
  });

  it("asks for a real email and enough of a message", () => {
    const r = ContactSchema.safeParse({ name: "T", email: "nope", topic: "SALES", message: "hi" });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(r.error.flatten().fieldErrors).sort()).toEqual(["email", "message", "name"]);
  });

  it("reads the topic from a link and labels it", () => {
    expect(topicFromQuery("enterprise")).toBe("ENTERPRISE");
    expect(topicFromQuery("nonsense")).toBe("SALES");
    expect(topicFromQuery(undefined)).toBe("SALES");
    expect(topicLabel("SUPPORT")).toBe("Help with my account");
  });
});
