import { cn } from "@/lib/utils";
import type { ComponentPropsWithRef, LabelHTMLAttributes } from "react";

const fieldBase =
  "block w-full rounded-md border border-white/[0.06] bg-[#111111] px-3 py-2 text-sm text-white caret-white outline-none transition-colors duration-150 placeholder:text-slate-500 hover:border-slate-700 focus:border-blue-500 " +
  "light:border-slate-300 light:bg-white light:text-slate-900 light:caret-slate-900 light:placeholder:text-slate-400 light:hover:border-slate-400";

export function Input({ className, ...props }: ComponentPropsWithRef<"input">) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithRef<"textarea">) {
  return <textarea className={cn(fieldBase, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentPropsWithRef<"select">) {
  return <select className={cn(fieldBase, className)} {...props} />;
}

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1 block text-sm font-medium text-slate-300 light:text-slate-600", className)}
      {...props}
    />
  );
}

export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-sm text-red-400 light:text-red-600">{messages[0]}</p>;
}
