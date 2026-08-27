# Approved Leave History — Redesign Spec

## Purpose
Redesign the "Approved Leave History" page so admins, managers, and directors can view all leave applications from their employees without the current two-click, mostly-empty month-card flow. Replace the 12 month cards + modal pattern with a single filterable, groupable data view.

## Problems with the current design
- 12 month cards are shown up front, most displaying "0" — wastes screen space and scanning effort before any real data appears.
- Viewing actual records requires two clicks (open month card → modal opens → scan table).
- No way to see totals/status breakdown across the whole year without opening every month.
- No search or cross-month filtering — finding one employee's history means opening each month.
- Modal-based detail view interrupts the page instead of being part of it.

## New page structure (top to bottom)

### 1. Page header
- Title: "Leave history"
- Subtitle: "Browse leave records for your team." (or role-appropriate variant for admin/director scope)
- Keep existing user profile badge (name, role, staff ID) top right.

### 2. Summary stat cards
Row of 4 metric cards, always visible at the top:
- **Total this year** — count of all applications in current filter scope
- **Approved** — count, styled with success color
- **Pending** — count, styled with warning color
- **Cancelled** — count, styled with muted/danger color

**Critical behavior:** these numbers must recompute live based on whatever filters are currently active (department, leave type, status, month, search text). If a manager filters to "Pending" only, "Total this year" should reflect the filtered count, not the unfiltered grand total. Do not treat these as static year-level constants.

### 3. Filter bar
Single row, always visible (no modal needed to access filters):
- **Month** — dropdown, "All months" + Jan–Dec
- **Department** — dropdown, "All departments" + dynamic list from data
- **Leave type** — dropdown, "All types" + dynamic list (Annual, Medical, Emergency, etc.)
- **Status** — dropdown, "All statuses" + Approved / Pending / Cancelled / Rejected (whatever statuses exist in the system)
- **Search** — text input, matches against employee name or staff ID, live-filter (debounce ~250ms)

All filters combine with AND logic. All filters affect both the stat cards and the table below.

### 4. View toggle
Two-state toggle button group, top-right of the filter bar area:
- **Flat** — single sortable, paginated table of all records matching current filters, no grouping
- **By month** — same filtered dataset, grouped into collapsible month sections

Persist the last-selected view (session or local state) so it doesn't reset on page reload if reasonably easy to implement; not a hard requirement.

### 5a. Flat view (table)
Standard data table with columns:
| Column | Notes |
|---|---|
| Staff | Name + staff ID (muted, smaller text) shown together in one cell |
| Department | |
| Dates | Leave date(s) |
| Days | Total days |
| Type | Leave type |
| Status | Rendered as a colored badge/pill, not plain text |

- Sortable by column header click (at minimum: Dates, Status)
- Paginated (e.g. 20–25 rows per page), with "Showing X–Y of Z" label and Prev/Next controls
- Empty state: if no rows match filters, show a message like "No leave records match your filters." with a "Clear filters" action — not a blank table.

### 5b. Grouped-by-month view
- One collapsible section per month that has at least one matching record.
- Section header shows: chevron icon (expand/collapse), month + year label, a summary line ("X applications, Y days"), and — if any record in that month is Pending — a small warning-colored "N pending" badge on the right side of the header, so action items are visible without expanding.
- Sections default to **collapsed**, except the section containing the most recent activity (e.g. current month), which defaults to **expanded**.
- Expanding a section reveals the same table columns as the flat view (Staff, Department, Dates, Days, Type, Status), scoped to that month.
- Months with zero matching records: 
  - Only show them if no other filters besides month/status are hiding all data (avoid clutter) — recommend: show empty months only in an unfiltered "All statuses / all types" default view, so directors can see coverage gaps; hide them entirely once type/status/search filters are applied, since an empty group under an active filter is just noise.
  - When shown, render at reduced opacity (~60%), collapsed, non-expandable (no chevron interaction), with "0 applications" as the summary line.

