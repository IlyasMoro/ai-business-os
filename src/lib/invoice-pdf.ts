import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type InvoicePdfData = {
  invoiceNumber: string;
  status: string;
  issueDate: Date;
  dueDate: Date;
  totalAmount: number;
  companyName: string;
  customerName: string;
  customerEmail: string | null;
  lineItems: { description: string; quantity: number; unitPrice: number }[];
};

export async function generateInvoicePdf(invoice: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = 792;
  const black = rgb(0.1, 0.1, 0.1);
  const gray = rgb(0.45, 0.45, 0.45);

  function text(content: string, x: number, size: number, useFont = font, color = black) {
    page.drawText(content, { x, y, size, font: useFont, color });
  }

  text(invoice.companyName, margin, 20, bold);
  text(`Invoice ${invoice.invoiceNumber}`, 400, 20, bold);
  y -= 30;
  text(`Status: ${invoice.status}`, 400, 10, font, gray);
  y -= 40;

  text("Bill to:", margin, 10, bold);
  y -= 15;
  text(invoice.customerName, margin, 11);
  y -= 14;
  if (invoice.customerEmail) {
    text(invoice.customerEmail, margin, 10, font, gray);
    y -= 14;
  }

  y -= 10;
  text(`Issue date: ${invoice.issueDate.toLocaleDateString()}`, margin, 10, font, gray);
  text(`Due date: ${invoice.dueDate.toLocaleDateString()}`, 300, 10, font, gray);
  y -= 30;

  text("Description", margin, 10, bold);
  text("Qty", 340, 10, bold);
  text("Unit price", 400, 10, bold);
  text("Amount", 490, 10, bold);
  y -= 8;
  page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.5, color: gray });
  y -= 16;

  for (const item of invoice.lineItems) {
    text(item.description.slice(0, 45), margin, 10);
    text(String(item.quantity), 340, 10);
    text(`$${item.unitPrice.toFixed(2)}`, 400, 10);
    text(`$${(item.quantity * item.unitPrice).toFixed(2)}`, 490, 10);
    y -= 18;
  }

  y -= 10;
  page.drawLine({ start: { x: 340, y }, end: { x: 545, y }, thickness: 0.5, color: gray });
  y -= 20;
  text("Total", 400, 12, bold);
  text(`$${invoice.totalAmount.toFixed(2)}`, 490, 12, bold);

  return doc.save();
}
