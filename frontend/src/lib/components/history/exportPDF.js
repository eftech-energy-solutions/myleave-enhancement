import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";
import { getLeaveFullName, dateRange, MONTHS } from "./utils.js";

applyPlugin(jsPDF);

function buildFilterSummary(filters) {
  const parts = [];
  if (filters.deptFilter) parts.push(`Department: ${filters.deptFilter}`);
  if (filters.typeFilter) parts.push(`Type: ${getLeaveFullName(filters.typeFilter)}`);
  if (filters.statusFilter) parts.push(`Status: ${filters.statusFilter}`);
  if (filters.monthFilter && filters.monthFilter !== "All") parts.push(`Month: ${filters.monthFilter}`);
  if (filters.searchQuery) parts.push(`Search: "${filters.searchQuery}"`);
  return parts.length ? parts.join(" · ") : "No filters applied";
}

function buildFilename(dept, includeAll) {
  const deptPart = includeAll ? "all" : (dept || "all").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10);
  return `leave-history_${deptPart}_${datePart}.pdf`;
}

async function fetchLogoDataUrl() {
  const res = await fetch("/images/eftech.logo.png");
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

export async function exportPDF(records, filters, stats) {
  const logoDataUrl = await fetchLogoDataUrl();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  // Logo top-right
  const logoW = 30;
  const logoH = 15;
  doc.addImage(logoDataUrl, "PNG", pageWidth - margin - logoW, margin - 4, logoW, logoH);

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Leave History Report", margin, y);
  y += 8;

  // Generated on
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
  y += 6;

  // Filter summary
  doc.setTextColor(80);
  const filterText = buildFilterSummary(filters);
  doc.text(`Filters: ${filterText}`, margin, y);
  y += 6;

  // Record count
  doc.setTextColor(100);
  doc.text(`Records: ${records.length}`, margin, y);
  y += 8;

  // Stat summary
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(31, 41, 55);
  doc.text("Summary", margin, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Total: ${stats.total}`, margin, y);
  doc.text(`Approved: ${stats.approved}`, margin + 40, y);
  doc.text(`Pending: ${stats.pending}`, margin + 85, y);
  doc.text(`Cancelled: ${stats.cancelled}`, margin + 130, y);
  y += 8;

  // Divider
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Group records by month
  const groups = MONTHS.map((m) => ({ month: m, records: [] }));
  records.forEach((r) => {
    const startMonth = new Date(r.dateFrom).getMonth();
    const endMonth = new Date(r.dateTo).getMonth();
    for (let m = startMonth; m <= endMonth; m++) {
      groups[m].records.push(r);
    }
  });

  const activeGroups = groups.filter((g) => g.records.length > 0);

  activeGroups.forEach((group) => {
    // New page if not enough space
    if (y > pageHeight - 50) {
      doc.addPage();
      y = margin;
    }

    // Month header
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 155, 142);
    const totalDays = group.records.reduce((s, r) => s + Number(r.totalDays || 0), 0);
    doc.text(
      `${group.month} — ${group.records.length} application${group.records.length !== 1 ? "s" : ""}, ${totalDays} day${totalDays !== 1 ? "s" : ""}`,
      margin,
      y
    );
    y += 5;

    const tableBody = group.records.map((r) => [
      r.id,
      r.name,
      r.department || "",
      dateRange(r.dateFrom, r.dateTo),
      String(r.totalDays),
      getLeaveFullName(r.leaveType),
      r.status
    ]);

    doc.autoTable({
      head: [["Staff ID", "Name", "Department", "Dates", "Days", "Type", "Status"]],
      body: tableBody,
      startY: y,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        overflow: "linebreak",
        font: "helvetica"
      },
      headStyles: {
        fillColor: [15, 155, 142],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    });

    y = doc.lastAutoTable.finalY + 8;
  });

  // Footer on each page
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${totalPages} · Leave History Report`,
      margin,
      pageHeight - 8
    );
  }

  const filename = buildFilename(filters.deptFilter, filters.scope === "all");
  doc.save(filename);
}
