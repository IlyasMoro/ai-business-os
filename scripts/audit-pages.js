// Browser side page audit. Paste into the console of a signed in dashboard
// tab (or run through a browser automation tool): it loads each page in a
// hidden same origin frame at a given width and reports house style and
// layout problems. Usage: await auditPages(["/dashboard", ...], 375)
window.auditPages = async function auditPages(paths, width = 1280, { light = false } = {}) {
  const results = [];
  for (const path of paths) {
    const frame = document.createElement("iframe");
    frame.style.cssText = `position:fixed;left:-9999px;top:0;width:${width}px;height:900px;border:0`;
    document.body.appendChild(frame);
    const started = Date.now();
    await new Promise((resolve) => {
      frame.onload = resolve;
      frame.src = path;
      setTimeout(resolve, 20000);
    });
    await new Promise((r) => setTimeout(r, 1800));
    const doc = frame.contentDocument;
    const issues = [];
    try {
      if (light) doc.documentElement.classList.add("light");
      const main = doc.querySelector("main") ?? doc.body;
      const text = main.innerText;
      const add = (kind, list) => list && list.length && issues.push(`${kind}: ${[...new Set(list)].slice(0, 6).join(" | ")}`);
      add("dollar", text.match(/\$\s?\d[\d,.]*/g));
      add("hyphen", text.match(/\b[A-Za-z]{2,}-[A-Za-z]{2,}\b/g));
      add("dash", text.match(/.{0,20}(\s-\s|[–—]).{0,20}/g));
      add("usdate", text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}\b/g));
      add("error", text.match(/Application error|Something went wrong|could not be found|Unhandled Runtime Error|NaN|undefined|Invalid Date|\[object Object\]/g));
      const small = [...main.querySelectorAll("*")].filter((el) => {
        if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false;
        const cs = frame.contentWindow.getComputedStyle(el);
        return parseFloat(cs.fontSize) < 11 && cs.visibility !== "hidden" && el.getClientRects().length;
      });
      add("tiny", small.map((el) => `${el.textContent.trim().slice(0, 20)}(${frame.contentWindow.getComputedStyle(el).fontSize})`));
      const sw = doc.documentElement.scrollWidth;
      if (sw > width + 2) {
        const wide = [...doc.body.querySelectorAll("*")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.right > width + 2 && r.width > 0 && !el.closest("[data-scroll-x], .overflow-x-auto, .overflow-auto, .overflow-x-scroll");
          })
          .slice(0, 3)
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")}`);
        issues.push(`overflow ${sw}px: ${wide.join(" | ")}`);
      }
      results.push({ path, ms: Date.now() - started, title: doc.title, issues });
    } catch (e) {
      results.push({ path, issues: [`audit failed: ${e.message}`] });
    }
    frame.remove();
  }
  return results;
};

/** First detail link under each list page, e.g. /dashboard/crm/abc123. */
window.firstDetailLinks = async function firstDetailLinks(listPaths) {
  const out = {};
  for (const path of listPaths) {
    const res = await fetch(path);
    const html = await res.text();
    const re = new RegExp(`href="(${path.replace(/[/]/g, "\\/")}\\/(?!new|import|settings|report|deals|reminders|rules|sequences|duplicates|policy|count|trace|suppliers|work-orders|partners|messages|roles|cost-centers|orders|allocations|profitability|branches)[A-Za-z0-9_-]{8,})"`);
    const m = re.exec(html);
    if (m) out[path] = m[1];
  }
  return out;
};
