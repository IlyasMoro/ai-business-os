// Lists user visible text that breaks the house style: hyphens, en dashes
// and em dashes in prose. Walks the TypeScript syntax tree, so class names,
// imports, keys and URLs are skipped. Run: node scripts/audit-copy.mjs
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src/app", "src/components", "src/lib"];
const SKIP_ATTRS = new Set(["className", "href", "src", "id", "htmlFor", "name", "key", "type", "role", "method", "action", "rel", "target", "d", "viewBox", "fill", "stroke", "style", "pattern", "autoComplete", "inputMode", "accept", "encType", "aria-hidden", "data-testid", "as", "variant", "size", "tone", "icon", "form", "value", "defaultValue"]);
const SKIP_CALLS = new Set(["cn", "clsx", "twMerge", "require", "import", "redirect", "revalidatePath", "fetch", "querySelector", "getElementById", "startsWith", "endsWith", "includes", "split", "replace", "join", "padStart", "test", "match", "get", "set", "has", "delete", "append", "toLocaleString", "toLocaleDateString", "Intl.NumberFormat", "addEventListener", "removeEventListener", "matchMedia", "headers", "createElement", "setAttribute", "getAttribute", "format", "parse", "RegExp", "Date", "console.log", "console.error", "console.warn", "slice", "indexOf"]);
const BAD = /[A-Za-z]-[A-Za-z]|\s[-–—]\s|[–—]/;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|mts)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

function calleeName(call) {
  const e = call.expression;
  return ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : "";
}

function shouldSkip(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
    if (ts.isJsxAttribute(p)) return SKIP_ATTRS.has(p.name.getText());
    // Only a direct argument of a skipped call (cn("..."), split("-")).
    if (ts.isCallExpression(p)) {
      if (p === node.parent && SKIP_CALLS.has(calleeName(p))) return true;
      continue;
    }
    if (ts.isPropertyAssignment(p) && p.name === node) return true;
    if (ts.isPropertyAssignment(p) && /^(className|href|key|id|path|url|icon|color|slug|mimeType|contentType|type)$/i.test(p.name.getText())) return true;
    if (ts.isElementAccessExpression(p)) return true;
    if (ts.isCaseClause(p) || ts.isBinaryExpression(p) && /===|!==|==|!=/.test(p.operatorToken.getText())) return true;
    if (ts.isTypeNode(p) || ts.isLiteralTypeNode(p)) return true;
    if (ts.isBlock(p) || ts.isSourceFile(p)) return false;
  }
  return false;
}

const hits = [];
for (const root of ROOTS) {
  for (const file of walk(root, [])) {
    const text = fs.readFileSync(file, "utf8");
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node) => {
      let value = null;
      if (ts.isJsxText(node)) value = node.text;
      else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) value = node.text;
      else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) value = node.text;
      if (value && BAD.test(value) && /[A-Za-z]{2,}\s+[A-Za-z]/.test(value.trim() + " x") && !/^[\w./:@-]+$/.test(value.trim()) && !shouldSkip(node)) {
        // Ignore strings that look like class lists, CSS, SQL, URLs or code.
        const v = value.trim();
        if (!/\b(text|bg|border|px|py|mt|mb|flex|grid|rounded|hover|light|dark|ring|shadow|gap|w|h)-[\w[\]/.]+/.test(v) && !/https?:|\/\/|=>|\bselect\b|\bfrom\b\s+"/i.test(v)) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
          hits.push(`${file.replace(/\\/g, "/")}:${line + 1}: ${v.replace(/\s+/g, " ").slice(0, 140)}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
}
console.log(hits.join("\n"));
console.error(`${hits.length} findings`);
