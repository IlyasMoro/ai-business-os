import "server-only";
import { PDFDocument, StandardFonts, rgb, type RGB } from "pdf-lib";

// Same palette as the on-screen charts (src/components/dash-viz/colors.ts),
// converted to pdf-lib's 0-1 RGB range so the emailed/downloaded report
// visually matches the dashboard rather than inventing a second palette.
const HEX = { blue: "#3b82f6", amber: "#d97706", emerald: "#059669", red: "#ef4444", muted: "#64748b" };

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const COLOR = {
  blue: hexToRgb(HEX.blue),
  amber: hexToRgb(HEX.amber),
  emerald: hexToRgb(HEX.emerald),
  red: hexToRgb(HEX.red),
  muted: hexToRgb(HEX.muted),
  black: rgb(0.1, 0.1, 0.1),
  gray: rgb(0.45, 0.45, 0.45),
  lightGray: rgb(0.85, 0.85, 0.85),
};

/** SVG arc path for one pie slice, angles in radians measured clockwise
 * from the top (12 o'clock), matching how the on-screen DonutChart draws. */
function pieSlicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const a0 = startAngle - Math.PI / 2;
  const a1 = endAngle - Math.PI / 2;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx},${cy} L ${x0},${y0} A ${r},${r} 0 ${largeArc} 1 ${x1},${y1} Z`;
}

export type ReportSlice = { label: string; value: number; color: RGB };
export type ReportMonth = { label: string; income: number; expense: number };

export type BusinessReportData = {
  companyName: string;
  generatedAt: Date;
  totalIncome: number;
  totalExpense: number;
  monthly: ReportMonth[];
  orderStatusSlices: ReportSlice[];
  invoiceStatusSlices: ReportSlice[];
  logoData?: Uint8Array;
  logoMimeType?: string | null;
};

const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export async function generateBusinessReportPdf(data: BusinessReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = 792;

  function text(content: string, x: number, size: number, useFont = font, color = COLOR.black) {
    page.drawText(content, { x, y, size, font: useFont, color });
  }

  // ---- Header ----
  if (data.logoData && data.logoMimeType) {
    const image =
      data.logoMimeType === "image/png" ? await doc.embedPng(data.logoData) : await doc.embedJpg(data.logoData);
    const height = 36;
    const width = Math.min((image.width / image.height) * height, 140);
    page.drawImage(image, { x: margin, y: y - height + 8, width, height });
    y -= height + 14;
  }

  text(data.companyName, margin, 20, bold);
  text("Business Report", 400, 20, bold);
  y -= 22;
  text(`Generated ${data.generatedAt.toLocaleDateString()} (trailing 6 months)`, margin, 10, font, COLOR.gray);
  y -= 30;
  page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 0.75, color: COLOR.lightGray });
  y -= 30;

  // ---- KPI row ----
  const net = data.totalIncome - data.totalExpense;
  const kpis: [string, string, RGB][] = [
    ["Income (6mo)", money(data.totalIncome), COLOR.emerald],
    ["Expenses (6mo)", money(data.totalExpense), COLOR.red],
    ["Net (6mo)", money(net), net >= 0 ? COLOR.black : COLOR.red],
  ];
  kpis.forEach(([label, value, color], i) => {
    const x = margin + i * 165;
    page.drawText(label, { x, y, size: 9, font, color: COLOR.gray });
    page.drawText(value, { x, y: y - 18, size: 16, font: bold, color });
  });
  y -= 55;

  // ---- Bar chart: income vs expense per month ----
  text("Revenue vs expenses", margin, 12, bold);
  y -= 20;
  const chartTop = y;
  const chartHeight = 120;
  const chartBottom = chartTop - chartHeight;
  const maxVal = Math.max(1, ...data.monthly.flatMap((m) => [m.income, m.expense]));
  const groupWidth = (545 - margin) / data.monthly.length;
  const barWidth = Math.min(22, groupWidth / 3);

  page.drawLine({ start: { x: margin, y: chartBottom }, end: { x: 545, y: chartBottom }, thickness: 0.75, color: COLOR.lightGray });

  data.monthly.forEach((m, i) => {
    const groupX = margin + i * groupWidth + groupWidth / 2;
    const incomeH = (m.income / maxVal) * chartHeight;
    const expenseH = (m.expense / maxVal) * chartHeight;
    page.drawRectangle({
      x: groupX - barWidth - 2,
      y: chartBottom,
      width: barWidth,
      height: Math.max(1, incomeH),
      color: COLOR.emerald,
    });
    page.drawRectangle({
      x: groupX + 2,
      y: chartBottom,
      width: barWidth,
      height: Math.max(1, expenseH),
      color: COLOR.red,
    });
    page.drawText(m.label, {
      x: groupX - 10,
      y: chartBottom - 14,
      size: 8,
      font,
      color: COLOR.gray,
    });
  });

  // legend
  page.drawRectangle({ x: margin, y: chartTop + 4, width: 8, height: 8, color: COLOR.emerald });
  page.drawText("Income", { x: margin + 12, y: chartTop + 4, size: 8, font, color: COLOR.gray });
  page.drawRectangle({ x: margin + 60, y: chartTop + 4, width: 8, height: 8, color: COLOR.red });
  page.drawText("Expenses", { x: margin + 72, y: chartTop + 4, size: 8, font, color: COLOR.gray });

  y = chartBottom - 40;

  // ---- Pie charts: order status / invoice status ----
  function drawPie(centerX: number, centerLabel: string, slices: ReportSlice[]) {
    const r = 42;
    const cy = y - r;
    const total = slices.reduce((s, sl) => s + sl.value, 0);
    let angle = 0;
    if (total === 0) {
      page.drawEllipse({ x: centerX, y: cy, xScale: r, yScale: r, color: COLOR.lightGray });
    } else {
      for (const slice of slices) {
        if (slice.value <= 0) continue;
        const sweep = (slice.value / total) * Math.PI * 2;
        page.drawSvgPath(pieSlicePath(centerX, cy, r, angle, angle + sweep), { x: 0, y: 0, color: slice.color });
        angle += sweep;
      }
    }
    page.drawText(centerLabel, { x: centerX - font.widthOfTextAtSize(centerLabel, 9) / 2, y: cy - r - 16, size: 9, font: bold, color: COLOR.black });

    let legendY = cy - r - 32;
    for (const slice of slices) {
      page.drawRectangle({ x: centerX - 55, y: legendY, width: 7, height: 7, color: slice.color });
      page.drawText(`${slice.label} (${slice.value})`, { x: centerX - 44, y: legendY, size: 7.5, font, color: COLOR.gray });
      legendY -= 12;
    }
  }

  drawPie(160, "Orders by status", data.orderStatusSlices);
  drawPie(430, "Invoices by status", data.invoiceStatusSlices);

  return doc.save();
}
