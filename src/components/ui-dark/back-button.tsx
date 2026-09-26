import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonStyles } from "@/components/ui-dark/button";

/** The "Back to …" button at the top of detail and settings pages. */
export function BackButton({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link href={href} className={buttonStyles("secondary", "sm", `mb-5 w-fit gap-1.5 ${className ?? ""}`)}>
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}
