import { describe, it, expect } from "vitest";
import { tidyAssistantText } from "@/lib/assistant-text";

describe("tidyAssistantText", () => {
  it("writes rand with comma thousands", () => {
    expect(tidyAssistantText("Owed: R\u202f3\u202f292.03 and R 1\u202f234\u202f567.00")).toBe("Owed: R\u00a03,292.03 and R\u00a01,234,567.00");
  });

  it("drops hyphens and dashes from words but keeps codes, emails and links", () => {
    expect(tidyAssistantText("Past\u2011due follow-up — call today")).toBe("Past due follow up, call today");
    expect(tidyAssistantText("Email buyer@bo-kaap.example about SKU BEEF-TBONE at https://x.example/a-b")).toBe(
      "Email buyer@bo-kaap.example about SKU BEEF-TBONE at https://x.example/a-b"
    );
  });

  it("only treats a standalone R as rand", () => {
    expect(tidyAssistantText("FOR 3 days")).toBe("FOR 3 days");
  });

  it("leaves dates and plain numbers alone", () => {
    expect(tidyAssistantText("Due 15 Sept 2026, 3 items")).toBe("Due 15 Sept 2026, 3 items");
  });
});
