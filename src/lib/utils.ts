import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Business money is South African rand, written the way South Africans
 * read a till slip: "R 1,350.50". The number part stays en-US (comma
 * thousands, dot decimal) like every other number in the app; en-ZA
 * would print "1 350,50", a comma decimal that reads as a different
 * number. A non breaking space keeps the R on the same line as the
 * amount. Subscription prices (Billing, Pricing) are in US dollars and
 * do not use these helpers.
 */
export const CURRENCY_SYMBOL = "R";
export const CURRENCY_PREFIX = `${CURRENCY_SYMBOL} `;
/** Shown in form labels: "Unit price (R)". */
export const CURRENCY_LABEL = `(${CURRENCY_SYMBOL})`;
/** Dates are read in South African time on the server and in the browser alike. */
export const APP_TIME_ZONE = "Africa/Johannesburg";
const DATE_LOCALE = "en-GB";

/** "R 1,234.50"; `cents: false` rounds to "R 1,235". Negatives get a minus: "−R 80.00". */
export function formatCurrency(amount: number, opts: { cents?: boolean } = {}) {
  const cents = opts.cents ?? true;
  const digits = cents ? 2 : 0;
  const text = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const isZero = Number(text.replace(/,/g, "")) === 0;
  return `${amount < 0 && !isZero ? "−" : ""}${CURRENCY_PREFIX}${text}`;
}

/** The same amount for PDFs: their built in fonts have no minus sign, so negatives use "-". */
export function formatCurrencyPlain(amount: number, opts: { cents?: boolean } = {}) {
  return formatCurrency(amount, opts).replace("−", "-");
}

/** "R 1.5K", "R 4.2M", "R 42". */
export function formatCompactCurrency(amount: number) {
  const text = new Intl.NumberFormat("en-US", {
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(Math.abs(amount));
  return `${amount < 0 ? "−" : ""}${CURRENCY_PREFIX}${text}`;
}

function toDate(date: Date | string) {
  return typeof date === "string" ? new Date(date) : date;
}

/** "7 Oct 2026": day first, the way South Africa reads dates, never 10/07/2026. */
export function formatDate(date: Date | string) {
  return toDate(date).toLocaleDateString(DATE_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  });
}

/** "7 Oct", for lists where the year is obvious. */
export function formatDayMonth(date: Date | string) {
  return toDate(date).toLocaleDateString(DATE_LOCALE, { day: "numeric", month: "short", timeZone: APP_TIME_ZONE });
}

/** "7 Oct 2026, 14:30". */
export function formatDateTime(date: Date | string) {
  return toDate(date).toLocaleString(DATE_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  });
}

/** "Oct" or, with `long`, "October 2026": chart axes and month headings. */
export function formatMonth(date: Date | string, long = false) {
  return toDate(date).toLocaleDateString(
    DATE_LOCALE,
    long ? { month: "long", year: "numeric", timeZone: APP_TIME_ZONE } : { month: "short", timeZone: APP_TIME_ZONE },
  );
}

export function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function dateInputDaysFromNow(days: number) {
  return toDateInputValue(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "Wednesday, 7 Oct 2026": headings over a day's agenda. */
export function formatWeekdayDate(date: Date | string) {
  return toDate(date).toLocaleDateString(DATE_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  });
}
