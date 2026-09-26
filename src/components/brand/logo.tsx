import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The AIBOS lockup: the network mark plus the wordmark, at fixed
 * proportions so it looks the same everywhere it appears.
 *
 * - inline:  mark beside the name (sidebar, mobile drawer, landing header)
 * - stacked: mark above the name (sign in, sign up and other auth cards)
 *
 * `alwaysDark` is for surfaces that stay dark in the light theme too, such as
 * the public landing pages, so the wordmark does not switch to near black.
 *
 * The PNG has wide transparent padding around the mark; the negative margins
 * trim it so the mark sits tight to the name and lines up with nearby content.
 */
export function Logo({
  layout = "inline",
  alwaysDark = false,
  className,
}: {
  layout?: "inline" | "stacked";
  alwaysDark?: boolean;
  className?: string;
}) {
  const stacked = layout === "stacked";
  return (
    <span className={cn("flex items-center", stacked ? "flex-col" : "gap-0", className)}>
      <Image
        src="/logo-mark.png"
        alt=""
        width={stacked ? 72 : 48}
        height={stacked ? 72 : 48}
        className={cn("shrink-0", stacked ? "-my-2" : "-my-2 -ml-2.5 -mr-1.5")}
        loading="eager"
      />
      <span
        className={cn(
          "font-display font-extrabold tracking-tight text-white",
          stacked ? "text-2xl" : "text-lg",
          !alwaysDark && "light:text-slate-900"
        )}
      >
        AIBOS
      </span>
    </span>
  );
}
