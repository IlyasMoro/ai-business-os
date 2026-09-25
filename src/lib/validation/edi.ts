import * as z from "zod";
import { X12_VERSIONS } from "@/lib/edi/x12";

// ISA qualifiers are 2 characters and IDs at most 15; GS IDs up to 15.
// Only letters, digits and a few safe symbols, so they can never clash
// with the separators.
const qualifier = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2}$/, { error: "Qualifier must be 2 letters or digits." });
const isaId = z.string().trim().toUpperCase().regex(/^[A-Z0-9 .]{1,15}$/, { error: "Use up to 15 letters or digits." });
const gsId = z.string().trim().toUpperCase().regex(/^[A-Z0-9 .]{2,15}$/, { error: "Use 2 to 15 letters or digits." });
const separator = z.string().length(1);

export const EdiSettingsSchema = z.object({
  enabled: z.boolean(),
  isaQualifier: qualifier,
  isaId,
  gsId,
  version: z.enum(X12_VERSIONS),
  usageIndicator: z.enum(["T", "P"]),
  elementSeparator: separator,
  subElementSeparator: separator,
  segmentTerminator: separator,
});

export const EdiPartnerSchema = z
  .object({
    name: z.string().trim().min(1, { error: "Name is required." }).max(200),
    isaQualifier: qualifier,
    isaId,
    gsId,
    customerId: z.string().optional(),
    supplierId: z.string().optional(),
    receive850: z.boolean(),
    send810: z.boolean(),
    send856: z.boolean(),
    send850: z.boolean(),
    useEdiPrices: z.boolean(),
  })
  .refine((p) => p.customerId || p.supplierId, { error: "Link the partner to a customer, a supplier, or both." });

export const EdiPartnerFlagsSchema = z.object({
  enabled: z.boolean(),
  receive850: z.boolean(),
  send810: z.boolean(),
  send856: z.boolean(),
  send850: z.boolean(),
  useEdiPrices: z.boolean(),
});

export const MAX_EDI_FILE_BYTES = 1_000_000;
