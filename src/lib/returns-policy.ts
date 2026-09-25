import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { DEFAULT_RETURN_POLICY, type ReturnPolicyValues } from "@/lib/returns-policy-presets";

export const getReturnPolicy = cache(async (companyId: string): Promise<ReturnPolicyValues> => {
  const policy = await db.returnPolicy.findUnique({
    where: { companyId },
    select: {
      enabled: true,
      windowDays: true,
      requireApproval: true,
      restockingFeePercent: true,
      restockDamaged: true,
      reasons: true,
    },
  });
  return policy ?? DEFAULT_RETURN_POLICY;
});
