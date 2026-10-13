import type { Metadata } from "next";
import { Figtree, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// The same pair as StockPilot: Figtree is the display face for page titles,
// landing headings and the wordmark; Plus Jakarta Sans is the body and UI
// text. Both are variable fonts, so in between weights (see .app-text in
// globals.css) render exactly rather than snapping to the nearest file.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description = "The all in one AI powered platform for running your business.";
const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: { default: "AIBOS", template: "%s · AIBOS" },
  description,
  openGraph: {
    title: "AIBOS",
    description,
    siteName: "AIBOS",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AIBOS",
    description,
  },
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    // "light", "dark" (the default) or "system", set from the account menu.
    var theme = localStorage.getItem("theme");
    if (theme === "light" || (theme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches)) {
      document.documentElement.classList.add("light");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${jakarta.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col text-white light:text-slate-900">
        {children}
      </body>
    </html>
  );
}
