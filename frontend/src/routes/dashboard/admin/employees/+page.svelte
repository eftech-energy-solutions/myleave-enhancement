<script>
  // =======================
  // 1) APP STATE & HELPERS
  // =======================
  import { onMount } from "svelte";

  const leaveTypeFullName = {
    AL: "Annual / Emergency",
    MC: "Medical",
    MAT: "Maternity",
    PAT: "Paternity",
    COMP_A: "Compassionate A (Parent/Child/Spouse)",
    COMP_B: "Compassionate B (Grandparent/Sibling)",
    MAR: "Marriage",
    HOSP: "Hospitalization"
  };

  function getLeaveFullName(code) {
    return leaveTypeFullName[code] || code;
  }

  let profileMenuOpen = false;

  function clickOutside(node) {
    const onClick = (e) => {
      if (!node.contains(e.target)) profileMenuOpen = false;
    };
    document.addEventListener("click", onClick);
    return {
      destroy: () => document.removeEventListener("click", onClick)
    };
  }

  function handleKey(e) {
    if (e.key === "Escape") {
      if (sidebarOpen) sidebarOpen = false;
      if (profileMenuOpen) profileMenuOpen = false;
      if (addModalOpen) addModalOpen = false;
      if (detailsOpen) {
        detailsOpen = false;
        editMode = false;
      }
      if (showDeleteConfirm) showDeleteConfirm = false;
    }
  }

  const todayISO = () => new Date().toISOString().slice(0, 10);
  const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString() : "-");

  // =======================
  // CONSTANTS
  // =======================
  const DEPTS = [
    "Operations Support",
    "Technical Data",
    "Operations",
    "Sales & Technical Excellence",
    "Director"
  ];

  // =======================
  // EMPLOYEE VARIABLES
  // =======================
  let employees = [];
  let detailsById = {};
  let pending = [];
  let pendingLeave = [];
  let pendingCancel = [];
  let pendingRequests = [];
  let leaveDetailsOpen = {};

  // =======================
  // 3) LOAD FROM DATABASE
  // =======================
  function formatDate(dbDate) {
  if (!dbDate) return "";
  const d = new Date(dbDate);
  d.setHours(d.getHours() + 8); // Malaysia timezone fix
  return d.toISOString().split("T")[0];
}

  async function loadPendingRequests() {
  try {
    // 👉 buang ?status=pending, ambil SEMUA
    const res = await fetch("/api/leave-requests", {
      credentials: "include"
    });
    if (!res.ok) {
      console.error("❌ Failed to fetch pending:", res.status);
      return;
    }

    const all = await res.json();

    pendingRequests = all.filter(
  (r) =>
    r.status === "pending" ||
    r.status === "cancellation_pending"
);

pending = pendingRequests;


    // pecahkan ikut status
    pendingLeave  = pending.filter((p) => p.status === "pending");
    pendingCancel = pending.filter((p) => p.status === "cancellation_pending");

  } catch (err) {
    console.error("❌ Error loading pending:", err);
  }
}


  async function loadEmployees() {
    try {
      const res = await fetch("http://localhost:5000/api/employee", {
        credentials: "include"
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("❌ Failed to fetch employees:", data);
        return;
      }

      // Pending staff IDs
      const pendingIds = new Set(pendingRequests.map((r) => r.staff_id));

      // STEP 1 — Card list
      employees = data.map((emp) => ({
        id: emp.staff_id,
        name: emp.full_name,
        position: emp.position,
        role: emp.role,
        department: emp.department,
        photoUrl: emp.photourl
      }));

      // STEP 2 — Full profile store
      detailsById = {};

      const fullProfileList = data.map((emp) => {
        console.log("Backend returned:", emp.staff_id, emp.employment_date, emp.confirmation_date);
        const url = emp.photourl
          ? emp.photourl.startsWith("http")
            ? emp.photourl
            : `http://localhost:5000${emp.photourl}`
          : "";

        const profile = {
          id: emp.staff_id,
          empId: emp.staff_id,
          name: emp.full_name,
          position: emp.position,
          role: emp.role,
          department: emp.department,
          email: emp.email,
          photoUrl: url,
          employmentDate: formatDate(emp.employment_date),
          confirmationDate: formatDate(emp.confirmation_date),
          terminationDate: formatDate(emp.termination_date),
          gender: emp.gender,
          annualLeave: emp.leave_entitlement_annual_original,
          medicalLeave: emp.leave_entitlement_medical_original,
          notes: emp.notes
        };

        detailsById[emp.staff_id] = structuredClone(profile);
        return profile;
      });

      // STEP 3 — Remove pending staff from main grid
      employees = fullProfileList.filter((emp) => !pendingIds.has(emp.empId));
    } catch (err) {
      console.error("⚠️ Error in loadEmployees():", err);
    }
  }

  // =======================
  // PAGE LOAD
  // =======================
  onMount(async () => {
  try {
    await loadPendingRequests();
    await loadEmployees();
    // tak perlu filter lagi kat sini
  } catch (err) {
    console.error("❌ onMount error:", err);
  }
});


  // =======================
  // FILTERS
  // =======================
  let deptFilter = "All";

  const deptOptions = [
    "All",
    ...Array.from(new Set(DEPTS)).sort((a, b) =>
      a.localeCompare(b, "en", { sensitivity: "base" })
    )
  ];

  $: filteredEmployees = (
    deptFilter === "All"
      ? employees
      : employees.filter((e) => e.department === deptFilter)
  )
    .slice()
    .sort((a, b) => {
      const byName = a.name.localeCompare(b.name, "en", {
        sensitivity: "base"
      });
      return byName !== 0
        ? byName
        : a.id.localeCompare(b.id, "en", { sensitivity: "base" });
    });

  // =======================
  // SIDEBAR
  // =======================
  let sidebarOpen = false;
  const toggleSidebar = () => (sidebarOpen = !sidebarOpen);

  $: pendingCount = pendingLeave.length + pendingCancel.length;

  // =======================
  // ADD EMPLOYEE MODAL
  // =======================
  let addModalOpen = false;

  let newEmp = {
    photoUrl: "",
    photoFile: null,
    empId: "",
    name: "",
    email: "",
    position: "",
    role: "",
    employmentDate: "",
    terminationDate: "",
    confirmationDate: "",
    gender: "Male",
    annualLeave: "",
    medicalLeave: "",
    department: "Technical Data",
    notes: ""
  };

  function openAddModal() {
    addModalOpen = true;
    newEmp = {
      photoUrl: "",
      photoFile: null,
      empId: "",
      name: "",
      email: "",
      position: "",
      role: "",
      employmentDate: "",
      terminationDate: "",
      confirmationDate: "",
      gender: "Male",
      annualLeave: "",
      medicalLeave: "",
      department: "Technical Data",
      notes: ""
    };
  }

  async function handleNewPhotoFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    newEmp.photoUrl = URL.createObjectURL(file);
    newEmp.photoFile = file;
  }

  let employmentDateEl;

  async function submitNewEmployee(e) {
    e.preventDefault();

    if (
      !newEmp.empId ||
      !newEmp.name ||
      !newEmp.email ||
      !newEmp.position ||
      !newEmp.role
    ) {
      alert("Please fill Employee ID, Full Name, Email, Role and Position");
      return;
    }

    if (!newEmp.employmentDate) {
      alert("Please select the Employment Date.");
      employmentDateEl?.focus();
      return;
    }

    try {
      let uploadedPhotoUrl = "";

      if (newEmp.photoFile) {
        const formData = new FormData();
        formData.append("photo", newEmp.photoFile);

        const uploadRes = await fetch(
          "http://localhost:5000/api/upload",
          {
            method: "POST",
            body: formData
          }
        );

        const uploadData = await uploadRes.json();
        if (uploadData.success && uploadData.photoUrl) {
          uploadedPhotoUrl = uploadData.photoUrl;
        }
      }

      const res = await fetch("http://localhost:5000/api/employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoUrl: uploadedPhotoUrl,
          empId: newEmp.empId,
          name: newEmp.name,
          email: newEmp.email,
          position: newEmp.position,
          role: newEmp.role,
          department: newEmp.department,
          employmentDate: newEmp.employmentDate,
          confirmationDate: newEmp.confirmationDate,
          terminationDate: newEmp.terminationDate,
          gender: newEmp.gender,
          annualLeave: newEmp.annualLeave
            ? Number(newEmp.annualLeave)
            : null,
          medicalLeave: newEmp.medicalLeave
            ? Number(newEmp.medicalLeave)
            : null,
          notes: newEmp.notes
        })
      });

      const data = await res.json();

      if (res.ok) {
        const fullPhotoUrl = uploadedPhotoUrl.startsWith("http")
          ? uploadedPhotoUrl
          : `http://localhost:5000${uploadedPhotoUrl}`;

        const card = {
          id: newEmp.empId,
          name: newEmp.name,
          position: newEmp.position,
          role: newEmp.role,
          department: newEmp.department,
          photoUrl: fullPhotoUrl
        };

        employees = [card, ...employees];

        detailsById[newEmp.empId] = {
          photoUrl: fullPhotoUrl,
          empId: newEmp.empId,
          name: newEmp.name,
          email: newEmp.email,
          position: newEmp.position,
          role: newEmp.role,
          department: newEmp.department,
          employmentDate: newEmp.employmentDate,
          terminationDate: newEmp.terminationDate,
          confirmationDate: newEmp.confirmationDate,
          gender: newEmp.gender,
          annualLeave: String(newEmp.annualLeave ?? ""),
          medicalLeave: String(newEmp.medicalLeave ?? ""),
          notes: newEmp.notes
        };

        addModalOpen = false;
      } else {
        alert("❌ Failed to add employee: " + (data.error || data.message));
      }
    } catch (err) {
      console.error("Error submitting form:", err);
      alert("⚠️ Server error while adding employee.");
    }
  }

  // =======================
  // DETAILS MODAL
  // =======================
  let detailsOpen = false;
  let selectedEmp = null;
  let editMode = false;
  let detailsForm = null;
  let showDeleteConfirm = false;
  let employeeToDelete = null;

  function openDetails(item) {
    let profile = {};
    let leave = {};

    if (item.empId || detailsById[item]) {
      const id = item.empId || item;
      profile = structuredClone(detailsById[id] || {});
    }

    if (item.leave_id) {
      leave = structuredClone(item);
      const staffId = leave.staff_id;
      if (detailsById[staffId])
        profile = structuredClone(detailsById[staffId]);
    }

    const merged = {
      ...profile,
      leave_id: leave.leave_id,
      leave_type: leave.leave_type,
      request_type: leave.request_type,
      reason: leave.reason,
      date_from: leave.date_from,
      date_until: leave.date_until,
      created_at: leave.created_at,
      status: leave.status,
      attachment_path: leave.attachment_path,

      // Overwrite/fill missing
      empId: profile.empId || leave.staff_id,
      name: profile.name || leave.profile_name || leave.staff_name || "",
      department: profile.department || leave.department || "",
      email: profile.email || leave.email || "",
      role: profile.role || leave.requester_role || "",
      position: profile.position || leave.requester_position || "",
      employmentDate: profile.employmentDate ?? leave.employment_date ?? "",
      confirmationDate: profile.confirmationDate ?? leave.confirmation_date ?? "",
      terminationDate: profile.terminationDate ?? leave.termination_date ?? "",
      gender: profile.gender || leave.gender || ""
    };

    selectedEmp = merged;
    detailsForm = structuredClone(merged);

    editMode = false;
    detailsOpen = true;
  }

  async function handleEditPhotoFile(e) {
    const file = e.target.files[0];
    if (!file || !detailsForm) return;

    detailsForm.photoFile = file;
    detailsForm.photoUrl = URL.createObjectURL(file);
  }

  async function toggleEditSave() {
    if (!selectedEmp || !detailsForm) return;

    // SAVE MODE
    if (editMode) {
      if (!detailsForm.name || !detailsForm.role || !detailsForm.position) {
        alert("Name, Role and Position are required.");
        return;
      }

      try {
        let finalRelativePhotoUrl = detailsForm.photoUrl || "";

        if (detailsForm.photoFile) {
          const formData = new FormData();
          formData.append("photo", detailsForm.photoFile);

          const uploadRes = await fetch(
            "http://localhost:5000/api/upload/profile",
            { method: "POST", body: formData }
          );

          const uploadData = await uploadRes.json();
          if (!uploadData.success)
            return alert("❌ Failed to upload photo.");

          finalRelativePhotoUrl = uploadData.photoUrl;
        }

        // Normalise
        const prefix = "http://localhost:5000";
        if (finalRelativePhotoUrl.startsWith(prefix)) {
          finalRelativePhotoUrl = finalRelativePhotoUrl.replace(prefix, "");
        }

        const res = await fetch(
          `http://localhost:5000/api/employee/${selectedEmp.empId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              staff_id: detailsForm.empId,
              photo_url: finalRelativePhotoUrl,
              full_name: detailsForm.name,
              email: detailsForm.email,
              position: detailsForm.position,
              role: detailsForm.role,
              department: detailsForm.department,
              employment_date: detailsForm.employmentDate,
              confirmation_date: detailsForm.confirmationDate,
              termination_date: detailsForm.terminationDate,
              gender: detailsForm.gender,
              leave_entitlement_annual: detailsForm.annualLeave,
              leave_entitlement_medical: detailsForm.medicalLeave,
              notes: detailsForm.notes
            })
          }
        );

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update employee");

        // HANDLE ID CHANGE
        const oldId = selectedEmp.empId;
        const newId = detailsForm.empId;

        if (newId && newId !== oldId) {
          detailsById[newId] = {
            ...detailsById[oldId],
            empId: newId
          };
          delete detailsById[oldId];

          const idx = employees.findIndex((e) => e.id === oldId);
          if (idx !== -1) {
            employees[idx] = {
              ...employees[idx],
              id: newId
            };
            employees = [...employees];
          }

          selectedEmp.empId = newId;
        }

        const fullPhoto = finalRelativePhotoUrl
          ? `http://localhost:5000${finalRelativePhotoUrl}`
          : "";

        detailsForm.photoUrl = fullPhoto;
        detailsForm.photoFile = null;

        detailsById[selectedEmp.empId] = structuredClone(detailsForm);
        selectedEmp = structuredClone(detailsForm);

        const idx = employees.findIndex(
          (e) => e.id === selectedEmp.empId
        );
        if (idx !== -1) {
          employees[idx] = {
            ...employees[idx],
            name: detailsForm.name,
            role: detailsForm.role,
            position: detailsForm.position,
            department: detailsForm.department
          };
          employees = [...employees];
        }
        await loadEmployees();
        editMode = false;
      } catch (err) {
        console.error("❌ Error updating employee:", err);
        alert("Failed to update employee.");
      }

      return;
    }

    // EDIT MODE
    await loadEmployees();
    editMode = true;
    if (detailsForm) detailsForm.photoFile = null;
  }

  // =======================
  // LEAVE APPROVAL
  // =======================
  async function approve(id) {
    try {
      await fetch(`/api/leave-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" })
      });

      await loadPendingRequests();
      await loadEmployees();

    } catch (err) {
      console.error("❌ Error approving:", err);
    }
  }

  async function reject(id) {
    try {
      await fetch(`/api/leave-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" })
      });

      await loadPendingRequests();
      await loadEmployees();

    } catch (err) {
      console.error("❌ Error rejecting:", err);
    }
  }

  function approveRequest(item) {
    const id = item.leave_id ?? item.leaveid ?? item.id;
    approve(id);
  }

  function rejectRequest(item) {
    const id = item.leave_id ?? item.leaveid ?? item.id;
    reject(id);
  }

  // =======================
  // DELETE EMPLOYEE
  // =======================
  function openDeleteConfirm() {
    if (!selectedEmp) return;
    employeeToDelete = selectedEmp;
    showDeleteConfirm = true;
  }

