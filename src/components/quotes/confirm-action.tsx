"use client";

import { useFormStatus } from "react-dom";
import { buttonStyles } from "@/components/ui-dark/button";

function Submit({ children, variant }: { children: React.ReactNode; variant: "primary" | "secondary" | "ghost" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonStyles(variant, "sm")}>
      {pending ? "Working..." : children}
    </button>
  );
}

/** A one button form for a server action, asking first when `confirmMessage` is set. */
export function ActionButton({
  action,
  confirmMessage,
  variant = "secondary",
  children,
}: {
  action: () => Promise<void>;
  confirmMessage?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirmMessage && !confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <Submit variant={variant}>{children}</Submit>
    </form>
  );
}
