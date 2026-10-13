import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The AIBOS lockup: the network mark plus the wordmark, at fixed
 * proportions so it looks the same everywhere it appears.
 *
 * - compact: mark above a small spaced out name, sized for a header or menu
 *            row (the default: sidebar, mobile drawer, landing header, footers)
 * - inline:  mark beside the name
 * - stacked: a large mark above a large name
 *
 * `alwaysDark` is for surfaces that stay dark in the light theme too, such as
 * the public landing pages, so the wordmark does not switch to near black.
 * `onLight` is the opposite: a surface that is always white (the landing
 * page header), so the wordmark is always the brand navy.
 *
 * The PNG has wide transparent padding around the mark; the negative margins
 * trim it so the mark sits tight to the name and lines up with nearby content.
 */
export function Logo({
  layout = "compact",
  alwaysDark = false,
  onLight = false,
  className,
}: {
  layout?: "compact" | "inline" | "stacked";
  alwaysDark?: boolean;
  onLight?: boolean;
  className?: string;
}) {
  const stacked = layout === "stacked";
  if (layout === "compact") {
    return (
      <span className={cn("inline-flex flex-col items-center leading-none", className)}>
        <Image
          src="/logo-mark.png"
          alt=""
          width={48}
          height={48}
          className="-mb-2 -mt-2 shrink-0"
          loading="eager"
        />
        <span
          className={cn(
            "font-display text-[12px] font-extrabold tracking-[0.24em] pl-[0.24em]",
            onLight ? "text-[#0b1f5e]" : "text-white",
            !alwaysDark && !onLight && "light:text-slate-900"
          )}
        >
          AIBOS
        </span>
      </span>
    );
  }
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
          "font-display font-extrabold tracking-tight",
          onLight ? "text-[#0b1f5e]" : "text-white",
          stacked ? "text-2xl" : "text-lg",
          !alwaysDark && !onLight && "light:text-slate-900"
        )}
      >
        AIBOS
      </span>
    </span>
  );
}