### 6. Status badge styling
Use consistent colors across both views:
- Approved → success (green) background/text
- Pending → warning (amber/yellow) background/text
- Cancelled → muted/neutral background/text
- Rejected (if applicable) → danger (red) background/text

## Data requirements
Each leave record needs at minimum:
- `staff_id`, `staff_name`, `department`
- `leave_type`
- `start_date`, `end_date` (or single date + total_days)
- `total_days`
- `status` (enum: approved / pending / cancelled / rejected)
- `applied_date` (useful for sorting/audit, optional to display)

Aggregations needed (computed client-side or via API):
- Per current filter scope: total count, count by status
- Per month: count, total days, count of pending

## Interaction/UX notes
- No modals for viewing records — everything lives inline on the page.
- Switching between Flat and By month should not reset active filters.
- Filters, search, and view toggle should all be usable without a page reload (client-side filtering or fast API calls).
- Keep the stat cards and filter bar sticky-adjacent (not required to be sticky/pinned, but should not require scrolling past a large empty area to reach them — avoid the current design's "big cards for empty months" pattern).

## Access scope by role
- **Staff**: sees only their own leave history (existing "Personal" nav item) — this spec applies to the "Staff"/"Employees" manager-facing view, not personal view.
- **Manager**: sees records for their direct reports/department.
- **Admin / Director**: sees records across all departments — department filter becomes especially relevant at this level.

## Download / export report

An "Export" button sits in the filter bar, alongside the Flat/By month toggle. Clicking it opens a small panel (not a full page navigation) with:

- **Format** — choice of:
  - `CSV` — raw data rows only, columns matching the on-screen table (Staff, Department, Dates, Days, Type, Status). No styling, no header summary. Intended for further analysis in Excel/Sheets.
  - `PDF report` — formatted document containing: report title, generated-on date/time, a plain-text line stating which filters were applied (e.g. "Department: Finance · Status: Pending · Aug 1 – Aug 27, 2026"), the stat summary (total/approved/pending/cancelled), then the data grouped by month (mirrors the "By month" view), each month as its own section with a subtotal.
- **Scope** — radio choice:
  - `Current filtered view` (default) — exports exactly what's on screen given the active filters, and shows a live count (e.g. "12 records") so the user knows what they're about to download.
  - `Full year, all departments` — ignores active filters, exports everything the user's role has access to.
- **Include cancelled leave** — checkbox, default checked. Some reports intentionally exclude cancelled records; expose this rather than hardcoding a behavior.
- **Generate** button — triggers the download. Show a loading/disabled state while the file is being built, especially for PDF with a large record count.

Filename convention: `leave-history_{department-or-all}_{start-date}_{end-date}.{ext}` — avoids ambiguous/overwritten downloads when someone exports repeatedly.

Role note: Admin/Director exports can include a department breakdown page in the PDF (one section per department); Manager-level exports are scoped to their own team by default.

## Out of scope for this pass
- Editing or approving leave from this page (this is a read/browse history view, not an action queue — though the "N pending" badge may later link to an approvals page).
- Scheduled/recurring report generation (e.g. auto-email a monthly report) — could be a phase 2 addition once manual export is validated.

## Suggested component breakdown for implementation
1. `LeaveHistoryPage` — page shell, holds filter state, fetches/filters data
2. `StatCardsRow` — receives filtered dataset, computes and renders the 4 metrics
3. `FilterBar` — controlled inputs (month, department, type, status, search), emits filter state up
4. `ViewToggle` — Flat / By month switch
5. `LeaveTable` — reusable table component, takes a list of records, renders rows + status badges; used both standalone (flat view) and inside each month group
6. `MonthGroup` — collapsible wrapper around `LeaveTable`, shows header summary + pending badge
7. `EmptyState` — shown when filtered results are empty

## Visual reference
Three widget mockups were generated during design discussion showing: (1) stat cards + filter bar + flat table, (2) the same page with the "By month" grouped/collapsible view active, and (3) the Export panel (format, scope, include-cancelled options) opened from the filter bar. Use those as the visual reference for spacing, badge styling, and layout proportions when implementing.