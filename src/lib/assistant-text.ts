/* Brings AI Copilot replies into the app's house style. The model often
   writes numbers with narrow spaces ("R 3 292.03") and joins words with
   special hyphens ("Past‑due"); the app writes R 3,292.03 and uses no
   hyphens or dashes in text people read. Pure, so it can be tested. */

const THOUSANDS = /(\d)[\u202f\u2009](?=\d{3}(?!\d))/g;
const WORD_HYPHEN = /([A-Za-z])[\u2010\u2011-]([A-Za-z])/g;

export function tidyAssistantText(text: string): string {
  let out = text.replace(/\bR[\u202f\u2009 ]?(?=\d)/g, "R\u00a0");
  // Repeat until stable: "1 234 567" needs two passes.
  for (let prev = ""; prev !== out; ) {
    prev = out;
    out = out.replace(THOUSANDS, "$1,");
  }
  // Hyphens inside words become a space, but leave links, emails and
  // codes alone (anything without spaces around it that looks technical).
  out = out
    .split(/(\s+)/)
    .map((token) => (/[/@_:]|\d/.test(token) || /^[A-Z0-9-]+$/.test(token) ? token : token.replace(WORD_HYPHEN, "$1 $2")))
    .join("");
  // Dashes between words read as a pause: a comma. Narrow spaces the model
  // puts between ordinary words become normal ones.
  return out.replace(/\s*[\u2013\u2014]\s*/g, ", ").replace(/[\u202f\u2009]/g, " ");
}
