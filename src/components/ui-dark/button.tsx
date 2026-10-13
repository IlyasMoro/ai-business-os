import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  // The brand cyan with dark ink, the same as the website's main buttons,
  // so signing up and working in the app feel like one product.
  primary:
    "border border-cyan-300/60 bg-cyan-400 font-semibold text-[#0a1428] hover:bg-cyan-300 hover:shadow-[0_0_24px_-6px_rgb(34_211_238/0.7)] " +
    "light:border-cyan-500/50 light:text-[#0a1428]",
  secondary:
    "border border-white/[0.08] bg-white/[0.04] backdrop-blur-md text-slate-200 hover:border-white/10 hover:bg-white/5 " +
    "light:border-slate-300 light:bg-white/70 light:text-slate-700 light:hover:border-slate-400 light:hover:bg-white",
  ghost:
    "text-slate-400 hover:bg-white/5 hover:text-slate-50 " +
    "light:text-slate-500 light:hover:bg-slate-100 light:hover:text-slate-900",
  danger:
    "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 " +
    "light:text-red-700 light:hover:bg-red-500/20",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-[color,background-color,border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 light:focus-visible:ring-offset-white disabled:opacity-50 disabled:pointer-events-none";

/** Button look for elements that can't be <Button>/<LinkButton>, such as a
 * plain <a> pointing at a file download route. */
export function buttonStyles(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variantClasses[variant], sizeClasses[size], className);
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={cn(base, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    />
  );
}

export function LinkButton({
  className,
  variant = "primary",
  size = "md",
  href,
  children,
}: {
  className?: string;
  variant?: Variant;
  size?: Size;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(base, variantClasses[variant], sizeClasses[size], className)}
    >
      {children}
    </Link>
  );
}
