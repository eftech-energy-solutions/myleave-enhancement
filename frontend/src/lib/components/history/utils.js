export const leaveTypeFullName = {
  AL: "Annual / Emergency",
  MC: "Medical",
  MAT: "Maternity",
  PAT: "Paternity",
  COMP_A: "Compassionate A (Parent/Child/Spouse)",
  COMP_B: "Compassionate B (Grandparent/Sibling)",
  MAR: "Marriage",
  HOSP: "Hospitalization",
  UNPAID: "Unpaid"
};

export function getLeaveFullName(code) {
  return leaveTypeFullName[code] || code;
}

export function fmt(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function dateRange(a, b) {
  return a === b ? fmt(a) : `${fmt(a)} – ${fmt(b)}`;
}

export function makeEmployeeRecord(item) {
  const raw = item.status.toLowerCase();
  let formatted =
    raw === "cancellation_pending"
      ? "Cancellation pending"
      : raw.charAt(0).toUpperCase() + raw.slice(1);

  return {
    id: item.staff_id,
    name: item.staff_name,
    department: item.department,
    totalDays: item.total_days,
    leaveType: item.leave_type,
    status: formatted,
    dateFrom: item.date_from,
    dateTo: item.date_until,
    createdAt: item.created_at
  };
}

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function getMonthIndex(dateStr) {
  return new Date(dateStr).getMonth();
}
