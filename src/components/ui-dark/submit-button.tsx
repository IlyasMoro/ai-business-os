"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui-dark/button";

export function SubmitButton({
  children,
  pendingText,
  variant,
  className,
}: {
  children: React.ReactNode;
  pendingText: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} className={className}>
      {pending ? pendingText : children}
    </Button>
  );
}
