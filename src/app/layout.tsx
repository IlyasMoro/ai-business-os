import type { Metadata } from "next";
import { Jost, Geist_Mono } from "next/font/google";
import "./globals.css";

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description = "The all in one AI powered platform for running your business.";
const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "AIBOS",
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
    if (localStorage.getItem("theme") === "light") {
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
      className={`${jost.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-black text-white light:bg-white light:text-slate-900">
        {children}
      </body>
    </html>
  );
}
