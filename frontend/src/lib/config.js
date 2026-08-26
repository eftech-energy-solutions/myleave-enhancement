export const PUBLIC_VITE_API_BASE = "https://ees.edsdata.com.my/backend"

// Chart donut colors — single source of truth
export const CHART_COLORS = {
  spent:    '#DC2626',  // red — Spent Leave
  balance:  '#3b82f6',  // blue — Balance Leave
  carry:    '#D97706',  // amber — Carry-forward Leave (director/manager)
  unpaid:   '#94A3B8',  // light slate — Unpaid Leave
  rest:     '#94A3B8',  // light slate — rest/balance ring for CSS donuts
  // Admin-specific
  adminCarry:  '#10b981',  // green — Carry-forward Leave (admin)
  adminUnpaid: '#f59e0b',  // amber — Unpaid Leave (admin)
}

// Ordered arrays for Chart.js datasets — director / manager
export const CHART_COLORS_WITH_CARRY = [
  CHART_COLORS.spent,
  CHART_COLORS.balance,
  CHART_COLORS.carry,
  CHART_COLORS.unpaid,
]

// Ordered arrays for Chart.js datasets — admin (4-slice annual)
export const CHART_COLORS_ADMIN = [
  CHART_COLORS.spent,
  CHART_COLORS.balance,
  CHART_COLORS.adminCarry,
  CHART_COLORS.adminUnpaid,
]

export const CHART_COLORS_BASIC = [
  CHART_COLORS.spent,
  CHART_COLORS.balance,
]