async function deleteEmployee() {
  if (!employeeToDelete) return;

  const empId = employeeToDelete.empId || employeeToDelete.id;

  try {
    // DELETE from backend
    await fetch(`http://localhost:5000/api/leave-requests/by-staff/${empId}`, {
      method: "DELETE",
      credentials: "include"
    });

    const res = await fetch(`http://localhost:5000/api/employee/${empId}`, {
      method: "DELETE",
      credentials: "include"
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to delete employee");

    // CLOSE ALL MODALS FIRST
    showDeleteConfirm = false;
    detailsOpen = false;

    // CLEAR ALL SELECTED DATA
    selectedEmp = null;
    detailsForm = null;
    employeeToDelete = null;

    // UPDATE UI (remove card)
    employees = employees.filter(e => e.id !== empId);
    delete detailsById[empId];

  } catch (err) {
    console.error("❌ Error deleting employee:", err);
  }
}



  async function approveCancellation(item) {
  const id = item.leave_id;

  await fetch(`/api/leave-requests/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "cancelled" })
  });

  await loadPendingRequests();
  await loadEmployees();
}
async function rejectCancellation(item) {
  const id = item.leave_id;

  await fetch(`/api/leave-requests/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "rejected" })  // ✔️ FIX
  });

  await loadPendingRequests();
  await loadEmployees();
}

