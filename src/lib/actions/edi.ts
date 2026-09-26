"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { lockedWhere, resolveNewRecordBranch } from "@/lib/branches";
import { logAudit } from "@/lib/audit";
import { formatOf, getEdiSettings, ourParty, reserveControlNumber, shortRef } from "@/lib/edi/settings";
import {
  X12Error,
  buildInterchange,
  parseInterchange,
  pickSku,
  read850,
  segments810,
  segments850,
  segments856,
  segments997,
  validateSeparators,
  type Segment,
} from "@/lib/edi/x12";
import { EdiPartnerFlagsSchema, EdiPartnerSchema, EdiSettingsSchema, MAX_EDI_FILE_BYTES } from "@/lib/validation/edi";

async function requireAdmin(back: string) {
  const session = await verifySession();
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect(`${back}?error=forbidden`);
  return session;
}

const checked = (formData: FormData, name: string) => formData.get(name) === "on";

// ---------- Settings & partners ----------

export async function updateEdiSettings(formData: FormData) {
  const session = await requireAdmin("/dashboard/edi/settings");

  const validated = EdiSettingsSchema.safeParse({
    enabled: checked(formData, "enabled"),
    isaQualifier: formData.get("isaQualifier"),
    isaId: formData.get("isaId"),
    gsId: formData.get("gsId"),
    version: formData.get("version"),
    usageIndicator: formData.get("usageIndicator"),
    elementSeparator: formData.get("elementSeparator"),
    subElementSeparator: formData.get("subElementSeparator"),
    segmentTerminator: formData.get("segmentTerminator"),
  });
  if (!validated.success) redirect("/dashboard/edi/settings?error=invalid");
  if (validateSeparators(validated.data)) redirect("/dashboard/edi/settings?error=edi-separators");

  await db.ediSettings.upsert({
    where: { companyId: session.companyId },
    create: { ...validated.data, companyId: session.companyId },
    update: validated.data,
  });
  await logAudit(session.companyId, session.userId, "edi_settings.updated", "EdiSettings", session.companyId);

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/edi/settings?saved=1");
}

async function ownedIdOrNull(model: "customer" | "supplier", id: string | undefined, companyId: string) {
  if (!id) return null;
  const row =
    model === "customer"
      ? await db.customer.findUnique({ where: { id, companyId }, select: { id: true } })
      : await db.supplier.findUnique({ where: { id, companyId }, select: { id: true } });
  if (!row) redirect("/dashboard/edi/partners?error=invalid");
  return row.id;
}

export async function createEdiPartner(formData: FormData) {
  const session = await requireAdmin("/dashboard/edi/partners");

  const validated = EdiPartnerSchema.safeParse({
    name: formData.get("name"),
    isaQualifier: formData.get("isaQualifier"),
    isaId: formData.get("isaId"),
    gsId: formData.get("gsId"),
    customerId: formData.get("customerId") || undefined,
    supplierId: formData.get("supplierId") || undefined,
    receive850: checked(formData, "receive850"),
    send810: checked(formData, "send810"),
    send856: checked(formData, "send856"),
    send850: checked(formData, "send850"),
    useEdiPrices: checked(formData, "useEdiPrices"),
  });
  if (!validated.success) redirect("/dashboard/edi/partners?error=invalid");

  const { customerId, supplierId, ...rest } = validated.data;
  const duplicate = await db.ediPartner.findUnique({
    where: {
      companyId_isaQualifier_isaId: { companyId: session.companyId, isaQualifier: rest.isaQualifier, isaId: rest.isaId },
    },
    select: { id: true },
  });
  if (duplicate) redirect("/dashboard/edi/partners?error=edi-duplicate-partner");

  const partner = await db.ediPartner.create({
    data: {
      ...rest,
      customerId: await ownedIdOrNull("customer", customerId, session.companyId),
      supplierId: await ownedIdOrNull("supplier", supplierId, session.companyId),
      companyId: session.companyId,
    },
  });
  await logAudit(session.companyId, session.userId, "edi_partner.created", "EdiPartner", partner.id, { name: partner.name });

  revalidatePath("/dashboard/edi/partners");
  redirect("/dashboard/edi/partners?saved=1");
}

