"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// react-markdown never renders raw HTML from the model's output, so a reply
// can format text (bold, lists, tables, code) but cannot inject markup.
const components: Components = {
  p: ({ children }) => <p className="leading-relaxed [&:not(:first-child)]:mt-3">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold text-white light:text-slate-950">{children}</strong>
  ),
  ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-slate-500">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5 marker:text-slate-500">{children}</ol>,
  h1: ({ children }) => <h4 className="mt-4 font-semibold first:mt-0">{children}</h4>,
  h2: ({ children }) => <h4 className="mt-4 font-semibold first:mt-0">{children}</h4>,
  h3: ({ children }) => <h4 className="mt-4 font-semibold first:mt-0">{children}</h4>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-blue-400 underline underline-offset-2 hover:text-blue-300 light:text-blue-700"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.85em] light:bg-slate-900/[0.06]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs light:bg-slate-900/[0.05] [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mt-3 overflow-x-auto rounded-lg border border-white/[0.08] light:border-slate-200">
      <table className="w-full text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-white/[0.04] text-slate-300 light:bg-slate-900/[0.03] light:text-slate-600">{children}</thead>
  ),
  th: ({ children }) => <th className="px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => (
    <td className="border-t border-white/[0.06] px-3 py-2 tabular-nums light:border-slate-200">{children}</td>
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
