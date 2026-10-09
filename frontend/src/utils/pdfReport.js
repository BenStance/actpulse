// src/utils/pdfReport.js
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/* ------------------------------------------------------------------ */
/*  Brand tokens                                                      */
/* ------------------------------------------------------------------ */
export const PDF_BRAND = {
  primary: [6, 71, 137],        // #064789
  primaryLight: [66, 122, 161], // #427aa1
  accent: [235, 242, 250],      // #ebf2fa
  text: [15, 23, 42],           // slate-900
  textMuted: [100, 116, 139],   // slate-500
  border: [226, 232, 240],      // slate-200
  surface: [248, 250, 252],     // slate-50
  success: [16, 185, 129],
  warning: [245, 158, 11],
  danger: [239, 68, 68],
};

const PAGE = {
  width: 210,
  height: 297,
  marginX: 14,
  headerBandH: 26,
  contentTop: 44,
  contentTopAfterHeader: 32,
  footerTop: 285,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const titleCase = (value) =>
  String(value ?? "")
    .replaceAll("_", " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatNumber = (value) => {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

/* ------------------------------------------------------------------ */
/*  Report shell                                                      */
/* ------------------------------------------------------------------ */
export function createReportDoc({
  title,
  subtitle,
  meta = [],
  generatedAt = new Date(),
  generatedBy,
  timezone,
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  /* ---------- Cover header band ---------- */
  doc.setFillColor(...PDF_BRAND.primary);
  doc.rect(0, 0, PAGE.width, PAGE.headerBandH, "F");
  doc.setFillColor(...PDF_BRAND.primaryLight);
  doc.rect(0, PAGE.headerBandH, PAGE.width, 1.2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("ACTPulse", PAGE.marginX, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Operational Report", PAGE.width - PAGE.marginX, 11, {
    align: "right",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(
    String(title || "").toUpperCase(),
    PAGE.width - PAGE.marginX,
    18,
    { align: "right" }
  );

  /* ---------- Meta row ---------- */
  doc.setTextColor(...PDF_BRAND.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const rightMeta = [
    `Generated: ${generatedAt
      .toISOString()
      .replace("T", " ")
      .slice(0, 19)} UTC`,
  ];
  if (generatedBy) rightMeta.push(`By: ${generatedBy}`);
  if (timezone) rightMeta.push(`Timezone: ${timezone}`);

  let y = PAGE.headerBandH + 8;
  if (subtitle) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(subtitle, PAGE.marginX, y);
  }

  doc.setTextColor(...PDF_BRAND.textMuted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  rightMeta.forEach((line, i) => {
    doc.text(line, PAGE.width - PAGE.marginX, y - 4 + i * 4.5, {
      align: "right",
    });
  });

  /* ---------- Meta grid ---------- */
  if (meta.length) {
    y += 6;
    const cols = Math.min(meta.length, 4);
    const colW = (PAGE.width - PAGE.marginX * 2) / cols;
    const startY = y;

    meta.slice(0, cols * 2).forEach(([label, value], i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = PAGE.marginX + col * colW;
      const yPos = startY + row * 12;

      doc.setFillColor(...PDF_BRAND.surface);
      doc.roundedRect(x, yPos, colW - 2, 10, 1.5, 1.5, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...PDF_BRAND.textMuted);
      doc.text(label.toUpperCase(), x + 3, yPos + 4);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...PDF_BRAND.text);
      const txt = doc.splitTextToSize(String(value ?? "—"), colW - 6)[0];
      doc.text(txt, x + 3, yPos + 8);
    });

    y = startY + Math.ceil(meta.length / cols) * 12 + 4;
  }

  /* ---------- Helpers ---------- */
  let cursorY = Math.max(y + 4, PAGE.contentTop);

  const ensurePage = (needed = 20) => {
    if (cursorY + needed > PAGE.footerTop) {
      doc.addPage();
      drawContinuationHeader(doc, title);
      cursorY = PAGE.contentTopAfterHeader;
    }
  };

  const sectionTitle = (text) => {
    ensurePage(16);
    doc.setFillColor(...PDF_BRAND.primary);
    doc.rect(PAGE.marginX, cursorY, 1.2, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PDF_BRAND.text);
    doc.text(titleCase(text), PAGE.marginX + 4, cursorY + 4.4);
    cursorY += 9;
  };

  const paragraph = (text, options = {}) => {
    if (!text) return;
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(options.size ?? 9);
    doc.setTextColor(...(options.color || PDF_BRAND.text));
    const lines = doc.splitTextToSize(
      String(text),
      PAGE.width - PAGE.marginX * 2
    );
    lines.forEach((line) => {
      ensurePage(6);
      doc.text(line, PAGE.marginX, cursorY);
      cursorY += 5;
    });
    cursorY += options.gap ?? 3;
  };

  const keyValueGrid = (entries, { cols = 3 } = {}) => {
    if (!entries?.length) return;
    const colW = (PAGE.width - PAGE.marginX * 2) / cols;
    const rowH = 14;
    entries.forEach((entry, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      if (col === 0) ensurePage(rowH);
      const [label, value] = entry;
      const x = PAGE.marginX + col * colW;
      const yPos = cursorY + row * rowH;

      doc.setFillColor(...PDF_BRAND.surface);
      doc.roundedRect(x, yPos, colW - 2, rowH - 3, 1.5, 1.5, "F");

      doc.setDrawColor(...PDF_BRAND.border);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, yPos, colW - 2, rowH - 3, 1.5, 1.5, "S");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...PDF_BRAND.textMuted);
      doc.text(String(label).toUpperCase(), x + 3, yPos + 4);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...PDF_BRAND.text);
      const txt = doc.splitTextToSize(String(value ?? "—"), colW - 6)[0];
      doc.text(txt, x + 3, yPos + 9.5);
    });
    cursorY += Math.ceil(entries.length / cols) * rowH + 2;
  };

  const table = (head, rows, options = {}) => {
    ensurePage(24);
    autoTable(doc, {
      startY: cursorY,
      head: [head],
      body: rows,
      margin: {
        left: PAGE.marginX,
        right: PAGE.marginX,
        top: PAGE.contentTopAfterHeader,
        bottom: 20,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.2,
        overflow: "linebreak",
        textColor: PDF_BRAND.text,
        lineColor: PDF_BRAND.border,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: PDF_BRAND.primary,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
        halign: "left",
      },
      alternateRowStyles: {
        fillColor: PDF_BRAND.surface,
      },
      bodyStyles: { fontSize: 8 },
      didDrawPage: () => drawContinuationHeader(doc, title),
      ...options,
    });
    cursorY = doc.lastAutoTable.finalY + 6;
  };

  /* ---------- Bar chart (native vector) ---------- */
  const barChart = (data, options = {}) => {
    const {
      height = 70,
      barColor = PDF_BRAND.primaryLight,
      formatValue = (v) => formatNumber(v),
      title: chartTitle = "Overview",
    } = options;

    if (!data?.length) {
      paragraph("No data to display.", {
        size: 8.5,
        color: PDF_BRAND.textMuted,
      });
      return;
    }

    const chartW = PAGE.width - PAGE.marginX * 2;
    const chartH = height;
    const titleH = 8;
    const axisLabelH = 12;
    const plotH = chartH - titleH - axisLabelH;

    /* Reserve room for whole chart */
    ensurePage(chartH + 6);

    const chartTop = cursorY;
    const plotTop = chartTop + titleH;
    const plotBottom = plotTop + plotH;
    const left = PAGE.marginX + 12;
    const right = PAGE.marginX + chartW - 4;
    const plotW = right - left;

    /* Backdrop */
    doc.setFillColor(...PDF_BRAND.surface);
    doc.roundedRect(PAGE.marginX, chartTop, chartW, chartH, 2, 2, "F");

    /* Title */
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_BRAND.text);
    doc.text(chartTitle, PAGE.marginX + 3, chartTop + 5.5);

    /* Max */
    const max = Math.max(1, ...data.map((d) => Number(d.value) || 0));

    /* Y-axis grid lines + labels */
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF_BRAND.textMuted);
    for (let g = 0; g <= 4; g += 1) {
      const t = g / 4;
      const yLine = plotBottom - t * plotH;
      doc.setDrawColor(...PDF_BRAND.border);
      doc.setLineWidth(0.1);
      doc.line(left, yLine, right, yLine);
      doc.text(formatValue(t * max), left - 1.5, yLine + 1.2, {
        align: "right",
      });
    }

    /* Bars */
    const barGap = 2;
    const barW = Math.max(
      2,
      (plotW - barGap * (data.length - 1)) / data.length
    );
    const barRadius = Math.min(1.5, barW / 3);

    data.forEach((d, i) => {
      const value = Number(d.value) || 0;
      const h = max ? (value / max) * plotH : 0;
      const x = left + i * (barW + barGap);
      const yBar = plotBottom - h;

      doc.setFillColor(...barColor);
      doc.roundedRect(x, yBar, barW, h, barRadius, barRadius, "F");

      /* Value label above bar */
      if (value > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6);
        doc.setTextColor(...PDF_BRAND.text);
        doc.text(formatValue(value), x + barW / 2, yBar - 1, {
          align: "center",
        });
      }
    });

    /* X-axis labels */
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF_BRAND.textMuted);
    const rotate = data.length > 6;
    data.forEach((d, i) => {
      const x = left + i * (barW + barGap) + barW / 2;
      const label = String(d.name ?? "").slice(0, 18);
      if (rotate) {
        doc.text(label, x, plotBottom + 3, {
          align: "right",
          angle: 35,
          baseline: "middle",
        });
      } else {
        doc.text(label, x, plotBottom + 4, { align: "center" });
      }
    });

    /* Axis lines */
    doc.setDrawColor(...PDF_BRAND.border);
    doc.setLineWidth(0.2);
    doc.line(left, plotTop, left, plotBottom);
    doc.line(left, plotBottom, right, plotBottom);

    cursorY = chartTop + chartH + 4;
  };

  const spacer = (h = 4) => {
    cursorY += h;
  };

  const pageBreak = () => {
    doc.addPage();
    drawContinuationHeader(doc, title);
    cursorY = PAGE.contentTopAfterHeader;
  };

  const finalize = ({ methodology, footnote } = {}) => {
    if (methodology) {
      ensurePage(20);
      paragraph("Methodology", { bold: true, size: 10 });
      paragraph(methodology, { size: 8.5, color: PDF_BRAND.textMuted });
    }
    if (footnote) {
      ensurePage(16);
      paragraph(footnote, { size: 8.5, color: PDF_BRAND.warning });
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i += 1) {
      doc.setPage(i);
      drawFooter(doc, i, pageCount);
    }
  };

  /* -------------------------------------------------------------- */
  /*  Public API                                                    */
  /* -------------------------------------------------------------- */
  return {
    doc,
    sectionTitle,
    paragraph,
    keyValueGrid,
    table,
    barChart,          // <-- IMPORTANT: exported here
    spacer,
    pageBreak,
    ensurePage,
    finalize,
    get y() {
      return cursorY;
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Page ornaments                                                    */
/* ------------------------------------------------------------------ */
function drawContinuationHeader(doc, title) {
  doc.setFillColor(...PDF_BRAND.primary);
  doc.rect(0, 0, PAGE.width, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("ACTPulse", PAGE.marginX, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    String(title || "").toUpperCase(),
    PAGE.width - PAGE.marginX,
    9,
    { align: "right" }
  );
}

function drawFooter(doc, page, total) {
  doc.setDrawColor(...PDF_BRAND.border);
  doc.setLineWidth(0.2);
  doc.line(
    PAGE.marginX,
    PAGE.footerTop,
    PAGE.width - PAGE.marginX,
    PAGE.footerTop
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_BRAND.textMuted);
  doc.text("ACTPulse · Operational Report", PAGE.marginX, PAGE.footerTop + 5);
  doc.text(
    `Page ${page} of ${total}`,
    PAGE.width - PAGE.marginX,
    PAGE.footerTop + 5,
    { align: "right" }
  );
}

export { titleCase, formatNumber };