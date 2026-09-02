import { getLeaveFullName, dateRange, MONTHS } from "./utils.js";

function buildFilename(dept, includeAll) {
  const deptPart = includeAll ? "all" : (dept || "all").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10);
  return `leave-history_${deptPart}_${datePart}`;
}

export function exportCSV(records, { deptFilter, includeAll }) {
  const headers = ["Staff ID", "Staff Name", "Department", "Date From", "Date Until", "Days", "Leave Type", "Status"];

  const rows = records.map((r) => [
    r.id,
    r.name,
    r.department || "",
    r.dateFrom,
    r.dateTo,
    r.totalDays,
    getLeaveFullName(r.leaveType),
    r.status
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => {
        const s = String(cell);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      }).join(",")
    )
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const filename = `${buildFilename(deptFilter, includeAll)}.csv`;

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
