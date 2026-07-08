import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldBase =
  "block w-full rounded-md border border-white/[0.06] bg-[#1A2238] px-3 py-2 text-sm text-slate-50 outline-none transition-colors duration-150 placeholder:text-slate-500 hover:border-slate-700 focus:border-blue-500";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, className)} {...props} />;
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldBase, className)} {...props} />;
}

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1 block text-sm font-medium text-slate-300", className)}
      {...props}
    />
  );
}

export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-sm text-red-400">{messages[0]}</p>;
}