export async function updateEdiPartnerFlags(partnerId: string, formData: FormData) {
  const session = await requireAdmin("/dashboard/edi/partners");
  const validated = EdiPartnerFlagsSchema.safeParse({
    enabled: checked(formData, "enabled"),
    receive850: checked(formData, "receive850"),
    send810: checked(formData, "send810"),
    send856: checked(formData, "send856"),
    send850: checked(formData, "send850"),
    useEdiPrices: checked(formData, "useEdiPrices"),
  });
  if (!validated.success) redirect("/dashboard/edi/partners?error=invalid");

  await db.ediPartner.update({ where: { id: partnerId, companyId: session.companyId }, data: validated.data });
  revalidatePath("/dashboard/edi/partners");
  redirect("/dashboard/edi/partners?saved=1");
}

export async function deleteEdiPartner(partnerId: string) {
  const session = await requireAdmin("/dashboard/edi/partners");
  await db.ediPartner.delete({ where: { id: partnerId, companyId: session.companyId } });
  revalidatePath("/dashboard/edi/partners");
}

// ---------- Outbound ----------

type Flag = "send850" | "send810" | "send856";

async function outboundContext(companyId: string, back: string, link: { customerId?: string; supplierId?: string }, flag: Flag) {
  const settings = await getEdiSettings(companyId);
  if (!settings || !settings.enabled) redirect(`${back}?error=edi-setup`);
  const partner = await db.ediPartner.findFirst({
    where: { companyId, enabled: true, [flag]: true, ...link },
    orderBy: { createdAt: "asc" },
  });
  if (!partner) redirect(`${back}?error=edi-no-partner`);
  return { settings, partner };
}

async function storeOutbound(opts: {
  companyId: string;
  userId: string;
  back: string;
  link: { customerId?: string; supplierId?: string };
  flag: Flag;
  docType: "850" | "810" | "856";
  reference: string;
  segments: Segment[];
  record: { orderId?: string; purchaseOrderId?: string; invoiceId?: string };
}) {
  const { settings, partner } = await outboundContext(opts.companyId, opts.back, opts.link, opts.flag);
  const controlNumber = await reserveControlNumber(opts.companyId);
  const content = buildInterchange({
    format: formatOf(settings),
    sender: ourParty(settings),
    receiver: { qualifier: partner.isaQualifier, isaId: partner.isaId, gsId: partner.gsId },
    transactionSet: opts.docType,
    segments: opts.segments,
    controlNumber,
  });
  const doc = await db.ediDocument.create({
    data: {
      direction: "OUTBOUND",
      docType: opts.docType,
      status: "GENERATED",
      controlNumber,
      reference: opts.reference,
      content,
      partnerId: partner.id,
      companyId: opts.companyId,
      ...opts.record,
    },
  });
  await logAudit(opts.companyId, opts.userId, "edi.generated", "EdiDocument", doc.id, { docType: opts.docType });
  revalidatePath("/dashboard/edi");
  revalidatePath(opts.back);
  redirect(`/dashboard/edi/${doc.id}`);
}

export async function generatePurchaseOrder850(purchaseOrderId: string) {
  const back = `/dashboard/procurement/${purchaseOrderId}`;
  const session = await requireAdmin(back);
  const po = await db.purchaseOrder.findUnique({
    where: { id: purchaseOrderId, companyId: session.companyId, ...(await lockedWhere()) },
    include: { supplier: true, companyRef: { select: { name: true } }, items: { include: { product: true } } },
  });
  if (!po) redirect("/dashboard/procurement");
  if (po.items.length === 0) redirect(`${back}?error=edi-empty`);

  const reference = shortRef("PO", po.id);
  await storeOutbound({
    companyId: session.companyId,
    userId: session.userId,
    back,
    link: { supplierId: po.supplierId },
    flag: "send850",
    docType: "850",
    reference,
    record: { purchaseOrderId: po.id },
    segments: segments850({
      number: reference,
      date: po.createdAt,
      expectedDate: po.expectedDate,
      buyerName: po.companyRef.name,
      sellerName: po.supplier.name,
      lines: po.items.map((i) => ({ sku: i.product.sku, quantity: i.quantity, unitPrice: i.unitCost })),
    }),
  });
}

