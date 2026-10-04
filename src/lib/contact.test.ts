import { describe, it, expect } from "vitest";
import { ContactSchema, sizeLine, topicFromQuery, topicLabel } from "@/lib/contact";

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
  it("reads team size and branches as optional whole numbers", () => {
    const base = { name: "Thandi", email: "t@example.com", topic: "ENTERPRISE", message: "We need invoicing, please." };
    const ok = ContactSchema.safeParse({ ...base, teamSize: "60", branches: "4" });
    expect(ok.success && ok.data.teamSize === 60 && ok.data.branches === 4).toBe(true);
    expect(ContactSchema.safeParse(base).success).toBe(true);
    expect(ContactSchema.safeParse({ ...base, teamSize: "0" }).success).toBe(false);
    expect(ContactSchema.safeParse({ ...base, branches: "2.5" }).success).toBe(false);
  });

  it("describes the size in words", () => {
    expect(sizeLine(60, 4)).toBe("60 people, 4 branches");
    expect(sizeLine(1, null)).toBe("1 person");
    expect(sizeLine(null, 1)).toBe("1 branch");
    expect(sizeLine(null, undefined)).toBe("");
  });
});
