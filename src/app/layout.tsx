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

export const metadata: Metadata = {
  title: "AI Business Operating System",
  description: "The all-in-one AI-powered platform for running your business.",
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