export async function generateInvoice810(invoiceId: string) {
  const back = `/dashboard/invoicing/${invoiceId}`;
  const session = await requireAdmin(back);
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId, companyId: session.companyId, ...(await lockedWhere()) },
    include: {
      customer: true,
      order: { select: { customerPoNumber: true } },
      lineItems: { include: { product: { select: { sku: true } } } },
    },
  });
  if (!invoice) redirect("/dashboard/invoicing");
  if (invoice.lineItems.length === 0) redirect(`${back}?error=edi-empty`);

  await storeOutbound({
    companyId: session.companyId,
    userId: session.userId,
    back,
    link: { customerId: invoice.customerId },
    flag: "send810",
    docType: "810",
    reference: invoice.invoiceNumber,
    record: { invoiceId: invoice.id, orderId: invoice.orderId ?? undefined },
    segments: segments810({
      number: invoice.invoiceNumber,
      date: invoice.issueDate,
      poNumber: invoice.order?.customerPoNumber,
      billTo: invoice.customer.name,
      total: invoice.totalAmount,
      lines: invoice.lineItems.map((l) => ({
        // Free text lines have no product, so the description stands in.
        sku: l.product?.sku ?? l.description.slice(0, 48),
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
    }),
  });
}

export async function generateShipNotice856(orderId: string) {
  const back = `/dashboard/sales/${orderId}`;
  const session = await requireAdmin(back);
  const order = await db.order.findUnique({
    where: { id: orderId, companyId: session.companyId, ...(await lockedWhere()) },
    include: { items: { include: { product: { select: { sku: true } } } } },
  });
  if (!order) redirect("/dashboard/sales");
  if (order.status !== "FULFILLED") redirect(`${back}?error=edi-not-shipped`);

  await storeOutbound({
    companyId: session.companyId,
    userId: session.userId,
    back,
    link: { customerId: order.customerId },
    flag: "send856",
    docType: "856",
    reference: shortRef("SH", order.id),
    record: { orderId: order.id },
    segments: segments856({
      shipmentId: shortRef("SH", order.id),
      date: order.fulfilledAt ?? new Date(),
      orderNumber: shortRef("SO", order.id),
      poNumber: order.customerPoNumber,
      lines: order.items.map((i) => ({ sku: i.product.sku, quantity: i.quantity, unitPrice: i.unitPrice })),
    }),
  });
}

// ---------- Inbound ----------

/**
 * Receives one X12 interchange containing 850 purchase orders from a
 * customer. It is all or nothing: every order in the file is created, or
 * none is and the file is rejected. A 997 goes back either way once the
 * sender is known.
 */
export async function importEdiDocument(formData: FormData) {
  const session = await requireAdmin("/dashboard/edi/import");
  const settings = await getEdiSettings(session.companyId);
  if (!settings || !settings.enabled) redirect("/dashboard/edi/import?error=edi-setup");

  let text = String(formData.get("content") ?? "");
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_EDI_FILE_BYTES) redirect("/dashboard/edi/import?error=edi-too-large");
    text = await file.text();
  }
  if (!text.trim()) redirect("/dashboard/edi/import?error=invalid");
  if (text.length > MAX_EDI_FILE_BYTES) redirect("/dashboard/edi/import?error=edi-too-large");

  const companyId = session.companyId;
  const reject = async (error: string, extra: { docType?: string; partnerId?: string; controlNumber?: number } = {}) => {
    const doc = await db.ediDocument.create({
      data: {
        direction: "INBOUND",
        docType: extra.docType ?? "unknown",
        status: "REJECTED",
        controlNumber: extra.controlNumber ?? 0,
        error,
        content: text,
        partnerId: extra.partnerId,
        companyId,
      },
    });
    return doc;
  };

  let parsed: ReturnType<typeof parseInterchange>;
  try {
    parsed = parseInterchange(text);
  } catch (e) {
    const doc = await reject(e instanceof X12Error ? e.message : "The file couldn't be read as X12.");
    revalidatePath("/dashboard/edi");
    redirect(`/dashboard/edi/${doc.id}`);
  }

  const controlNumber = Number(parsed.controlNumber) || 0;
  const firstGroup = parsed.groups[0];
  const firstSet = firstGroup?.sets[0];
  const docType = firstSet?.type ?? "unknown";

  if (parsed.receiver.qualifier !== settings.isaQualifier || parsed.receiver.id !== settings.isaId) {
    const doc = await reject(
      `This file is addressed to ${parsed.receiver.qualifier}:${parsed.receiver.id}, not to this company (${settings.isaQualifier}:${settings.isaId}).`,
      { docType, controlNumber }
    );
    revalidatePath("/dashboard/edi");
    redirect(`/dashboard/edi/${doc.id}`);
  }

  const partner = await db.ediPartner.findUnique({
    where: {
      companyId_isaQualifier_isaId: { companyId, isaQualifier: parsed.sender.qualifier, isaId: parsed.sender.id },
    },
  });
  if (!partner || !partner.enabled) {
    const doc = await reject(`No enabled trading partner is set up for sender ${parsed.sender.qualifier}:${parsed.sender.id}.`, {
      docType,
      controlNumber,
    });
    revalidatePath("/dashboard/edi");
    redirect(`/dashboard/edi/${doc.id}`);
  }

  // Validate every set before creating anything.
  let problem: string | null = null;
  const orders: { poNumber: string; items: { productId: string; quantity: number; unitPrice: number }[] }[] = [];
  try {
    if (!partner.receive850 || !partner.customerId) {
      throw new X12Error(`${partner.name} isn't set up to send purchase orders to this company.`);
    }
    const sets = parsed.groups.flatMap((g) => g.sets);
    if (sets.length === 0) throw new X12Error("The file has no transaction sets.");

    const allSkus = new Set<string>();
    const read = sets.map((set) => {
      const po = read850(set);
      for (const line of po.lines) {
        const sku = pickSku(line.productIds);
        if (!sku) throw new X12Error(`Line ${line.lineNumber} on ${po.poNumber} has no product ID.`);
        allSkus.add(sku);
      }
      return po;
    });

    const products = await db.product.findMany({
      where: { companyId, sku: { in: [...allSkus] } },
      select: { id: true, sku: true, unitPrice: true },
    });
    const bySku = new Map(products.map((p) => [p.sku, p]));
    const unknown = [...allSkus].filter((s) => !bySku.has(s));
    if (unknown.length > 0) throw new X12Error(`Unknown product SKUs: ${unknown.join(", ")}.`);

    const poNumbers = read.map((po) => po.poNumber);
    if (new Set(poNumbers).size !== poNumbers.length) throw new X12Error("The same PO number appears twice in this file.");
    const existing = await db.order.findMany({
      where: { companyId, customerId: partner.customerId, customerPoNumber: { in: poNumbers } },
      select: { customerPoNumber: true },
    });
    if (existing.length > 0) {
      throw new X12Error(`Already received: ${existing.map((o) => o.customerPoNumber).join(", ")}. Nothing was imported twice.`);
    }

    for (const po of read) {
      orders.push({
        poNumber: po.poNumber,
        items: po.lines.map((line) => {
          const product = bySku.get(pickSku(line.productIds)!)!;
          const unitPrice = partner.useEdiPrices && line.unitPrice !== null ? line.unitPrice : product.unitPrice;
          return { productId: product.id, quantity: line.quantity, unitPrice };
        }),
      });
    }
  } catch (e) {
    if (!(e instanceof X12Error)) throw e;
    problem = e.message;
  }

  const inbound = problem
    ? await reject(problem, { docType, partnerId: partner.id, controlNumber })
    : await db.$transaction(async (tx) => {
        const created = [];
        const branchId = await resolveNewRecordBranch();
        for (const o of orders) {
          created.push(
            await tx.order.create({
              data: {
                companyId,
                branchId,
                customerId: partner.customerId!,
                customerPoNumber: o.poNumber,
                totalAmount: o.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
                items: { create: o.items },
              },
              select: { id: true },
            })
          );
        }
        return tx.ediDocument.create({
          data: {
            direction: "INBOUND",
            docType,
            status: "PROCESSED",
            controlNumber,
            reference: orders.map((o) => o.poNumber).join(", "),
            content: text,
            partnerId: partner.id,
            orderId: created[0]?.id,
            companyId,
          },
        });
      });

  // Acknowledge the first group and set, accepted or rejected.
  if (firstGroup && firstSet) {
    const ackControl = await reserveControlNumber(companyId);
    const ack = await db.ediDocument.create({
      data: {
        direction: "OUTBOUND",
        docType: "997",
        status: "GENERATED",
        controlNumber: ackControl,
        reference: `Ack ${parsed.controlNumber}`,
        content: buildInterchange({
          format: formatOf(settings),
          sender: ourParty(settings),
          receiver: { qualifier: partner.isaQualifier, isaId: partner.isaId, gsId: partner.gsId },
          transactionSet: "997",
          segments: segments997({
            functionalId: firstGroup.functionalId,
            groupControlNumber: firstGroup.controlNumber,
            setType: firstSet.type,
            setControlNumber: firstSet.controlNumber,
            accepted: !problem,
          }),
          controlNumber: ackControl,
        }),
        partnerId: partner.id,
        acknowledgesId: inbound.id,
        companyId,
      },
    });
    await db.ediDocument.update({ where: { id: inbound.id }, data: { acknowledgesId: ack.id } });
  }

  await logAudit(companyId, session.userId, "edi.received", "EdiDocument", inbound.id, {
    status: problem ? "REJECTED" : "PROCESSED",
    orders: orders.length,
  });

  revalidatePath("/dashboard/edi");
  revalidatePath("/dashboard/sales");
  redirect(`/dashboard/edi/${inbound.id}`);
}
