/* Product CSV import: column matching and the import plan. No database
   access here; lib/actions/product-import.ts runs it. The CSV reader is
   shared with the customer import. */

import { MAX_IMPORT_ROWS } from "@/lib/customer-import";
import { isWeighed, roundQty, type Unit } from "@/lib/quantity";

export type ProductImportField = "sku" | "name" | "description" | "cost" | "price" | "stock" | "reorderLevel" | "unit";

export const PRODUCT_IMPORT_FIELD_LABELS: Record<ProductImportField, string> = {
  sku: "SKU",
  name: "Name",
  description: "Description",
  cost: "Cost",
  price: "Price",
  stock: "Opening stock",
  reorderLevel: "Reorder level",
  unit: "Unit",
};

// Headings from most spreadsheets and other systems, lower case.
const ALIASES: Record<ProductImportField, string[]> = {
  sku: ["sku", "code", "item code", "product code", "article", "article number", "part number"],
  name: ["name", "product", "product name", "item", "item name", "title"],
  description: ["description", "details", "notes"],
  cost: ["cost", "cost price", "unit cost", "buy price", "purchase price"],
  price: ["price", "unit price", "selling price", "sell price", "sale price", "retail price"],
  stock: ["stock", "opening stock", "qty", "quantity", "on hand", "stock qty", "stock quantity", "in stock"],
  reorderLevel: ["reorder level", "reorder", "reorder point", "min stock", "minimum stock", "minimum"],
  unit: ["unit", "uom", "unit of measure", "sold by", "measure"],
};

// What people write in a Unit column. Blank means counted by the piece.
const UNIT_WORDS: Record<string, Unit> = {
  "": "EACH", each: "EACH", ea: "EACH", unit: "EACH", units: "EACH", pc: "EACH", pcs: "EACH",
  piece: "EACH", pieces: "EACH", item: "EACH", items: "EACH",
  kg: "KG", kgs: "KG", kilo: "KG", kilos: "KG", kilogram: "KG", kilograms: "KG",
  l: "L", lt: "L", ltr: "L", litre: "L", litres: "L", liter: "L", liters: "L",
};

/** The unit named in a cell ("kg", "Litres", "each"), or null when unknown. */
export function parseUnit(raw: string | undefined): Unit | null {
  return UNIT_WORDS[(raw ?? "").trim().toLowerCase().replace(/\.$/, "")] ?? null;
}

export function matchProductColumns(header: string[]) {
  const columns: Partial<Record<ProductImportField, number>> = {};
  const ignored: string[] = [];
  header.forEach((raw, index) => {
    const h = raw.trim().toLowerCase().replace(/\s+/g, " ");
    const field = (Object.keys(ALIASES) as ProductImportField[]).find((f) => ALIASES[f].includes(h));
    if (field && columns[field] === undefined) columns[field] = index;
    else if (h) ignored.push(raw.trim());
  });
  return { columns, ignored };
}

/** "R 1 200,50", "$1,200.50" and "1200.5" all read as 1200.5; blank is null. */
export function parseAmount(raw: string | undefined): number | null | "invalid" {
  const v = (raw ?? "").trim().replace(/[^\d.,\-]/g, "");
  if (v === "") return null;
  let normal = v;
  if (v.includes(",") && v.includes(".")) normal = v.replace(/,/g, "");
  else if (v.includes(",")) normal = /,\d{1,2}$/.test(v) ? v.replace(/\./g, "").replace(",", ".") : v.replace(/,/g, "");
  const n = Number(normal);
  return Number.isFinite(n) ? n : "invalid";
}

export type ImportProduct = {
  line: number;
  sku: string;
  name: string;
  description: string | null;
  cost: number;
  unitPrice: number;
  stockQty: number;
  reorderLevel: number;
  unit: Unit;
};

export type ProductImportPlan = {
  fatal?: string;
  ready: ImportProduct[];
  duplicates: { line: number; sku: string; name: string }[];
  problems: { line: number; message: string }[];
  warnings: { line: number; message: string }[];
  ignoredColumns: string[];
};

/** Checks every row. New SKUs are imported; SKUs already in Inventory, or
 * repeated in the file, are skipped so importing twice is safe. */
export function planProductImport(rows: string[][], ctx: { existingSkus: Set<string> }): ProductImportPlan {
  const empty: ProductImportPlan = { ready: [], duplicates: [], problems: [], warnings: [], ignoredColumns: [] };
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!header) return { ...empty, fatal: "The file is empty." };
  const { columns, ignored } = matchProductColumns(header);
  if (columns.sku === undefined || columns.name === undefined) {
    return { ...empty, fatal: "The first row needs at least a SKU and a Name column." };
  }
  if (body.length > MAX_IMPORT_ROWS) return { ...empty, fatal: `The file has ${body.length} products. Import up to ${MAX_IMPORT_ROWS} at a time.` };

  const plan: ProductImportPlan = { ...empty, ignoredColumns: ignored };
  const seen = new Set<string>();
  const cell = (row: string[], f: ProductImportField) => (columns[f] === undefined ? "" : (row[columns[f]!] ?? "").trim());

  body.forEach((row, i) => {
    const line = i + 2;
    const sku = cell(row, "sku");
    const name = cell(row, "name");
    if (!sku || !name) return plan.problems.push({ line, message: "SKU and Name are both needed." });
    const key = sku.toLowerCase();
    if (ctx.existingSkus.has(key) || seen.has(key)) return plan.duplicates.push({ line, sku, name });

    const cost = parseAmount(cell(row, "cost"));
    const price = parseAmount(cell(row, "price"));
    const stock = parseAmount(cell(row, "stock"));
    const reorder = parseAmount(cell(row, "reorderLevel"));
    if ([cost, price, stock, reorder].includes("invalid")) return plan.problems.push({ line, message: "A number couldn't be read. Use plain numbers like 12.50." });
    if ([cost, price, stock, reorder].some((n) => typeof n === "number" && n < 0)) return plan.problems.push({ line, message: "Numbers can't be negative." });

    const unit = parseUnit(cell(row, "unit"));
    if (!unit) return plan.problems.push({ line, message: `Unit "${cell(row, "unit")}" isn't known. Use each, kg or L.` });

    // Weighed products keep their decimals (12.75 kg); pieces stay whole.
    let stockQty = (stock as number | null) ?? 0;
    if (isWeighed(unit)) {
      stockQty = roundQty(stockQty);
    } else if (!Number.isInteger(stockQty)) {
      plan.warnings.push({ line, message: `Opening stock ${stockQty} rounded down to ${Math.floor(stockQty)}. Add a Unit column with kg or L for products sold by weight.` });
      stockQty = Math.floor(stockQty);
    }
    const reorderRaw = (reorder as number | null) ?? 5;
    if (price === null) plan.warnings.push({ line, message: `${name} has no price, so it starts at R 0.` });

    seen.add(key);
    plan.ready.push({
      line,
      sku: sku.slice(0, 64),
      name: name.slice(0, 200),
      description: cell(row, "description").slice(0, 2000) || null,
      cost: (cost as number | null) ?? 0,
      unitPrice: (price as number | null) ?? 0,
      stockQty,
      reorderLevel: isWeighed(unit) ? roundQty(reorderRaw) : Math.floor(reorderRaw),
      unit,
    });
  });
  return plan;
}
