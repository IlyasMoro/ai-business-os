import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type PayslipData = {
  companyName: string;
  employeeName: string;
  position: string | null;
  periodStart: Date;
  periodEnd: Date;
  grossPay: number;
  deductions: number;
  netPay: number;
};

export async function generatePayslipPdf(data: PayslipData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 400]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = 350;
  const black = rgb(0.1, 0.1, 0.1);
  const gray = rgb(0.45, 0.45, 0.45);

  function text(content: string, x: number, size: number, useFont = font, color = black) {
    page.drawText(content, { x, y, size, font: useFont, color });
  }

  text(data.companyName, margin, 18, bold);
  text("Payslip", 480, 18, bold);
  y -= 26;
  text(
    `Pay period: ${data.periodStart.toLocaleDateString()} - ${data.periodEnd.toLocaleDateString()}`,
    margin,
    10,
    font,
    gray
  );
  y -= 40;

  text("Employee", margin, 10, bold);
  y -= 15;
  text(data.employeeName, margin, 12);
  if (data.position) {
    y -= 14;
    text(data.position, margin, 10, font, gray);
  }
  y -= 30;

  text("Gross pay", margin, 10, font, gray);
  text(`$${data.grossPay.toFixed(2)}`, 480, 10);
  y -= 18;
  text("Deductions", margin, 10, font, gray);
  text(`-$${data.deductions.toFixed(2)}`, 480, 10);
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.5, color: gray });
  y -= 20;
  text("Net pay", margin, 12, bold);
  text(`$${data.netPay.toFixed(2)}`, 480, 12, bold);

  return doc.save();
}
