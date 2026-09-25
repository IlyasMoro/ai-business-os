import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { X12Format, X12Party, X12Version } from "@/lib/edi/x12";

export const getEdiSettings = cache(async (companyId: string) => {
  return db.ediSettings.findUnique({ where: { companyId } });
});

type Settings = NonNullable<Awaited<ReturnType<typeof getEdiSettings>>>;

export function formatOf(s: Settings): X12Format {
  return {
    version: s.version as X12Version,
    usageIndicator: s.usageIndicator === "P" ? "P" : "T",
    elementSeparator: s.elementSeparator,
    subElementSeparator: s.subElementSeparator,
    segmentTerminator: s.segmentTerminator,
  };
}

export function ourParty(s: Settings): X12Party {
  return { qualifier: s.isaQualifier, isaId: s.isaId, gsId: s.gsId };
}

/** Reserves the next interchange control number atomically. */
export async function reserveControlNumber(companyId: string): Promise<number> {
  const updated = await db.ediSettings.update({
    where: { companyId },
    data: { nextControlNumber: { increment: 1 } },
    select: { nextControlNumber: true },
  });
  // X12 control numbers are 9 digits; wrap rather than overflow.
  return ((updated.nextControlNumber - 2) % 999_999_999) + 1;
}

/** Short, stable reference for records that don't have their own number. */
export function shortRef(prefix: string, id: string) {
  return `${prefix}${id.slice(-8).toUpperCase()}`;
}
