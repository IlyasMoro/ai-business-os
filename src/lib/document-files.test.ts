import { describe, it, expect } from "vitest";
import { contentDisposition, fileKind, opensInBrowser, uploadBlocker, MAX_DOCUMENT_BYTES } from "@/lib/document-files";

describe("opensInBrowser", () => {
  it("opens only safe types in the browser", () => {
    expect(opensInBrowser("application/pdf")).toBe(true);
    expect(opensInBrowser("image/png")).toBe(true);
    expect(opensInBrowser("text/plain; charset=utf-8")).toBe(true);
    expect(opensInBrowser("text/html")).toBe(false);
    expect(opensInBrowser("image/svg+xml")).toBe(false);
    expect(opensInBrowser("application/javascript")).toBe(false);
  });
});

describe("contentDisposition", () => {
  it("downloads risky files and keeps the real name", () => {
    expect(contentDisposition("text/html", "page.html")).toMatch(/^attachment; filename="page.html"/);
    expect(contentDisposition("application/pdf", "Rapport été.pdf")).toBe(
      `inline; filename="Rapport _t_.pdf"; filename*=UTF-8''Rapport%20%C3%A9t%C3%A9.pdf`
    );
    expect(contentDisposition("image/png", 'a"b.png')).toMatch(/filename="a_b.png"/);
  });
});

describe("fileKind", () => {
  it("picks an icon from the type or extension", () => {
    expect(fileKind("application/pdf", "x")).toBe("pdf");
    expect(fileKind("", "photo.JPG")).toBe("image");
    expect(fileKind("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "a.xlsx")).toBe("sheet");
    expect(fileKind("application/octet-stream", "contract.docx")).toBe("doc");
    expect(fileKind("application/zip", "a.zip")).toBe("archive");
    expect(fileKind("application/octet-stream", "data.bin")).toBe("other");
  });
});

describe("uploadBlocker", () => {
  it("checks count, empty and size", () => {
    expect(uploadBlocker([])).toMatch(/Choose/);
    expect(uploadBlocker([{ name: "a.pdf", size: 10 }])).toBeNull();
    expect(uploadBlocker([{ name: "e.txt", size: 0 }])).toMatch(/empty/);
    expect(uploadBlocker([{ name: "big.zip", size: MAX_DOCUMENT_BYTES + 1 }])).toMatch(/8 MB/);
    expect(uploadBlocker(Array.from({ length: 11 }, (_, i) => ({ name: `${i}`, size: 1 })))).toMatch(/up to 10/);
  });
});