</script>


<svelte:window on:keydown={handleKey} />

<style>
  :global(html, body){ height:100%; margin:0; }
  :root { --primary:#49bdb3; --ink:#0c4a6e ; --muted:#64748b; --line:#e5e7eb; --soft:#f8fafc; }
  :global(body){ font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans"; background:url('/images/bg.png') no-repeat center center fixed; background-size:cover; overflow-y:auto; }

  /* Links / Actions */
  .add-employee-link { color:#fff; text-decoration: underline; font-size:16px; font-weight:600; cursor:pointer; white-space:nowrap; margin-top:10px; }
  .add-employee-link:hover { opacity:.85; }

  /* ===== Layout ===== */
  .main{ padding:1.5rem; }
  .toprow{ display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; margin-top: -35px; }
  .rightcol{ display:flex; align-items:center; gap:6px; }

  /* ===== Employees grid & card ===== */
  .employees-grid{ display:grid; gap:1rem; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));}
  .emp-box{ background:#fff; border-radius:12px; padding:1rem; color:#111; box-shadow:0 1px 3px rgba(0,0,0,.08); display:flex; flex-direction:column; min-height:240px; }
  .emp-top{ text-align:center; }
  .emp-box h3{ margin:0; font-size:15px; color:#217859; }
  .emp-box p{ margin:2px 0; font-size:12px; color:#334155; }
  .emp-spacer{ flex:1 1 auto; }
  .emp-actions{ margin-top:auto; display:flex; justify-content:center; }
  .btn{ border:none; border-radius:8px; padding:.42rem .75rem; font-size:12px; cursor:pointer; font-weight:700; }
  .btn.details{ background:#e0f2fe; color:#000; }

  /* ===== Avatar ===== */
  .avatar-wrap, .details-avatar-wrap{ position:relative; width:64px; height:64px; margin:0 auto .5rem; border-radius:9999px; overflow:hidden; background:#e5e7eb; border:1px solid #e5e7eb; }
  .details-avatar-wrap{ width:72px; height:72px; margin:0; }
  .avatar-wrap img, .details-avatar-wrap img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; border-radius:9999px; }
  .avatar-fallback, .details-avatar-fallback{ position:absolute; inset:0; display:grid; place-items:center; }
  .avatar-fallback svg, .details-avatar-fallback svg{ width:60%; height:60%; }

  /* ===== Sidebar ===== */
  .overlay{ position:fixed; inset:0; background:rgba(0,0,0,.25); opacity:0; pointer-events:none; transition:opacity .2s; z-index:40; }
  .overlay.show{ opacity:1; pointer-events:auto; }
  .sidebar{ position:fixed; right:0; top:0; height:100vh; width:420px; max-width:92vw; background:#fff; box-shadow:-14px 0 32px rgba(0,0,0,.18); transform:translateX(100%); transition:transform .25s ease; z-index:60; display:flex; flex-direction:column; }
  .sidebar.open{ transform:translateX(0); }
  .sidebar-header{ display:flex; justify-content:space-between; align-items:center; padding:14px 16px; border-bottom:1px solid var(--line); }
  .sidebar-title{ font-size:18px; font-weight:700; color:#000; }
  .close-btn{ border:none; background:transparent; font-size:22px; cursor:pointer; color:#475569; }
  .sidebar-body{ padding:14px 16px; overflow:auto; flex:1; }
  .sidebar-footer{ padding:12px 16px; border-top:1px solid var(--line); display:flex; justify-content:flex-end; }
  .cancel-btn{ border:1px solid var(--line); background:#fff; color:#000; border-radius:8px; padding:.45rem .8rem; font-weight:700; cursor:pointer; }
  .sub-ttl{ margin: 0 0 10px; font-weight: 800; font-size: 14px; letter-spacing:.2px; color: var(--ink); }

  .sidebar-tab{ position:fixed; right:0; top:40%; transform:translateY(-50%); display:flex; align-items:center; gap:8px; background:#0c4a6e; color:#fff; padding:.6rem .95rem .6rem 1rem; border-top-left-radius:9999px; border-bottom-left-radius:9999px; cursor:pointer; user-select:none; z-index:50; box-shadow:0 8px 20px rgba(0,0,0,.25); }
  .sidebar-tab .label{ font-weight:700; font-size:14px; }
  .badge{ min-width:22px; height:22px; display:inline-grid; place-items:center; background:#e30707; color:#fff; font-weight:800; border-radius:9999px; font-size:12px; padding:0 6px; }

  /* ===== Pending card ===== */
  .pending-card{ background:#fff; border:1px solid var(--line); border-radius:14px; padding:12px 14px; margin-bottom:12px; box-shadow:0 8px 20px rgba(0,0,0,.06); }
  .pending-card .row1{ display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
  .pending-card .name{ font-weight:800; color:#000; font-size:16px; }
  .pending-card .sub{ font-size:12px; color:#64748b; }
  .pill.type{ background:#eef2ff; color:#0f172a; border:1px solid #e5e7eb; padding:4px 10px; border-radius:9999px; font-size:12px; font-weight:700; white-space:nowrap; }
  .kv{ display:grid; grid-template-columns:repeat(2,1fr); gap:6px 14px; margin:8px 0 6px; font-size:12px; }
  .kv .k{ font-weight:700; color:#334155;}
  .kv .v{ color:#0f172a; margin-left: 6px; }
  .actions{ display:flex; justify-content:space-between; align-items:center; margin-top:10px; }
  .actions .left{ display:flex; gap:8px; align-items:center; }
  .btn-approve, .btn-reject, .btn-details{ border:none; border-radius:8px; padding:.55rem .9rem; font-weight:700; cursor:pointer; min-width:50px; line-height:1; font-size: 12px; }
  .btn-approve{ background:#16a34a; color:#fff; }
  .btn-reject { background:#dc2626; color:#fff; }
  .btn-details{ background:#e0f2fe; color:#0c4a6e; }
  .btn-approve:hover, .btn-reject:hover, .btn-details:hover{ filter:brightness(.97); }

  /* ===== Modals (Add / Details) ===== */
  .modal-wrap{ position:fixed; inset:0; display:grid; place-items:center; background:rgba(0,0,0,.35); z-index:80; animation:fadeIn .15s ease; }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  .modal{ width:min(900px, 96vw); background:#fff; border-radius:18px; box-shadow:0 14px 40px rgba(0,0,0,.25); overflow:hidden; }
  .modal-hd{ padding:14px 18px; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between; }
  .modal-ttl{ font-weight:700; font-size:22px; color:#49bdb3; }
  .modal-x{ border:none; background:transparent; font-size:22px; cursor:pointer; color:#475569; }
  .modal-bd{ padding:0; max-height:72vh; overflow:auto; }

  .add-layout, .details-layout{ padding:22px; }
  .section-ttl{ font-weight:700; color:#0c4a6e; margin:0 0 14px; font-size:18px; }
  .add-grid, .details-grid-form{ display:grid; grid-template-columns: 1fr 220px; gap:20px; }
  .photo-card{ align-self:flex-start; justify-self:end; width:180px; height:180px; border-radius:20px; background:linear-gradient(180deg,#fff,#f3f4f6); border:1px dashed #d1d5db; display:grid; place-items:center; position:relative; box-shadow:0 8px 20px rgba(0,0,0,.06); }
  .photo-card input{ position:absolute; inset:0; opacity:0; cursor:pointer; }
  .photo-card .cam{ width:48px; height:48px; border-radius:9999px; background:#49bdb3; display:grid; place-items:center; color:#fff; font-size:20px; box-shadow:0 6px 14px rgba(73,189,179,.35); }
  .photo-card .cam svg { width: 24px; height: 24px; } /* Smaller camera icon */
  .photo-preview{ position:absolute; inset:0; overflow:hidden; border-radius:20px; }
  .photo-preview img{ width:100%; height:100%; object-fit:cover; display:block; }

  .form{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:18px; box-shadow:0 6px 18px rgba(0,0,0,.05); }
  .row{ display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:12px; }
  .row.three{ grid-template-columns:2.1fr 1fr 1fr; }
  .row.single{ grid-template-columns:1fr; }
  label{ font-size:12px; color:#374151; font-weight:700; margin:0 0 6px; display:block; }
  .ctl{ display:flex; align-items:center; background:#fff; border:1px solid var(--line); border-radius:12px; padding:10px 12px; box-shadow: inset 0 1px 0 rgba(0,0,0,.02); }
  .ctl:focus-within{ border-color:#49bdb3; box-shadow:0 0 0 3px rgba(73,189,179,.15); }
  .ctl input, .ctl select, .ctl textarea{ border:none; outline:none; width:100%; font-size:14px; color:#111827; background:transparent; }
  .ctl textarea{ min-height:90px; resize:vertical; }
  .ctl.disabled{ background:#f8fafc; }
  .ctl :disabled{ color:#6b7280; }
  .form-ft{ display:flex; justify-content:flex-end; gap:10px; padding-top:10px; margin-top:8px; }
  .btn-ghost{ background:#fff; color:#0c4a6e; border:1px solid var(--line); border-radius:12px; padding:.7rem 1rem; font-weight:700; cursor:pointer; }
  .btn-primary{ background:#49bdb3; color:#fff; border:none; border-radius:10px; padding:.8rem 1.4rem; font-weight:700; cursor:pointer; }
  .btn-primary:hover{ filter:brightness(.96); }
  .btn-danger { background:#dc2626; color:#fff; border:none; border-radius:10px; padding:.8rem 1.4rem; font-weight:700; cursor:pointer; }
  .btn-danger:hover { filter:brightness(.96); }

  /* Date inputs with calendar icon on the right */
  .ctl.date { position:relative; }
  .ctl.date::after{ content:""; position:absolute; right:12px; top:50%; transform:translateY(-50%); width:18px; height:18px; opacity:.7; background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" stroke="%2364748b" fill="none" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" ry="2" stroke-width="2"/><line x1="16" y1="3" x2="16" y2="7" stroke-width="2"/><line x1="8" y1="3" x2="8" y2="7" stroke-width="2"/><line x1="3" y1="11" x2="21" y2="11" stroke-width="2"/></svg>') no-repeat center / contain; pointer-events:none; }
  input[type="date"]{ padding-right:34px; }

  /* ===== Filters (topbar right) ===== */
  .filter-wrap { display:flex; align-items:center; gap:6px; }
  .filter-label { margin: 0 6px; font-weight: 600; font-size: 14px; color: #fff; }
  .filter-icon { width: 16px; height: 16px; color: #fff; opacity: 0.9; }
  .filter-select { padding:4px 8px; min-width:180px; border-radius: 9999px; } /* Pill shape */
  .filter-select select { font-size:13px; padding:4px 6px; height:28px; }

  /* ===== Confirmation Modal specific styles ===== */
  .modal.confirm-modal { width: min(450px, 94vw); }
  .modal.confirm-modal .modal-hd {
    position: relative;
    justify-content: center;
  }
  .modal.confirm-modal .modal-x {
    position: absolute;
    right: 18px;
  }
  .modal.confirm-modal .muted { font-size: 14px; margin-top: 8px; }

  /* ===== Responsive ===== */
  @media (max-width:740px){
    .add-grid, .details-grid-form{ grid-template-columns:1fr; }
    .photo-card{ justify-self:stretch; width:100%; height:180px; }
  }
  @media (max-width:640px){
    .employees-grid{ grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
  }
</style>

<!-- ======================= -->
<!-- 9) TOP BAR + GRID       -->
<!-- ======================= -->
<div class="main">
  <div class="toprow">
    <!-- Left: Add New Employee as underlined link -->
    <a href="#" class="add-employee-link" on:click|preventDefault={openAddModal}>Add New Employee</a>

    <!-- Right: Department Filter -->
    <div class="rightcol filter-wrap">
      <svg class="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 4h18l-7 8v6l-4 2v-8l-7-8z"/>
      </svg>
      <label class="filter-label" for="dept-filter">Department</label>
      <div class="ctl filter-select">
        <select id="dept-filter" bind:value={deptFilter} aria-label="Filter by department">
          {#each deptOptions as d}<option value={d}>{d}</option>{/each}
        </select>
      </div>
    </div>
  </div>

  <!-- Employees grid -->
  <div class="employees-grid">
    {#each filteredEmployees as emp (emp.id)}
      <div class="emp-box">
        <div class="emp-top" aria-label="Employee summary">
          <div class="avatar-wrap">
            <div class="avatar-fallback">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="4" fill="#9ca3af"/>
                <path d="M4 20c0-4.2 4.2-6.5 8-6.5s8 2.3 8 6.5" fill="#9ca3af"/>
              </svg>
            </div>
            {#if detailsById[emp.id]?.photoUrl}
            {console.log('Rendering image URL:', detailsById[emp.id]?.photoUrl)}
            <img
              src={detailsById[emp.id]?.photoUrl || ""}
              alt="profile"
              on:error={(e) => (e.currentTarget.style.display = 'none')}
            />
          {/if}
          </div>
          <h3>{emp.name}</h3>
          <p>{emp.position}</p>
          <p>Staff ID: {emp.id}</p>
          <p>Department: {emp.department}</p>
        </div>
        <div class="emp-spacer"></div>
        <div class="emp-actions">
          <button class="btn details" on:click={() => openDetails(emp.id)}>Details</button>
        </div>
      </div>
    {/each}
  </div>
</div>

<!-- ======================= -->
<!-- 10) SIDEBAR + TAB       -->
<!-- ======================= -->
<div class:show={sidebarOpen} class="overlay" on:click={toggleSidebar}></div>

<div class:open={sidebarOpen} class="sidebar" aria-hidden={!sidebarOpen}>
  <div class="sidebar-header">
    <div class="sidebar-title">
      Pending Approval{pendingCount > 0 ? ` (${pendingCount})` : ''}
    </div>
    <button class="close-btn" on:click={toggleSidebar}>✕</button>
  </div>
  <div class="sidebar-body">
    {#if pending.length === 0}
      <p style="color:#64748b; text-align:center;">No pending requests.</p>
    {:else}

      <!-- ======================== -->
      <!--   PENDING LEAVE APPROVAL -->
      <!-- ======================== -->
      {#if pendingLeave.length > 0}
        <h3 class="sub-ttl">Pending Leave Approval ({pendingLeave.length})</h3>

        {#each pendingLeave as item (item.leave_id)}
          <div class="pending-card">

            <!-- Header -->
            <div class="row1">
              <div class="who">
                <div class="name">{item.profile_name || item.staff_name}</div>
                <div class="sub">
                  {item.requester_position} • {item.staff_id} • {item.profile_department || item.department}
                </div>
              </div>
              <span class="pill type">{getLeaveFullName(item.leave_type) || "Leave"}</span>
            </div>

            <!-- Dates -->
            <div class="kv">
              <div>
                <span class="k">From:</span>
                <span class="v">{fmt(item.date_from)}</span>
              </div>
              <div>
                <span class="k">To:</span>
                <span class="v">{fmt(item.date_until)}</span>
              </div>
              <div>
                <span class="k">Requested:</span>
                <span class="v">{fmt(item.created_at)}</span>
              </div>
            </div>

            <!-- ACTIONS + INLINE LEAVE DETAILS LINK -->
            <div class="actions">
              <div class="left">
                <button class="btn-approve" on:click={() => approveRequest(item)}>Approve</button>
                <button class="btn-reject" on:click={() => rejectRequest(item)}>Reject</button>
              </div>

              <div style="display:flex; align-items:center; gap:10px;">
                <span
                  style="text-decoration: underline; cursor:pointer; color:#0c4a6e; font-size:12px;"
                  on:click={() => leaveDetailsOpen[item.leave_id] = !leaveDetailsOpen[item.leave_id]}
                >
                  {leaveDetailsOpen[item.leave_id] ? "Hide Details" : "Leave Details"}
                </span>

                <button class="btn-details" on:click={() => openDetails(item)}>
                  Details
                </button>
              </div>
            </div>

            <!-- EXPANDED BOX -->
            {#if leaveDetailsOpen[item.leave_id]}
              <div
                style="
                  background:#f8fafc;
                  border:1px solid #e2e8f0;
                  padding:10px;
                  border-radius:8px;
                  margin-top:10px;
                "
              >
                <div>
                  <strong style="color:#0c4a6e; font-size:13px;">Reason:</strong>
                  <div style="margin-top:4px; color:#334155; font-size:12px;">{item.reason}</div>
                </div>

                <div style="margin-top:8px;">
                  <strong style="color:#0c4a6e; font-size:13px;">Attachment:</strong>

                  {#if item.attachment_path}
                    <div style="margin-top:4px;">
                      <a
                        href={"http://localhost:5000/" + item.attachment_path}
                        target="_blank"
                        style="color:#2563eb; text-decoration: underline; font-size:12px;"
                      >
                        View Attachment
                      </a>
                    </div>
                  {:else}
                    <div style="margin-top:4px; color:#64748b; font-size:12px;">No attachment</div>
                  {/if}
                </div>
              </div>
            {/if}

          </div>
        {/each}
      {/if}

      <!-- =============================== -->
      <!--  PENDING CANCELLATION APPROVAL -->
      <!-- =============================== -->
      {#if pendingCancel.length > 0}
        <h3 class="sub-ttl" style="margin-top:20px;">
          Pending Cancellation Approval ({pendingCancel.length})
        </h3>

        {#each pendingCancel as item (item.leave_id)}
          <div class="pending-card">

            <!-- Header -->
            <div class="row1">
              <div class="who">
                <div class="name">{item.profile_name || item.staff_name}</div>
                <div class="sub">
                  {item.requester_position} • {item.staff_id} • {item.profile_department || item.department}
                </div>
              </div>
              <span class="pill type" style="background:#fee2e2; color:#b91c1c;">
                Cancellation: {getLeaveFullName(item.leave_type)}
              </span>
            </div>

            <!-- Dates -->
            <div class="kv">
              <div><span class="k">Leave From:</span> <span class="v">{fmt(item.date_from)}</span></div>
              <div><span class="k">Leave To:</span> <span class="v">{fmt(item.date_until)}</span></div>
              <div><span class="k">Requested:</span> <span class="v">{fmt(item.created_at)}</span></div>
            </div>

            <!-- ACTIONS + INLINE LEAVE DETAILS LINK -->
            <div class="actions">
              <div class="left">
                <button class="btn-approve" on:click={() => approveCancellation(item)}>Approve</button>
                <button class="btn-reject" on:click={() => rejectCancellation(item)}>Reject</button>
              </div>

              <div style="display:flex; align-items:center; gap:10px;">
                <span
                  style="text-decoration: underline; cursor:pointer; color:#0c4a6e; font-size:12px;"
                  on:click={() => leaveDetailsOpen[item.leave_id] = !leaveDetailsOpen[item.leave_id]}
                >
                  {leaveDetailsOpen[item.leave_id] ? "Hide Details" : "Leave Details"}
                </span>

                <button class="btn-details" on:click={() => openDetails(item)}>
                  Details
                </button>
              </div>
            </div>

            <!-- EXPANDED BOX -->
            {#if leaveDetailsOpen[item.leave_id]}
              <div
                style="
                  background:#f8fafc;
                  border:1px solid #e2e8f0;
                  padding:10px;
                  border-radius:8px;
                  margin-top:10px;
                "
              >
                <div>
                  <strong style="color:#0c4a6e; font-size:13px;">Reason:</strong>
                  <div style="margin-top:4px; color:#334155; font-size:12px;">{item.reason}</div>
                </div>

                <div style="margin-top:8px;">
                  <strong style="color:#0c4a6e; font-size:13px;">Attachment:</strong>

                  {#if item.attachment_path}
                    <div style="margin-top:4px;">
                      <a
                        href={"http://localhost:5000/" + item.attachment_path}
                        target="_blank"
                        style="color:#2563eb; text-decoration: underline; font-size:12px;"
                      >
                        View Attachment
                      </a>
                    </div>
                  {:else}
                    <div style="margin-top:4px; color:#64748b; font-size:12px;">No attachment</div>
                  {/if}
                </div>
              </div>
            {/if}

          </div>
        {/each}
      {/if}

    {/if}
  </div>


  <div class="sidebar-footer">
    <button class="cancel-btn" on:click={() => (sidebarOpen = false)}>Cancel</button>
  </div>
</div>

<!-- ======================= -->
<!-- 11) ADD EMPLOYEE MODAL  -->
<!-- ======================= -->
{#if addModalOpen}
  <div class="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="add-emp-title">
    <div class="modal">
      <div class="modal-hd">
        <div id="add-emp-title" class="modal-ttl">Add New Employee</div>
        <button class="modal-x" on:click={() => (addModalOpen = false)}>✕</button>
      </div>
      <div class="modal-bd">
        <div class="add-layout">
          <div class="add-grid">
            <!-- Left form -->
            <form class="form" on:submit={submitNewEmployee}>
              <div class="row">
                <div>
                  <label>Full Name</label>
                  <div class="ctl pill"><input name="full_name" placeholder="Enter full name" bind:value={newEmp.name} autocomplete="on" required /></div>
                </div>
                <div>
                  <label>Staff ID</label>
                  <div class="ctl pill"><input placeholder="Enter Staff ID" bind:value={newEmp.empId} /></div>
                </div>
              </div>

              <div class="row">
                <div>
                  <label>Position</label>
                  <div class="ctl pill"><input name="position" placeholder="e.g., Data Engineer" bind:value={newEmp.position} autocomplete="on" required /></div>
                </div>
                <div>
                  <label>Department</label>
                  <div class="ctl pill">
                    <select bind:value={newEmp.department}>
                      {#each DEPTS as d}<option value={d}>{d}</option>{/each}
                    </select>
                  </div>
                </div>
              </div>

              <div class="row">
                <div>
                  <label>Email</label>
                  <div class="ctl pill"><input type="email" name="email" placeholder="name@company.com" bind:value={newEmp.email} autocomplete="on" required /></div>
                </div>
                <div>
                  <label>Employment Date</label>
                  <div class="ctl pill date">
                    <input type="date" bind:value={newEmp.employmentDate} required bind:this={employmentDateEl} />
                  </div>
                </div>
              </div>

              <div class="row">
                <div>
                  <label>Confirmation Date</label>
                  <div class="ctl pill date"><input type="date" bind:value={newEmp.confirmationDate} /></div>
                </div>
                <div>
                  <label>Termination Date</label>
                  <div class="ctl pill date"><input type="date" bind:value={newEmp.terminationDate} /></div>
                </div>
              </div>

              <div class="row three">
                <div>
                  <label>Gender</label>
                  <div class="ctl pill">
                    <select bind:value={newEmp.gender}>
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label>Annual Leave</label>
                  <div class="ctl pill"><input type="number" step="0.5" min="0" bind:value={newEmp.annualLeave} /></div>
                </div>
                <div>
                  <label>Medical Leave</label>
                  <div class="ctl pill"><input type="number" step="0.5" min="0" bind:value={newEmp.medicalLeave} /></div>
                </div>
              </div>
              <div>
                  <label>Role</label>
                  <div class="ctl pill">
                    <select bind:value={newEmp.role}>
                      <option>Admin</option>
                      <option>Manager</option>
                      <option>Staff</option>
                    </select>
                  </div>
                </div>
                <div>
            </div>

              <div class="row single">
                <div>
                  <label>Notes</label>
                  <div class="ctl"><textarea placeholder="Optional notes…" bind:value={newEmp.notes} /></div>
                </div>
              </div>

              <div class="form-ft">
                <button type="button" class="btn-ghost" on:click={() => (addModalOpen = false)}>Cancel</button>
                <button type="submit" class="btn-primary">Save &amp; Continue</button>
              </div>
            </form>

            <!-- Right: Photo uploader -->
            <div class="photo-card" title="Add Photo">
              {#if newEmp.photoUrl}
                <div class="photo-preview"><img src={newEmp.photoUrl} alt="Preview" /></div>
              {:else}
                <div class="cam" aria-label="Add photo (PNG/JPG)">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1 2 2H4a2 2 0 0 1-2 2V9a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </div>
                <div class="muted" style="position:absolute; bottom:10px;">Add Photo</div>
              {/if}
              <input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" on:change={handleNewPhotoFile} />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- ======================= -->
<!-- 12) DETAILS MODAL       -->
<!-- ======================= -->
{#if detailsOpen && selectedEmp}
  <div class="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="emp-details-title">
    <div class="modal">
      <div class="modal-hd">
        <div id="emp-details-title" class="modal-ttl">Employee Details</div>
        <button class="modal-x" on:click={() => { detailsOpen = false; editMode = false; }}>✕</button>
      </div>
      <div class="modal-bd">
        <div class="details-layout">
          <div class="details-grid-form">
            <!-- Left form -->
            <div class="form">
              <!-- FULL NAME + STAFF ID -->
<div class="row">
  <div>
    <label>Full Name</label>
    <div class={"ctl pill " + (!editMode ? 'disabled' : '')}>
      <input bind:value={detailsForm.name} disabled={!editMode} />
    </div>
  </div>
  <div>
    <label>Staff ID</label>
    <div class={"ctl pill " + (!editMode ? 'disabled' : '')}>
      <input bind:value={detailsForm.empId} disabled={!editMode} />
    </div>
  </div>
</div>

<!-- POSITION + DEPARTMENT -->
<div class="row">
  <div>
    <label>Position</label>
    <div class={"ctl pill " + (!editMode ? 'disabled' : '')}>
      <input bind:value={detailsForm.position} disabled={!editMode} />
    </div>
  </div>
  <div>
    <label>Department</label>
    <div class={"ctl pill " + (!editMode ? 'disabled' : '')}>
      <select bind:value={detailsForm.department} disabled={!editMode}>
        {#each DEPTS as d}
          <option value={d}>{d}</option>
        {/each}
      </select>
    </div>
  </div>
</div>

<!-- EMAIL + EMPLOYMENT DATE -->
<div class="row">
  <div>
    <label>Email</label>
    <div class={"ctl pill " + (!editMode ? 'disabled' : '')}>
      <input type="email" bind:value={detailsForm.email} disabled={!editMode}/>
    </div>
  </div>
  <div>
    <label>Employment Date</label>
    <div class={"ctl pill date " + (!editMode ? 'disabled' : '')}>
      <input type="date" bind:value={detailsForm.employmentDate} disabled={!editMode}/>
    </div>
  </div>
</div>

<!-- CONFIRMATION DATE + TERMINATION DATE -->
<div class="row">
  <div>
    <label>Confirmation Date</label>
    <div class={"ctl pill date " + (!editMode ? 'disabled' : '')}>
      <input type="date" bind:value={detailsForm.confirmationDate} disabled={!editMode}/>
    </div>
  </div>
  <div>
    <label>Termination Date</label>
    <div class={"ctl pill date " + (!editMode ? 'disabled' : '')}>
      <input type="date" bind:value={detailsForm.terminationDate} disabled={!editMode}/>
    </div>
  </div>
</div>

<!-- GENDER + ANNUAL + MEDICAL LEAVE -->
<div class="row three">
  <div>
    <label>Gender</label>
    <div class={"ctl pill " + (!editMode ? 'disabled' : '')}>
      <select bind:value={detailsForm.gender} disabled={!editMode}>
        <option>Male</option>
        <option>Female</option>
      </select>
    </div>
  </div>
  <div>
    <label>Annual Leave</label>
    <div class={"ctl pill " + (!editMode ? 'disabled' : '')}>
      <input type="number" step="0.5" min="0" bind:value={detailsForm.annualLeave} disabled={!editMode}/>
    </div>
  </div>
  <div>
    <label>Medical Leave</label>
    <div class={"ctl pill " + (!editMode ? 'disabled' : '')}>
      <input type="number" step="0.5" min="0" bind:value={detailsForm.medicalLeave} disabled={!editMode}/>
    </div>
  </div>
</div>
<div>
    <label>Role</label>
    <div class={"ctl pill " + (!editMode ? 'disabled' : '')}>
      <select bind:value={detailsForm.role} disabled={!editMode}>
        <option>Admin</option>
        <option>Manager</option>
        <option>Staff</option>
      </select>
    </div>
  </div>

<!-- NOTES -->
<div class="row single">
  <div>
    <label>Notes</label>
    <div class={"ctl " + (!editMode ? 'disabled' : '')}>
      <textarea bind:value={detailsForm.notes} disabled={!editMode} placeholder="Optional notes…" />
    </div>
  </div>
</div>
              <div class="form-ft">
                {#if editMode}
                  <button class="btn-ghost" on:click={() => { editMode = false; detailsForm = structuredClone(selectedEmp); }}>Cancel</button>
                  <button class="btn-primary" on:click={toggleEditSave}>Save Changes</button>
                {:else}
                  <button class="btn-danger" style="margin-right: auto;" on:click={openDeleteConfirm}>Delete Employee</button>
                  <button class="btn-primary" on:click={toggleEditSave}>Edit Profile</button>
                {/if}
              </div>
            </div>

            <!-- Right: Photo (preview only) -->
            <div class="photo-card" title="Profile Photo">
              {#if selectedEmp.photoUrl}
                <div class="photo-preview"><img src={selectedEmp.photoUrl} alt="Profile" /></div>
              {:else}
                <div class="cam" aria-label="Profile photo">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </div>
                <div class="muted" style="position:absolute; bottom:10px;">No Photo</div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Confirmation Modal for Deletion -->
{#if showDeleteConfirm && employeeToDelete}
  <div class="modal-wrap" style="z-index: 90;">
    <div class="modal confirm-modal">
      <div class="modal-hd">
        <div style="width: 22px;" aria-hidden="true"></div>
        <div class="modal-ttl" style="color: #49bdb3;">Confirm Deletion</div>
        <button class="modal-x" on:click={() => showDeleteConfirm = false}>✕</button>
      </div>
      <div class="modal-bd" style="padding: 22px; text-align: center;">
        <p>Are you sure you want to delete the profile for <strong>{employeeToDelete.name}</strong>?</p>
        <p class="muted">This action cannot be undone.</p>
        <div class="form-ft" style="margin-top: 20px; justify-content: center;">
          <button class="btn-ghost" on:click={() => showDeleteConfirm = false}>Cancel</button>
          <button class="btn-danger" on:click={deleteEmployee}>Yes, Delete</button>
        </div>
      </div>
    </div>
    </div>
{/if}
    <div class="sidebar-tab" on:click={toggleSidebar}>
  <span class="label">Pending Approval</span>
  {#if pendingCount > 0}
    <span class="badge">{pendingCount}</span>
  {/if}
</div>
  

