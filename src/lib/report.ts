// PDF report generation with jsPDF + autotable. All data comes from the
// live analytics/inventory/customers queries — nothing is hardcoded here;
// the caller passes the current business records.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDay, formatKES } from "./format";

export interface ReportData {
  businessName: string;
  businessType: string;
  rangeLabel: string;
  generatedAt: number;
  overview: {
    sales: number;
    salesCount: number;
    expenses: number;
    purchases: number;
    payments: number;
    profit: number;
    stockValue: number;
    lowStockCount: number;
    productCount: number;
    totalCustomers: number;
    outstandingDebt: number;
    topProducts: Array<{ name: string; total: number }>;
  };
  inventory: Array<{
    productName: string;
    quantity: number;
    costPrice: number;
    sellingPrice: number;
    lowStockThreshold: number;
  }>;
  customers: Array<{
    name: string;
    totalSpent: number;
    balance: number;
    phone?: string;
  }>;
  dailySeries: Array<{
    label: string;
    sales: number;
    expenses: number;
    purchases: number;
    profit: number;
  }>;
}

const GREEN: [number, number, number] = [16, 154, 116];
const DARK: [number, number, number] = [20, 30, 28];
const MUTED: [number, number, number] = [110, 125, 120];

export function generateReportPdf(data: ReportData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 0;

  // ---- Header band ----
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageWidth, 110, "F");
  doc.setFillColor(...GREEN);
  doc.rect(0, 108, pageWidth, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Smart Hustle AI", margin, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(180, 200, 195);
  doc.text(`${data.businessName} — ${data.businessType}`, margin, 64);
  doc.text(
    `Business report · ${data.rangeLabel} · generated ${formatDay(data.generatedAt)} ${new Date(
      data.generatedAt + 3 * 3600_000,
    )
      .toISOString()
      .slice(11, 16)} EAT`,
    margin,
    82,
  );

  y = 140;

  // ---- Profit & loss summary ----
  const o = data.overview;
  autoTable(doc, {
    startY: y,
    head: [["Profit & loss", "Amount"]],
    body: [
      ["Sales", formatKES(o.sales)],
      [`Sales transactions: ${o.salesCount}`, ""],
      ["Operating expenses", `− ${formatKES(o.expenses)}`],
      ["Stock purchases", `− ${formatKES(o.purchases)}`],
      ["Net profit", formatKES(o.profit)],
      ["Outstanding customer debt", formatKES(o.outstandingDebt)],
    ],
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: GREEN, textColor: 255 },
    alternateRowStyles: { fillColor: [245, 250, 248] },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 28;

  // ---- KPI strip ----
  autoTable(doc, {
    startY: y,
    head: [["Inventory", "Value"], ["Customers", "Value"]],
    body: [
      [
        "Products in stock",
        String(o.productCount),
        "Customers",
        String(o.totalCustomers),
      ],
      [
        "Stock value (at cost)",
        formatKES(o.stockValue),
        "Customers with balance",
        String(data.customers.filter((c) => c.balance > 0).length),
      ],
      [
        "Low-stock products",
        String(o.lowStockCount),
        "Debt collected this period",
        formatKES(data.overview.payments),
      ],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 4 },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 28;

  // ---- Top products ----
  if (o.topProducts.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Top products", "Revenue"]],
      body: o.topProducts.map((p) => [p.name, formatKES(p.total)]),
      theme: "striped",
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: GREEN, textColor: 255 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 28;
  }

  // ---- Inventory summary ----
  if (data.inventory.length > 0) {
    doc.addPage();
    y = 40;
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Inventory summary", margin, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [["Product", "Stock", "Alert at", "Cost", "Selling", "Stock value", "Status"]],
      body: data.inventory.map((i) => [
        i.productName,
        String(i.quantity),
        String(i.lowStockThreshold),
        formatKES(i.costPrice),
        formatKES(i.sellingPrice),
        formatKES(i.costPrice * i.quantity),
        ...(i.quantity <= i.lowStockThreshold ? ["⚠ Low"] : ["OK"]),
      ]),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: GREEN, textColor: 255 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 28;
  }

  // ---- Customers ----
  if (data.customers.length > 0) {
    if (y > 700) {
      doc.addPage();
      y = 40;
    }
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Customer summary", margin, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [["Customer", "Total spent", "Balance", "Phone"]],
      body: data.customers
        .slice(0, 30)
        .map((c) => [
          c.name,
          formatKES(c.totalSpent),
          formatKES(c.balance),
          c.phone ?? "—",
        ]),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: GREEN, textColor: 255 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 28;
  }

  // ---- Daily series ----
  if (data.dailySeries.length > 0) {
    doc.addPage();
    y = 40;
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Daily performance", margin, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [["Day", "Sales", "Expenses", "Purchases", "Profit"]],
      body: data.dailySeries.map((d) => [
        d.label,
        formatKES(d.sales),
        formatKES(d.expenses),
        formatKES(d.purchases),
        formatKES(d.profit),
      ]),
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: GREEN, textColor: 255 },
      margin: { left: margin, right: margin },
    });
  }

  // ---- Footer on last page ----
  const last = doc.internal.pageSize.getHeight();
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Generated by Smart Hustle AI — run your business through chat.",
    margin,
    last - 20,
  );

  return doc;
}

export function downloadReport(data: ReportData): void {
  const doc = generateReportPdf(data);
  const d = new Date(data.generatedAt + 3 * 3600_000);
  const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
  doc.save(`smart-hustle-report-${ym}.pdf`);
}
