import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20",
  secondary:
    "border border-slate-800 bg-slate-900/60 text-slate-200 hover:border-slate-700 hover:bg-slate-800",
  ghost: "text-slate-400 hover:bg-slate-900 hover:text-white",
  danger:
    "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:pointer-events-none";

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
