<script>
  import { onMount } from "svelte";
  import { PUBLIC_VITE_API_BASE } from '$env/static/public';

  // 'admin' | 'manager' | 'director'
  export let role = "admin";

  // 'true' => embed (slide-out panel) mode: hides toolbar / bulk / selection
  export let compact = false;

  const leaveTypeShortName = {
    AL: "Annual / Emergency",
    MC: "Medical",
    MAT: "Maternity",
    PAT: "Paternity",
    COMP_A: "Compassionate A",
    COMP_B: "Compassionate B",
    MAR: "Marriage",
    HOSP: "Hospitalization",
    UNPAID: "Unpaid"
  };

  const getLeaveShortName = (code) => leaveTypeShortName[code] || code;
  const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString() : "-");
  const fmtShort = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "-";

  let me = null;
  let meDept = null;
  let loading = true;

  let pendingLeave = [];
  let pendingCancel = [];
  let loadedAll = [];

  let deptFilter = "All";
  let leaveTypeFilter = "All";
  let nameSearch = "";
  let sortMode = "start"; // 'start' = soonest start date | 'oldest' = oldest request first

  let selectedIds = [];
  let selectAllEl = null;
  let bulkBusy = false;

  const idOf = (item) => item.leave_id ?? item.leaveid ?? item.id;

  const deptList = (v) =>
    String(v || "").split(",").map((d) => d.trim()).filter(Boolean);

  const numberOr = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  // ---- local-time date helpers (values are plain YYYY-MM-DD) ----

  function parseLocal(s) {
    if (s == null || s === "") return null;
    const ymd = String(s).slice(0, 10).split("-").map(Number);
    if (ymd.length !== 3 || ymd.some((n) => !Number.isFinite(n))) return null;
    return new Date(ymd[0], ymd[1] - 1, ymd[2]);
  }

  function todayLocal() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const MONTHS_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  function datePart(iso) {
    const d = parseLocal(iso);
    return d ? `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}` : "—";
  }

  function datePartYear(iso) {
    const d = parseLocal(iso);
    return d ? `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : "—";
  }

  function daysLabel(dayCount) {
    const days = numberOr(dayCount, 1);
    return `${days} ${days === 1 ? "day" : "days"}`;
  }

  function durationLine(item) {
    return `${datePart(item.date_from)} – ${datePartYear(item.date_until)} · ${daysLabel(item.total_days)}`;
  }

  function trimNum(n) {
    const v = Math.round(n * 10) / 10;
    return Number.isInteger(v) ? String(v) : String(v.toFixed(1));
  }

  function balanceAfter(item) {
    const type = String(item.leave_type || "").trim().toUpperCase();
    const days = numberOr(item.total_days, 0);
    let label = null;
    let balance = null;

    if (type === "AL" || type === "EL") {
      let cf = numberOr(item.carry_forward_balance, 0);
      const expiry = parseLocal(item.carry_forward_expiry);
      if (expiry && todayLocal() > expiry) cf = 0;
      balance = Math.max(0, numberOr(item.leave_entitlement_annual, 0) + cf - days);
      label = "Annual leave after approval";
    } else if (type === "MC") {
      balance = Math.max(0, numberOr(item.leave_entitlement_medical, 0) - days);
      label = "Medical leave after approval";
    }

    return label ? { label, value: trimNum(balance) } : null;
  }

  function metaLine(item) {
    const base = `Requested ${fmtShort(item.created_at)}`;
    const bal = balanceAfter(item);
    return bal ? `${base} · ${bal.label}: ${bal.value} day(s)` : base;
  }

  // ---- signals for a card ----

  function daysUntilStart(item) {
    const start = parseLocal(item.date_from);
    if (!start) return null;
    return Math.round((start - todayLocal()) / 86400000);
  }

  function overlapCount(item) {
    const mine = deptList(item.profile_department || item.department);
    if (!mine.length) return 0;

    const itemStart = parseLocal(item.date_from);
    const itemEnd = parseLocal(item.date_until);
    if (!itemStart || !itemEnd) return 0;

    return (loadedAll || []).filter((o) => {
      if (idOf(o) === idOf(item)) return false;
      if (String(o.status || "").toLowerCase().trim() !== "approved") return false;

      const theirs = deptList(o.profile_department || o.department);
      if (!theirs.some((t) => mine.includes(t))) return false;

      const oStart = parseLocal(o.date_from);
      const oEnd = parseLocal(o.date_until);
      if (!oStart || !oEnd) return false;

      return oStart <= itemEnd && oEnd >= itemStart;
    }).length;
  }

  function signalsFor(item) {
    return { due: daysUntilStart(item), overlap: overlapCount(item) };
  }

  $: enrichedLeave = visibleLeave.map((item) => ({ item, sig: signalsFor(item) }));
  $: enrichedCancel = visibleCancel.map((item) => ({ item, sig: signalsFor(item) }));

  // ---- filters / sorting ----

  const leaveTypeOptions = ["All", ...Object.keys(leaveTypeShortName)];

  $: deptOptions = [
    "All",
    ...Array.from(
      new Set(
        (loadedAll || []).flatMap((r) => deptList(r.profile_department || r.department))
      )
    ).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
  ];

  function applyFilters(list, dept, type, q, mode) {
    const query = q.trim().toLowerCase();
    const filtered = list.filter((item) => {
      if (dept !== "All") {
        const deps = deptList(item.profile_department || item.department);
        if (!deps.includes(dept)) return false;
      }
      if (type !== "All") {
        if (String(item.leave_type || "").trim() !== type) return false;
      }
      if (query) {
        const name = String(item.profile_name || item.staff_name || "").toLowerCase();
        const id = String(item.staff_id || "").toLowerCase();
        if (!name.includes(query) && !id.includes(query)) return false;
      }
      return true;
    });

    const arr = [...filtered];
    if (mode === "oldest") {
      arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else {
      arr.sort((a, b) => parseLocal(a.date_from) - parseLocal(b.date_from));
    }
    return arr;
  }

  $: visibleLeave = applyFilters(pendingLeave, deptFilter, leaveTypeFilter, nameSearch, sortMode);
  $: visibleCancel = applyFilters(pendingCancel, deptFilter, leaveTypeFilter, nameSearch, sortMode);

  // Selection is scoped to the pending-leave section. It clears whenever the visible
  // population changes because of department / leave-type / search (NOT sorting).
  $: {
    deptFilter;
    nameSearch;
    leaveTypeFilter;
    if (!compact) selectedIds = [];
  }

  $: allVisibleSelected =
    visibleLeave.length > 0 && visibleLeave.every((i) => selectedIds.includes(idOf(i)));
  $: partialSelected =
    !allVisibleSelected &&
    selectedIds.length > 0 &&
    visibleLeave.some((i) => selectedIds.includes(idOf(i)));
  $: if (selectAllEl) selectAllEl.indeterminate = partialSelected;

  function toggleItem(item) {
    const id = idOf(item);
    const has = selectedIds.includes(id);
    selectedIds = has
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
  }

  function toggleSelectAll() {
    const visibleIds = visibleLeave.map(idOf);
    if (allVisibleSelected) {
      selectedIds = selectedIds.filter((i) => !visibleIds.includes(i));
    } else {
      selectedIds = [...new Set([...selectedIds, ...visibleIds])];
    }
    if (selectAllEl) selectAllEl.indeterminate = partialSelected;
  }

  function clearSelection() {
    selectedIds = [];
  }

  function clearFilters() {
    deptFilter = "All";
    leaveTypeFilter = "All";
    nameSearch = "";
    sortMode = "start";
    selectedIds = [];
  }

  const VERB_PAST = { approve: "approved", reject: "rejected" };

  async function bulkAction(verb) {
    if (bulkBusy || selectedIds.length === 0) return;

    bulkBusy = true;
    const targets = visibleLeave.filter((i) => selectedIds.includes(idOf(i)));
    let success = 0;
    let failed = 0;

    for (const item of targets) {
      try {
        await patchStatus(idOf(item), VERB_PAST[verb]);
        success += 1;
      } catch {
        failed += 1;
      }
    }

    bulkBusy = false;

    if (success > 0) {
      clearSelection();
      showToast(
        `${success} ${success === 1 ? "request" : "requests"} ${VERB_PAST[verb]}.`,
        "success"
      );
      await loadRequests();
      window.dispatchEvent(new Event("pending-updated"));
    }
    if (failed > 0) {
      showToast(
        `${failed} ${failed === 1 ? "request" : "requests"} failed. Please retry.`,
        "error"
      );
    }
  }

  // ---- data loading ----

  async function loadRequests() {
    try {
      const res = await fetch(`${PUBLIC_VITE_API_BASE}/api/leave-requests`, {
        credentials: "include"
      });

      if (!res.ok) {
        console.error("Failed to fetch leave requests:", res.status);
        return;
      }

      const all = await res.json();
      loadedAll = all;
      let view = all;

      if (role === "manager" && me?.role === "Manager") {
        view = all.filter((r) => {
          // Hide my own requests from myself
          const myId = String(me?.staff_id || me?.id || "").trim();
          const recordId = String(r.staff_id || "").trim();
          if (myId && recordId === myId) return false;

          const currentManagerDept = String(meDept || me?.department || "").toLowerCase().trim();
          const employeeDept = String(
            r.profile_department || r.staff_department || r.department || ""
          ).toLowerCase().trim();
          const employeeRole = String(r.requester_role || "").toLowerCase().trim();

          // Manager of the Director dept sees Director staff + all Managers
          if (currentManagerDept === "director") {
            return employeeDept === "director" || employeeRole === "manager";
          }

          // Normal manager rule (supports multiple comma-separated departments)
          const managerDepartmentsArray = currentManagerDept.split(",").map((d) => d.trim());
          const employeeDepartmentsArray = employeeDept.split(",").map((d) => d.trim());

          return (
            employeeDepartmentsArray.some((d) => managerDepartmentsArray.includes(d)) &&
            employeeRole === "staff"
          );
        });
      } else if (role === "director" && me?.role === "Director") {
        view = all.filter((r) => {
          // Own requests (any status)
          if (r.staff_id === me.staffId) return true;

          // All managers (any department)
          if (r.requester_role === "Manager") return true;

          return false;
        });
      }

      pendingLeave = view.filter(
        (p) => String(p.status || "").toLowerCase().trim() === "pending"
      );

      pendingCancel = view.filter((p) => {
        const stat = String(p.status || "").toLowerCase().trim();
        return stat === "cancellation_pending" || stat === "cancellation pending";
      });
    } catch (err) {
      console.error("Error loading leave requests:", err);
    }
  }

  onMount(async () => {
    try {
      if (role !== "admin") {
        const res = await fetch(`${PUBLIC_VITE_API_BASE}/api/me/photo`, {
          credentials: "include"
        });
        if (res.ok) {
          me = await res.json();
          meDept = me?.department;
        }
      }

      await loadRequests();
    } catch (err) {
      console.error("Error initialising leave approvals:", err);
    }

    loading = false;
  });

  // ---- single actions (existing behaviour kept) ----

  let confirmState = null;
  let busy = false;
  let detailItem = null;

  let toast = {
    show: false,
    type: "success",
    title: "",
    message: "",
    closing: false
  };

  function showToast(message, type = "success", title = "", duration = 3000) {
    toast = {
      show: true,
      type,
      title: title || type.charAt(0).toUpperCase() + type.slice(1),
      message,
      closing: false
    };

    setTimeout(() => {
      toast.closing = true;
      setTimeout(() => {
        toast.show = false;
        toast.closing = false;
      }, 300);
    }, duration);
  }

  function canApprove(item) {
    if (role === "admin") return true;

    if (role === "manager") {
      // A user can NEVER approve their own application
      const myId = String(me?.staff_id || me?.id || "").trim();
      const recordId = String(item.staff_id || "").trim();
      if (myId && recordId === myId) return false;

      // Only lock to "View only" if the target request role is literally "Director"
      const myRole = String(me?.role || "").toLowerCase().trim();
      const myDept = String(meDept || me?.department || "").toLowerCase().trim();
      const targetRole = String(item.requester_role || "").toLowerCase().trim();

      if (myRole === "manager" && myDept === "director" && targetRole === "director") {
        return false;
      }

      return true;
    }

    if (role === "director") {
      if (me?.role === "Director") {
        // A Director can ONLY approve Managers' leave — never their own
        const myId = String(me?.staff_id || me?.id || "").trim();
        const recordId = String(item.staff_id || "").trim();
        if (myId && recordId === myId) return false;

        const targetRole = String(item.requester_role || "").toLowerCase().trim();
        return targetRole === "manager";
      }
      return true;
    }

    return false;
  }

  function askConfirm(item, verb, kind) {
    confirmState = { item, verb, kind };
  }

  function closeConfirm() {
    if (busy) return;
    confirmState = null;
  }

  async function patchStatus(id, status) {
    const res = await fetch(`${PUBLIC_VITE_API_BASE}/api/leave-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Server failed to process the request");
    }
  }

  async function performConfirm() {
    if (!confirmState || busy) return;

    const { item, verb, kind } = confirmState;
    const id = idOf(item);

    const statusMatrix = {
      leave: { approve: "approved", reject: "rejected" },
      cancel: {
        approve: "cancelled",
        reject: role === "admin" ? "cancellation_rejected" : "approved"
      }
    };

    busy = true;

    try {
      await patchStatus(id, statusMatrix[kind][verb]);

      if (kind === "leave") {
        showToast(
          verb === "approve"
            ? "Leave request approved successfully."
            : "Leave request rejected.",
          "success"
        );
      } else {
        showToast(
          verb === "approve"
            ? "Leave cancellation approved."
            : "Cancellation request rejected.",
          "success"
        );
      }

      confirmState = null;
      await loadRequests();
      window.dispatchEvent(new Event("pending-updated"));
    } catch (err) {
      console.error("Approval action error:", err);
      showToast(err.message || "Failed to process the request.", "error");
    }

    busy = false;
  }

  function openDetails(item) {
    detailItem = item;
  }

  function closeDetails() {
    detailItem = null;
  }

  function attachmentUrl(path) {
    if (!path) return "";
    return `${PUBLIC_VITE_API_BASE}${path?.startsWith("/") ? "" : "/"}${path}`;
  }

  function handleKey(e) {
    if (e.key === "Escape") {
      if (confirmState && !busy) confirmState = null;
      if (detailItem) detailItem = null;
    }
  }
