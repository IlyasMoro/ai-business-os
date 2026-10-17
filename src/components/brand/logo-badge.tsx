import Image from "next/image";
import { cn } from "@/lib/utils";
import styles from "@/components/landing/landing.module.css";

/**
 * The AIBOS mark in its dark round badge, with the name beside it: the
 * lockup of the landing page's nav bar and footer, also used by the app's
 * menu. `iconOnly` drops the name (the shrunk menu). The name is white on
 * dark surfaces, near black on the light theme unless `onDark` is set.
 */
export function LogoBadge({ iconOnly = false, onDark = false, className }: { iconOnly?: boolean; onDark?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className={styles.navBadge} aria-hidden>
        <Image src="/logo-mark.png" alt="" width={64} height={64} priority />
      </span>
      {!iconOnly && (
        <span
          className={cn(
            "font-display text-[15px] font-extrabold tracking-[0.18em] text-white",
            !onDark && "light:text-[#0b0f17]"
          )}
        >
          AIBOS
        </span>
      )}
    </span>
  );
}