</script>
<svelte:window on:keydown={handleKey} />

<style>
  :root {
    --primary: #0F9B8E;
    --border-accent: #0F9B8E;
    --ink: #0c4a6e;
    --muted: #64748b;
    --line: #e5e7eb;
    --soft: #f8fafc;
  }

  /* ===== Layout ===== */
  .main { padding: 1.5rem; }
  .main.compact-mode { padding: 1.25rem 1rem; }
  .page-head { margin-bottom: 18px; }

  /* ===== Toolbar (full mode only) ===== */
  .toolbar {
    display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap;
    background: #fff; border: 1px solid var(--line, #e5e7eb); border-radius: 12px;
    padding: 12px 14px; box-shadow: 0 2px 10px rgba(15,23,42,.04);
  }
  .filt { display: flex; flex-direction: column; gap: 4px; }
  .filt label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: .4px; }
  .filt select, .filt input {
    border: 1px solid var(--line, #e5e7eb); border-radius: 8px; padding: .45rem .7rem;
    font-size: 13px; font-weight: 600; color: #0f172a; background: #fff; outline: none;
  }
  .filt select:focus, .filt input:focus { border-color: #0F9B8E; box-shadow: 0 0 0 3px rgba(15,155,142,.15); }
  .filt select {
    appearance: none; -webkit-appearance: none; padding-right: 1.8rem; cursor: pointer;
    background: #fff url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7280' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 10px center;
  }
  .filt.grow { flex: 1; min-width: 180px; }
  .filt input { width: 100%; }
  .btn-clear-filters {
    border: 1px solid #e5e7eb; background: #fff; color: #64748b;
    border-radius: 8px; padding: .45rem .8rem; font-size: 12px; font-weight: 700;
    cursor: pointer; margin-bottom: 1px;
  }
  .btn-clear-filters:hover { border-color: #0F9B8E; color: #0F9B8E; }

  /* ===== Compact mini-toolbar (slide-out panel) ===== */
  .mini-toolbar {
    display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap;
    background: #fff; border: 1px solid var(--line, #e5e7eb); border-radius: 12px;
    padding: 10px 12px; margin-bottom: 14px; box-shadow: 0 2px 10px rgba(15,23,42,.04);
  }
  .select-all { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #334155; cursor: pointer; padding-bottom: .4rem; white-space: nowrap; }
  .select-all input { width: 16px; height: 16px; accent-color: #0F9B8E; cursor: pointer; }

  /* ===== Bulk action bar ===== */
  .bulk-bar {
    position: sticky; top: 0; z-index: 30;
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    background: #fff; border: 1px solid var(--border-accent, #0F9B8E); border-radius: 12px;
    box-shadow: 0 6px 18px rgba(15,155,142,.14); padding: 10px 14px; margin-bottom: 14px;
  }
  .bulk-count { font-weight: 800; color: #0F9B8E; font-size: 13px; }
  .btn-bulk-approve { background: #16a34a; color: #fff; border: none; border-radius: 8px; padding: .5rem .9rem; font-weight: 700; font-size: 12px; cursor: pointer; }
  .btn-bulk-reject { background: #fff; color: #dc2626; border: 1px solid #dc2626; border-radius: 8px; padding: .5rem .9rem; font-weight: 700; font-size: 12px; cursor: pointer; }
  .btn-bulk-clear { background: none; border: none; color: #64748b; text-decoration: underline; font-size: 12px; cursor: pointer; }
  .btn-bulk-approve:disabled, .btn-bulk-reject:disabled, .btn-bulk-clear:disabled { opacity: .6; cursor: not-allowed; }

  /* ===== Sections ===== */
  .sub-ttl { margin: 0 0 12px; font-weight: 600; font-size: var(--fs-section-heading, 16px); letter-spacing: .2px; color: var(--ink, #1F2937); }

  /* ===== Cards grid ===== */
  .cards-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); }

  /* ===== Pending card ===== */
  .pending-card {
    background: #fff; border: 1px solid var(--line, #e5e7eb); border-radius: 12px;
    padding: 14px 16px; box-shadow: 0 2px 10px rgba(15,23,42,.06);
    display: flex; flex-direction: column; min-height: 158px;
  }
  .pending-card.selected { border: 2px solid var(--border-accent, #0F9B8E); }
  .row1 { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .card-check { width: 16px; height: 16px; accent-color: #0F9B8E; cursor: pointer; flex-shrink: 0; margin-top: 3px; margin-right: 10px; }
  .who { min-width: 0; flex: 1; }
  .name { font-weight: 800; color: #000; font-size: 16px; }
  .sub { font-size: 12px; color: #64748b; margin-top: 2px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .pill.type { background: #eef2ff; color: #0f172a; border: 1px solid #e5e7eb; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
  .unpaid-pill { background-color: rgba(239,68,68,.18) !important; color: #b91c1c !important; border: 1px solid rgba(239,68,68,.35) !important; }
  .cancel-pill { background: #fee2e2; color: #b91c1c; }

  .duration { font-size: 13px; font-weight: 700; color: #0f172a; margin: 10px 0 4px; }
  .meta { font-size: 12px; color: #64748b; }
  .sig-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0 2px; }
  .sig-badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 9999px; white-space: nowrap; }
  .sig-badge.soon { background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; }
  .sig-badge.overlap { background: #e0e7ff; color: #3730a3; border: 1px solid #818cf8; }

  .actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: auto; padding-top: 10px; }
  .view-only { font-size: 12px; color: #64748b; font-style: italic; }
  .btn-approve { background: #16a34a; color: #fff; border: none; border-radius: 8px; padding: .55rem .9rem; font-weight: 700; cursor: pointer; min-width: 50px; line-height: 1; font-size: 12px; }
  .btn-reject-outline { background: #fff; color: #dc2626; border: 1px solid #dc2626; border-radius: 8px; padding: .55rem .9rem; font-weight: 700; cursor: pointer; min-width: 50px; line-height: 1; font-size: 12px; }
  .btn-details-link { background: none; border: none; padding: .35rem .6rem; font: inherit; color: #0c4a6e; text-decoration: underline; cursor: pointer; font-size: 12px; }
  .btn-approve:hover, .btn-reject-outline:hover { filter: brightness(.97); }
  .btn-approve:disabled, .btn-reject-outline:disabled { opacity: .6; cursor: not-allowed; }

  /* ===== Empty / loading states ===== */
  .empty-state { background: #fff; border: 1px dashed #cbd5e1; border-radius: 14px; padding: 36px 20px; text-align: center; color: #64748b; }
  .empty-state strong { display: block; font-size: 16px; color: #0c4a6e; margin-bottom: 4px; }
  .loading { color: var(--muted, #6B7280); text-align: center; padding: 30px 0; font-weight: 600; }

  /* ===== Modals ===== */
  .modal-wrap { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,.35); z-index: 80; animation: fadeIn .15s ease; }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  .modal { width: min(560px, 96vw); background: #fff; border-radius: 18px; box-shadow: 0 14px 40px rgba(0,0,0,.25); overflow: hidden; }
  .modal-hd { padding: 14px 18px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; position: relative; }
  .modal-ttl { font-weight: 700; font-size: 20px; color: #0F9B8E; width: 100%; text-align: center; }
  .modal-x { border: none; background: transparent; font-size: 22px; cursor: pointer; color: #475569; position: absolute; right: 18px; }
  .modal-bd { padding: 22px; max-height: 72vh; overflow: auto; }
  .muted { font-size: 13px; color: #64748b; }
  .form-ft { display: flex; justify-content: flex-end; gap: 10px; padding-top: 10px; }
  .btn-ghost { background: #fff; color: var(--ink, #1F2937); border: 1px solid var(--line, #e5e7eb); border-radius: 10px; padding: .7rem 1rem; font-weight: 600; cursor: pointer; }
  .btn-ghost:disabled { opacity: .6; cursor: not-allowed; }
  .btn-confirm-approve { background: var(--success, #16A34A); color: #fff; border: none; border-radius: 10px; padding: .7rem 1.2rem; font-weight: 600; cursor: pointer; }
  .btn-confirm-reject { background: var(--danger, #DC2626); color: #fff; border: none; border-radius: 10px; padding: .7rem 1.2rem; font-weight: 600; cursor: pointer; }
  .btn-confirm-approve:hover, .btn-confirm-reject:hover { filter: brightness(.96); }
  .btn-confirm-approve:disabled, .btn-confirm-reject:disabled { opacity: .6; cursor: not-allowed; }

  /* ===== Detail modal ===== */
  .detail-name { font-size: 18px; font-weight: 800; color: #000; margin: 0; }
  .detail-sub { font-size: 13px; color: #64748b; margin: 2px 0 14px; }
  .detail-kv { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 18px; margin-bottom: 14px; }
  .detail-kv .k { font-size: 11px; text-transform: uppercase; letter-spacing: .4px; font-weight: 800; color: #64748b; display: block; }
  .detail-kv .v { font-size: 14px; color: #0f172a; font-weight: 600; }
  .detail-section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-top: 12px; }
  .status-pill { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 800; background: #fef3c7; color: #92400e; }
  .attach-link { color: #2563eb; text-decoration: underline; font-size: 12px; }
  .no-attach { margin-top: 4px; color: #64748b; font-size: 12px; }

  /* ===== Toast ===== */
  .toast-stack { position: fixed; top: 20px; right: 20px; z-index: 9999; }
  .toast-item { display: flex; align-items: flex-start; background: #fff; border-radius: 8px; min-width: 340px; max-width: 400px; padding: 12px 14px; box-shadow: 0 10px 25px rgba(0,0,0,.15); animation: slideIn .25s ease; border-left: 5px solid; }
  .toast-icon { width: 28px; height: 28px; border-radius: 999px; display: flex; align-items: center; justify-content: center; margin-right: 12px; margin-top: 2px; }
  .toast-svg { width: 20px; height: 20px; fill: #fff; }
  .toast-body { flex: 1; }
  .toast-body strong { display: block; font-size: 14px; color: #111827; margin-bottom: 2px; }
  .toast-body p { margin: 0; font-size: 13px; color: #4b5563; }
  .toast-close { background: transparent; border: none; font-size: 18px; cursor: pointer; color: #9ca3af; margin-left: 10px; }
  .toast-close:hover { color: #111827; }
  .toast-item.success { border-color: var(--success, #16A34A); }
  .toast-item.success .toast-icon { background: var(--success, #16A34A); }
  .toast-item.error { border-color: #DC2626; }
  .toast-item.error .toast-icon { background: #DC2626; }
  .toast-item.info { border-color: #3b82f6; }
  .toast-item.info .toast-icon { background: #3b82f6; }
  .toast-item.warning { border-color: #f59e0b; }
  .toast-item.warning .toast-icon { background: #f59e0b; }
  @keyframes slideIn { from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: translateX(0) } }
  @keyframes fadeOut { from { opacity: 1; transform: translateX(0) } to { opacity: 0; transform: translateX(24px) } }
  .toast-item.closing { animation: fadeOut .25s ease forwards; }

  /* ===== Responsive ===== */
  @media (max-width: 740px) {
    .cards-grid { grid-template-columns: 1fr; }
    .detail-kv { grid-template-columns: 1fr; }
    .toolbar { align-items: stretch; }
    .filt.grow { min-width: 0; }
  }
</style>
<div class="main {compact ? 'compact-mode' : ''}">
  {#if !compact}
    <div class="page-head">
      <div class="toolbar">
        <div class="filt">
          <label for="apv-dept-filter">Department</label>
          <select id="apv-dept-filter" bind:value={deptFilter} aria-label="Filter by department">
            {#each deptOptions as d (d)}<option value={d}>{d}</option>{/each}
          </select>
        </div>

        <div class="filt">
          <label for="apv-type-filter">Leave type</label>
          <select id="apv-type-filter" bind:value={leaveTypeFilter} aria-label="Filter by leave type">
            {#each leaveTypeOptions as t (t)}
              <option value={t}>{t === "All" ? "All leave types" : getLeaveShortName(t)}</option>
            {/each}
          </select>
        </div>

        <div class="filt grow">
          <label for="apv-search">Search</label>
          <input
            id="apv-search"
            type="text"
            placeholder="Search name or staff ID…"
            bind:value={nameSearch}
            aria-label="Search by name or staff ID"
          />
        </div>

        <div class="filt">
          <label for="apv-sort">Sort by</label>
          <select id="apv-sort" bind:value={sortMode} aria-label="Sort leave requests">
            <option value="start">Soonest start date</option>
            <option value="oldest">Oldest request first</option>
          </select>
        </div>

        <button class="btn-clear-filters" type="button" on:click={clearFilters} aria-label="Clear all filters">Clear</button>

        <label class="select-all">
          <input
            type="checkbox"
            bind:this={selectAllEl}
            checked={allVisibleSelected}
            on:change={toggleSelectAll}
            aria-label="Select all visible requests"
          />
          <span>Select all</span>
        </label>
      </div>
    </div>
  {/if}

  {#if compact}
    <div class="mini-toolbar">
      <div class="filt">
        <label for="apv-dept-filter-compact">Department</label>
        <select id="apv-dept-filter-compact" bind:value={deptFilter} aria-label="Filter by department">
          {#each deptOptions as d (d)}<option value={d}>{d}</option>{/each}
        </select>
      </div>
      <button class="btn-clear-filters" type="button" on:click={clearFilters} aria-label="Clear filters">Clear</button>
    </div>
  {/if}

  {#if !compact && selectedIds.length > 0}
    <div class="bulk-bar">
      <span class="bulk-count">{selectedIds.length} {selectedIds.length === 1 ? "request" : "requests"} selected</span>
      <button class="btn-bulk-approve" on:click={() => bulkAction("approve")} disabled={bulkBusy}>{bulkBusy ? "Working…" : "Approve all"}</button>
      <button class="btn-bulk-reject" on:click={() => bulkAction("reject")} disabled={bulkBusy}>Reject all</button>
      <button class="btn-bulk-clear" on:click={clearSelection} disabled={bulkBusy}>Clear</button>
    </div>
  {/if}

  {#if loading}
    <div class="loading">Loading pending requests…</div>
  {:else}

    <div class="section">
      <!-- ======================== -->
      <!--   PENDING LEAVE APPROVAL -->
      <!-- ======================== -->
      {#if enrichedLeave.length > 0}
        <h3 class="sub-ttl">Pending Leave Approval ({visibleLeave.length})</h3>
        <div class="cards-grid">
          {#each enrichedLeave as { item, sig } (idOf(item))}
            <div class="pending-card" class:selected={!compact && selectedIds.includes(idOf(item))}>
              <div class="row1">
                {#if !compact}
                  <input
                    type="checkbox"
                    class="card-check"
                    checked={selectedIds.includes(idOf(item))}
                    on:change={() => toggleItem(item)}
                    aria-label={(`Select ${item.profile_name || item.staff_name || "request"}'s request`)}
                  />
                {/if}
                <div class="who">
                  <div class="name">{item.profile_name || item.staff_name}</div>
                  <div class="sub" title={`${item.requester_position || ""} • ${item.staff_id || ""} • ${item.profile_department || item.department || ""}`}>
                    {item.requester_position} • {item.staff_id} • {item.profile_department || item.department}
                  </div>
                </div>
                <span class={`pill type ${item.leave_type === "UNPAID" ? "unpaid-pill" : ""}`}>
                  {getLeaveShortName(item.leave_type)}
                </span>
              </div>

              <div class="duration">{durationLine(item)}</div>
              <div class="meta">{metaLine(item)}</div>

              <div class="sig-row">
                {#if sig.due !== null && sig.due >= 0 && sig.due <= 3}
                  <span class="sig-badge soon">
                    {sig.due === 0 ? "Starts today" : `Starts in ${sig.due} ${sig.due === 1 ? "day" : "days"}`}
                  </span>
                {/if}
                {#if sig.overlap > 0}
                  <span class="sig-badge overlap">
                    {sig.overlap} {sig.overlap === 1 ? "other" : "others"} on leave that week
                  </span>
                {/if}
              </div>

              <div class="actions">
                {#if canApprove(item)}
                  <button class="btn-approve" on:click={() => askConfirm(item, "approve", "leave")}>Approve</button>
                  <button class="btn-reject-outline" on:click={() => askConfirm(item, "reject", "leave")}>Reject</button>
                {:else}
                  <span class="view-only">View only</span>
                {/if}
                <button class="btn-details-link" on:click={() => openDetails(item)}>Details</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- =============================== -->
      <!--  PENDING CANCELLATION APPROVAL -->
      <!-- =============================== -->
      <div class="section" style={enrichedLeave.length > 0 ? "margin-top:24px;" : ""}>
        {#if enrichedCancel.length > 0}
          <h3 class="sub-ttl">Pending Cancellation Approval ({visibleCancel.length})</h3>
          <div class="cards-grid">
            {#each enrichedCancel as { item, sig } (idOf(item))}
              <div class="pending-card" class:selected={false}>
                <div class="row1">
                  <div class="who">
                    <div class="name">{item.profile_name || item.staff_name}</div>
                    <div class="sub" title={`${item.requester_position || ""} • ${item.staff_id || ""} • ${item.profile_department || item.department || ""}`}>
                      {item.requester_position} • {item.staff_id} • {item.profile_department || item.department}
                    </div>
                  </div>
                  <span class="pill type cancel-pill">
                    Cancellation: {getLeaveShortName(item.leave_type)}
                  </span>
                </div>

                <div class="duration">{durationLine(item)}</div>
                <div class="meta">{metaLine(item)}</div>

                <div class="sig-row">
                  {#if sig.due !== null && sig.due >= 0 && sig.due <= 3}
                    <span class="sig-badge soon">
                      {sig.due === 0 ? "Starts today" : `Starts in ${sig.due} ${sig.due === 1 ? "day" : "days"}`}
                    </span>
                  {/if}
                  {#if sig.overlap > 0}
                    <span class="sig-badge overlap">
                      {sig.overlap} {sig.overlap === 1 ? "other" : "others"} on leave that week
                    </span>
                  {/if}
                </div>

                <div class="actions">
                  {#if canApprove(item)}
                    <button class="btn-approve" on:click={() => askConfirm(item, "approve", "cancel")}>Approve</button>
                    <button class="btn-reject-outline" on:click={() => askConfirm(item, "reject", "cancel")}>Reject</button>
                  {:else}
                    <span class="view-only">View only</span>
                  {/if}
                  <button class="btn-details-link" on:click={() => openDetails(item)}>Details</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      {#if visibleLeave.length === 0 && visibleCancel.length === 0}
        {#if pendingLeave.length > 0 || pendingCancel.length > 0}
          <div class="empty-state">
            <strong>No matching requests</strong>
            Try adjusting the department, leave type, or search filter.
          </div>
        {:else}
          <div class="empty-state">
            <strong>No pending requests</strong>
            You're all caught up. New leave requests will appear here.
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>
<!-- ======================= -->
<!-- CONFIRM ACTION MODAL    -->
<!-- ======================= -->
{#if confirmState}
  <div class="modal-wrap" style="z-index:90;" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-hd">
        <div class="modal-ttl">
          {confirmState.verb === "approve" ? "Confirm Approval" : "Confirm Rejection"}
        </div>
        <button class="modal-x" on:click={closeConfirm} disabled={busy}>✕</button>
      </div>
      <div class="modal-bd" style="text-align:center;">
        <p style="margin:0 0 6px;">
          Are you sure you want to
          <strong>{confirmState.verb}</strong>
          {#if confirmState.kind === "cancel"}the cancellation request{:else}the leave request{/if}
          from
          <strong>{confirmState.item.profile_name || confirmState.item.staff_name}</strong>?
        </p>
        <p class="muted">This action is final and will be recorded.</p>

        <div class="form-ft" style="margin-top:20px; justify-content:center;">
          <button class="btn-ghost" on:click={closeConfirm} disabled={busy}>Cancel</button>
          <button
            class={confirmState.verb === "approve" ? "btn-confirm-approve" : "btn-confirm-reject"}
            on:click={performConfirm}
            disabled={busy}
          >
            {busy ? "Processing…" : confirmState.verb === "approve" ? "Yes, Approve" : "Yes, Reject"}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- ======================= -->
<!-- REQUEST DETAIL MODAL    -->
<!-- ======================= -->
{#if detailItem}
  <div class="modal-wrap" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-hd">
        <div class="modal-ttl">Leave Request Details</div>
        <button class="modal-x" on:click={closeDetails}>✕</button>
      </div>
      <div class="modal-bd">
        <h3 class="detail-name">{detailItem.profile_name || detailItem.staff_name}</h3>
        <p class="detail-sub">
          {detailItem.requester_position} • Staff ID: {detailItem.staff_id} • {detailItem.profile_department || detailItem.department}
        </p>

        <div class="detail-kv">
          <div>
            <span class="k">Request Type</span>
            <span class="v">
              {String(detailItem.status || "").toLowerCase().includes("cancel") ? "Cancellation" : "New Leave Request"}
            </span>
          </div>
          <div>
            <span class="k">Status</span>
            <span class="v"><span class="status-pill">{detailItem.status}</span></span>
          </div>
          <div>
            <span class="k">Leave Type</span>
            <span class="v">{getLeaveShortName(detailItem.leave_type)}</span>
          </div>
          <div>
            <span class="k">Total Days</span>
            <span class="v">{daysLabel(detailItem.total_days)}</span>
          </div>
          <div>
            <span class="k">Remaining Annual</span>
            <span class="v">{detailItem.leave_entitlement_annual ?? "-"} day(s)</span>
          </div>
          <div>
            <span class="k">Remaining Medical</span>
            <span class="v">{detailItem.leave_entitlement_medical ?? "-"} day(s)</span>
          </div>
          <div>
            <span class="k">Requested On</span>
            <span class="v">{fmt(detailItem.created_at)}</span>
          </div>
          <div>
            <span class="k">From</span>
            <span class="v">{fmt(detailItem.date_from)}</span>
          </div>
          <div>
            <span class="k">To</span>
            <span class="v">{fmt(detailItem.date_until)}</span>
          </div>
          <div>
            <span class="k">Role</span>
            <span class="v">{detailItem.requester_role || "-"}</span>
          </div>
        </div>

        {#if String(detailItem.status || "").toLowerCase().includes("cancel")}
          <div class="detail-section">
            <span class="k" style="display:block; font-size:11px; text-transform:uppercase; letter-spacing:.4px; font-weight:800; color:#64748b;">Cancellation Reason</span>
            <div style="margin-top:4px; color:#334155; font-size:13px;">{detailItem.cancellation_reason || "-"}</div>
          </div>
        {:else}
          <div class="detail-section">
            <span class="k" style="display:block; font-size:11px; text-transform:uppercase; letter-spacing:.4px; font-weight:800; color:#64748b;">Reason</span>
            <div style="margin-top:4px; color:#334155; font-size:13px;">{detailItem.reason || "-"}</div>
          </div>
        {/if}

        <div class="detail-section">
          <span class="k" style="display:block; font-size:11px; text-transform:uppercase; letter-spacing:.4px; font-weight:800; color:#64748b;">Attachment</span>
          {#if detailItem.attachment_path}
            <div style="margin-top:4px;">
              <a class="attach-link" href={attachmentUrl(detailItem.attachment_path)} target="_blank" rel="noopener">
                View Attachment
              </a>
            </div>
          {:else}
            <div class="no-attach">No attachment</div>
          {/if}
        </div>

        <div class="form-ft">
          <button class="btn-ghost" on:click={closeDetails}>Close</button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if toast.show}
  <div class="toast-stack">
    <div class="toast-item {toast.type} {toast.closing ? 'closing' : ''}">
      <div class="toast-icon">
        {#if toast.type === 'success'}
          <svg viewBox="0 0 24 24" class="toast-svg">
            <path d="M9.5 16.2L4.8 11.5l1.4-1.4 3.3 3.3 8.1-8.1 1.4 1.4z"/>
          </svg>
        {/if}

        {#if toast.type === 'error'}
          <svg viewBox="0 0 24 24" class="toast-svg">
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm3.5 13.1-1.4 1.4L12 13.4l-2.1 2.1-1.4-1.4L10.6 12 8.5 9.9l1.4-1.4 2.1 2.1 2.1-2.1 1.4 1.4L13.4 12z"/>
          </svg>
        {/if}

        {#if toast.type === 'info'}
          <svg viewBox="0 0 24 24" class="toast-svg">
            <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/>
          </svg>
        {/if}

        {#if toast.type === 'warning'}
          <svg viewBox="0 0 24 24" class="toast-svg">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
        {/if}
      </div>

      <div class="toast-body">
        <strong>{toast.title}</strong>
        <p>{toast.message}</p>
      </div>

      <button class="toast-close" on:click={() => (toast.show = false)}>×</button>
    </div>
  </div>
{/if}
