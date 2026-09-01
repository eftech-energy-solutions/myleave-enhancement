<script>
  // ======================================================
  // OPTION 2: Prevent pendingCount undefined errors
  // (Placeholder values until real API is implemented)
  // ======================================================
  let pending = [];
  let pendingLeave = [];
  let pendingCancel = [];
  let pendingCount = 0;

  let sessionUser = null;
  let sessionDept = null;

  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { PUBLIC_VITE_API_BASE } from '$env/static/public';
  import ManagerLeaveApprovals from '$lib/components/ManagerLeaveApprovals.svelte';

  // --- SIDEBAR TOGGLE ---
  let sidebarOpen = false;
  afterNavigate(() => { sidebarOpen = false; });

  // --- PENDING APPROVAL PANEL ---
  let approvalPanelOpen = false;

  function closePanel() {
    approvalPanelOpen = false;
    loadPendingCount();
  }

  function handlePanelKeydown(e) {
    if (e.key === 'Escape' && approvalPanelOpen) closePanel();
  }

  // --- COLLAPSIBLE NAV GROUPS ---
  let dashOpen = false;
  let histOpen = false;

  afterNavigate(({ to }) => {
    const p = to?.url?.pathname ?? $page.url.pathname;
    const b = '/dashboard/manager';
    dashOpen = p === b || p.startsWith(b + '/reports');
    histOpen = p.startsWith(b + '/history') || p.startsWith(b + '/myhistory');
  });

  let selectedFile = null;

  // Fallback user info (before fetching from server)
  let safeUser = {
    name: '',
    role: '',
    position: '',
    staffId: '',
    email: '',
    department: '',          // ensure backend returns this in /api/me/photo
    photoUrl: null
  };

  // --- STATE ---
  let profileMenuOpen = false;
  let profilePhotoUrl = '';
  let showPwd1 = false;
  let showPwdCurrent = false; // <— add this


  // --- STATE FOR PASSWORD (error/msg) ---
  let error = '';
  let msg = '';
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
$: headerAvatarUrl = safeUser.photoUrl
  ? `${PUBLIC_VITE_API_BASE}${safeUser.photoUrl}?v=${Date.now()}`
  : '/images/icontest1.png';

  // --- Fetch current user on mount ---
onMount(async () => {
  try {
    const res = await fetch(`${PUBLIC_VITE_API_BASE}/api/me/photo`, {
      credentials: 'include'
    });

    if (res.ok) {
      const data = await res.json();
      safeUser = { ...safeUser, ...data };

      profilePhotoUrl = safeUser.photoUrl
        ? `${PUBLIC_VITE_API_BASE}${safeUser.photoUrl}`
        : '';

      sessionUser = safeUser.role;
      sessionDept = (safeUser.department || '').trim().toLowerCase();

      // ✅ PANGGIL LEPAS safeUser DAH ADA
      await loadPendingCount();
    }
  } catch (err) {
    console.error(err);
  }

  const handler = () => loadPendingCount();
  window.addEventListener('pending-updated', handler);

  return () => {
    window.removeEventListener('pending-updated', handler);
  };
});


  async function loadPendingCount() {
  try {
    const res = await fetch(
      `${PUBLIC_VITE_API_BASE}/api/leave-requests`,
      { credentials: "include" }
    );

    if (!res.ok) return;

    const all = await res.json();

    const userRole = (safeUser.role || '').trim().toLowerCase();
    const userDept = (safeUser.department || '').trim().toLowerCase();
    const myId = String(safeUser.staffId || safeUser.id || '').trim();

  const view =
  userRole === 'manager'
    ? all.filter(r => {
        const dept = (
          r.profile_department ||
          r.staff_department ||
          r.department ||
          ''
        ).trim().toLowerCase();

        const targetRole = (r.requester_role || '').trim().toLowerCase();

        // Hide my own requests
        const recordId = String(r.staff_id || '').trim();
        if (myId && recordId === myId) return false;

        const isPending = r.status === 'pending' || r.status === 'cancellation_pending';
        if (!isPending) return false;

        // 🔥 MANAGER DIRECTOR → SEMUA DEPARTMENT
        if (userDept === 'director') {
          return targetRole === 'manager' || dept === 'director';
        }

        // 👤 MANAGER BIASA → DEPT SENDIRI (supports comma-separated)
        const managerDepts = userDept.split(',').map(d => d.trim());
        const employeeDepts = dept.split(',').map(d => d.trim());

        return (
          targetRole !== 'manager' &&
          employeeDepts.some(d => managerDepts.includes(d))
        );
      })
    : [];

    pendingCount = view.length;
  } catch (e) {
    console.error('Failed to load pending count', e);
  }
}

  // Profile modal
  let profileModalOpen = false;
  let activeProfilePane = 'picture'; // 'picture' | 'password'

  // clickOutside action
  function clickOutside(node) {
    const onClick = (e) => {
      if (!node.contains(e.target)) {
        profileMenuOpen = false;
      }
    };
    document.addEventListener('click', onClick);
    return { destroy: () => document.removeEventListener('click', onClick) };
  }

  function openProfileModal() {
    activeProfilePane = 'picture';
    profileModalOpen = true;
    profileMenuOpen = false;
    // Reset error/msg when opening
    error = '';
    msg = '';
  }

  function closeProfileModal() {
    profileModalOpen = false;
  }

  // ---------- Helpers to safely parse responses ----------
  function isJsonResponse(res) {
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json');
  }

  async function parseSmart(res) {
    if (isJsonResponse(res)) return await res.json();
    const text = await res.text();
    return { _nonJson: true, text };
  }
  // ------------------------------------------------------

  // Save profile update
// Save profile update
async function saveProfile(e) {
  e.preventDefault();

  error = '';
  msg = '';

  // --- PICTURE BRANCH ---
  if (activeProfilePane === 'picture') {
    if (!selectedFile) {
  showToast(
    'Please select a photo before saving.',
    'warning',
    'No File Selected'
  );
  return;
}

    try {
      const formData = new FormData();
      formData.append('photo', selectedFile);

      const res = await fetch(`${PUBLIC_VITE_API_BASE}/api/upload/profile`, {

        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const data = await parseSmart(res);
      if (!res.ok || (isJsonResponse(res) && !data?.success)) {
        const msgText = isJsonResponse(res)
          ? (data?.error || `Upload failed (status ${res.status})`)
          : `Upload failed (status ${res.status}). ${String(data.text).slice(0,180)}…`;
        throw new Error(msgText);
      }

      // update UI
      const bust = `?v=${Date.now()}`;

      safeUser.photoUrl = data.photoUrl;

      // modal preview
      profilePhotoUrl = data.photoUrl.startsWith('http')
        ? `${data.photoUrl}${bust}`
        : `${PUBLIC_VITE_API_BASE}${data.photoUrl}${bust}`;

      // ❗ penting: reset file
      selectedFile = null;

      // ✅ TOAST SUCCESS
      showToast(
        'Profile photo updated successfully.',
        'success',
        'Profile Updated'
      );

      closeProfileModal();
      return;

    } catch (err) {
      console.error(err);
      showToast(
        err.message || "Upload failed. Server may be down or endpoint is wrong.",
        "error",
        "Upload Failed"
      );
      return;
    }
  }

  // --- PASSWORD BRANCH ---
  if (activeProfilePane === 'password') {
    const form = e.target;

    const pwdCurrent = form.pwdCurrent.value || '';
    const pwd1 = form.pwd1.value || '';
    const pwd2 = form.pwd2.value || '';

    // validation
     if (!pwdCurrent || !pwd1 || !pwd2) {
    showToast(
      "All password fields are required.",
      "warning",
      "Missing Information"
    );
    return;
  }

  if (pwd1 !== pwd2) {
    showToast(
      "New passwords do not match.",
      "warning",
      "Password Mismatch"
    );
    return;
  }

  if (pwd1.length < 8) {
    showToast(
      "New password must be at least 8 characters.",
      "warning",
      "Password Too Short"
    );
    return;
  }

    const email = (safeUser?.email || '').trim().toLowerCase();

    try {
      // PRIMARY ROUTE (email)
      if (email) {
        const res = await fetch(`${PUBLIC_VITE_API_BASE}/api/auth/change-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email,
            currentPassword: pwdCurrent,
            newPassword: pwd1
          })
        });

        if (res.status === 404) throw { _tryFallback: true };
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || 'Failed to change password.');
        }

        showToast(
          "Your password has been updated successfully.",
          "success",
          "Password Updated"
        );
        form.reset();
        closeProfileModal();
        return;
      }

      // no email → fallback
      throw { _tryFallback: true };

    } catch (err) {
      // FALLBACK ROUTE (staffId)
      if (err?._tryFallback) {
        try {
          const res = await fetch(
            `${PUBLIC_VITE_API_BASE}${encodeURIComponent(safeUser.staffId)}/password`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                currentPassword: pwdCurrent,
                newPassword: pwd1
              })
            }
          );

          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error || 'Password update failed.');
          }

          showToast(
            "Your password has been updated successfully.",
            "success",
            "Password Updated"
          );
          form.reset();
          closeProfileModal();
          return;
        } catch (fallbackErr) {
          showToast(
            fallbackErr?.message || "An error occurred while updating password.",
            "error",
            "Update Failed"
          );
          return;
        }
      }

      // unexpected
     showToast(
        err?.message || "An unexpected error occurred.",
        "error",
        "Update Failed"
      );
      return;
    }
  }
}

  function handlePhotoFile(e) {
    const file = e.currentTarget.files?.[0];
    console.log('📁 File selected:', file);
    if (!file) return;
    if (!/^image\/(png|jpeg)$/i.test(file.type)) {
      showToast(
        "Please choose a PNG or JPG image.",
        "warning",
        "Invalid File Type"
      );
      e.currentTarget.value = '';
      return;
    }
    selectedFile = file;
    profilePhotoUrl = URL.createObjectURL(file);
    // Clear password error/msg if user switches to picture
    error = '';
    msg = '';
  }
</script>

<div class="container" class:sidebar-open={sidebarOpen}>
  <!-- ============ MOBILE OVERLAY ============ -->
  {#if sidebarOpen}
    <div class="sidebar-overlay" on:click={() => sidebarOpen = false} aria-hidden="true"></div>
  {/if}

  <aside class="aside">
    <div class="top">
      <div class="logo">
        <img src="/images/myleave.logo.png" alt="MyLeave" />
      </div>

      <nav class="nav">
        <button
          type="button"
          class="nav-group"
          class:open={dashOpen}
          on:click={() => dashOpen = !dashOpen}
          aria-expanded={dashOpen}
        >
          <span class="ico">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M10 3H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 11H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1zm11-11h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 11h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1z"
              ></path>
            </svg>
          </span>
          <span class="text">Dashboard</span>
          <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>
        </button>
        {#if dashOpen}
        <div class="sub-links">
          <a
            href="/dashboard/manager"
            class:active={$page.url.pathname === '/dashboard/manager' || $page.url.pathname.startsWith('/dashboard/manager/main')}
          >
            <span class="text">Main</span>
          </a>
          <a
            href="/dashboard/manager/reports"
            class:active={$page.url.pathname.startsWith('/dashboard/manager/reports')}
          >
            <span class="text">Reports</span>
          </a>
        </div>
        {/if}

        <button
          type="button"
          class="nav-group"
          class:open={histOpen}
          on:click={() => histOpen = !histOpen}
          aria-expanded={histOpen}
        >
          <span class="ico">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zM5 8V6h14v2H5z"
              ></path>
            </svg>
          </span>
          <span class="text">Leave History</span>
          <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>
        </button>
        {#if histOpen}
        <div class="sub-links">
          <a
            href="/dashboard/manager/history"
            class:active={$page.url.pathname.startsWith('/dashboard/manager/history')}
          >
            <span class="text">Staff</span>
          </a>
          <a
            href="/dashboard/manager/myhistory"
            class:active={$page.url.pathname.startsWith('/dashboard/manager/myhistory')}
          >
            <span class="text">Personal</span>
          </a>
        </div>
        {/if}

        <a
          href="/dashboard/manager/employees"
          class:active={$page.url.pathname.startsWith('/dashboard/manager/employees')}
        >
          <span class="ico">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
              ></path><s></s>
            </svg>
          </span>
           <span class="text">Employees</span>
        </a>

        {#if sessionUser === 'Manager' && sessionDept === 'director'}
          <div class="sub-links" style="margin-top: -6px; margin-bottom: 6px;">
            <a
              href="/dashboard/manager/employees/all"
              class:active={$page.url.pathname === '/dashboard/manager/employees/all'}
              style="padding-left: 12px; font-size: 16px; opacity: 0.9;"
            >
              <span class="text" style="color: #217859; font-weight: 500;">All Employees</span>
            </a>
          </div>
                {/if}

        <a
          href="/dashboard/manager/leave-approvals"
          class="nav-approvals"
          class:active={$page.url.pathname.startsWith('/dashboard/manager/leave-approvals')}
        >
          <span class="ico">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M22 5.18L10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10L22 5.18zm-2.21 5.04c.13.57.21 1.17.21 1.78 0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8c1.58 0 3.04.46 4.28 1.25l1.44-1.44C16.1 2.67 14.13 2 12 2 6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10c0-1.19-.22-2.33-.6-3.39l-1.61 1.61z"
              ></path>
            </svg>
          </span>
           <span class="text">Leave Approvals</span>
            {#if pendingCount > 0}
              <span class="nav-badge">{pendingCount > 9 ? '9+' : pendingCount}</span>
            {/if}
        </a>

      </nav>
    </div>

    <div class="bottom">
      <a href="/logout" class="signout">
        <span class="ico">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path
              d="m17 7-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"
            ></path>
          </svg>
        </span>
        <span class="text">Sign out</span>
      </a>
    </div>
  </aside>

  <main class="main dash-main">
    <header class="topbar">
      <button class="hamburger" on:click={() => sidebarOpen = !sidebarOpen} aria-label="Toggle sidebar">
        {#if sidebarOpen}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
        {/if}
      </button>
      <div class="title-wrap">
        {#if $page.url.pathname === '/dashboard/manager' || $page.url.pathname.startsWith('/dashboard/manager/main')}
          <div class="hello">Welcome back, {safeUser?.name || 'admin'}!</div>
        {/if}

        {#if $page.url.pathname.startsWith('/dashboard/manager/main')}
          <h1 class="page-title">Dashboard</h1>
          <p class="page-desc">Your team's leave overview and the public holiday calendar.</p>
        {:else if $page.url.pathname.startsWith('/dashboard/manager/reports')}
          <h1 class="page-title">My Dashboard</h1>
          <p class="page-desc">Personal dashboard with your leave statistics and calendar.</p>
        {:else if $page.url.pathname.startsWith('/dashboard/manager/myhistory')}
          <h1 class="page-title">My Leave History</h1>
          <p class="page-desc">View and manage your own past and upcoming leave applications.</p>
        {:else if $page.url.pathname.startsWith('/dashboard/manager/history')}
          <h1 class="page-title">Leave History</h1>
          <p class="page-desc">Browse leave records for your staff.</p>
        {:else if $page.url.pathname.startsWith('/dashboard/manager/leave-approvals')}
          <h1 class="page-title">Leave Approvals</h1>
          <p class="page-desc">Review and manage pending leave requests from your team.</p>
        {:else if $page.url.pathname.startsWith('/dashboard/manager/employees/all')}
          <h1 class="page-title">Employees</h1>
          <p class="page-desc">View all employees across the organisation.</p>
        {:else if $page.url.pathname.startsWith('/dashboard/manager/employees')}
          <h1 class="page-title">Employees & Leave Approvals</h1>
          <p class="page-desc">View employees and review pending leave requests from your team.</p>
        {:else}
          <h1 class="page-title">Dashboard</h1>
          <p class="page-desc">Your team's leave overview and the public holiday calendar.</p>
        {/if}
      </div>

      <div class="profile" use:clickOutside>
        <div class="profile-info">
          {#if safeUser?.photoUrl}
            <img
              src={`${PUBLIC_VITE_API_BASE}${safeUser.photoUrl}`}
              alt="profile"
              class="avatar-img"
              on:error={(e) => (e.currentTarget.style.display = 'none')}
            />
          {/if}
          <div class="who">
            <div class="name">{safeUser?.name}</div>
            <div class="sub">{safeUser?.position}</div>
            <div class="sub">Staff ID : {safeUser?.staffId}</div>
          </div>
        </div>

        <button
          class="icon-btn caret"
          aria-haspopup="menu"
          aria-expanded={profileMenuOpen}
          on:click={() => (profileMenuOpen = !profileMenuOpen)}
          aria-label="Open profile menu"
        >
          ▾
        </button>

        {#if profileMenuOpen}
          <div class="menu" role="menu">
            <button class="menu-btn" type="button" on:click={openProfileModal}>
              Update Profile
            </button>
          </div>
        {/if}
      </div>
    </header>

    <div class="container-inner">
      <slot />
    </div>
  </main>
</div>

<!-- Pending Approval Slide Panel -->
{#if pendingCount > 0 && $page.url.pathname.startsWith('/dashboard/manager/employees')}
  <button 
    class="pending-tab" 
    class:panel-open={approvalPanelOpen}
    on:click={() => approvalPanelOpen = !approvalPanelOpen}
    aria-label="Pending approvals"
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
    <span class="tab-text">Pending Approval</span>
    <span class="tab-badge">{pendingCount}</span>
  </button>
{/if}

{#if approvalPanelOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="approval-overlay" on:click={closePanel}></div>
  <div class="approval-panel" class:open={approvalPanelOpen}>
    <div class="panel-header">
      <h3>Pending Approvals</h3>
      <button class="panel-close" on:click={closePanel}>✕</button>
    </div>
    <div class="panel-body">
      <ManagerLeaveApprovals compact />
    </div>
  </div>
{/if}

<svelte:window on:keydown={handlePanelKeydown} />

{#if profileModalOpen}
  <div
    class="modal-wrap"
    role="dialog"
    aria-modal="true"
    aria-labelledby="profile-title"
  >
    <div class="modal">
      <div class="modal-hd">
        <div id="profile-title" class="modal-ttl">Update Profile</div>
        <button class="modal-x" on:click={closeProfileModal} aria-label="Close">✕</button>
      </div>

      <div class="tabs" role="tablist" aria-label="Update Profile Tabs">
        <button
          class:selected={activeProfilePane === 'picture'}
          role="tab"
          aria-selected={activeProfilePane === 'picture'}
          on:click={() => {
            activeProfilePane = 'picture';
            error = '';
            msg = '';
          }}>Profile Picture</button>

        <button
          class:selected={activeProfilePane === 'password'}
          role="tab"
          aria-selected={activeProfilePane === 'password'}
          on:click={() => {
            activeProfilePane = 'password';
            error = '';
            msg = '';
          }}>Password</button>
      </div>

      <form class="modal-bd" on:submit={saveProfile}>
        {#if activeProfilePane === 'picture'}
          <div class="pic-wrap">
            {#if profilePhotoUrl}
              <img src={profilePhotoUrl} alt="Preview" class="preview" />
            {:else}
              <div class="placeholder">No photo chosen</div>
            {/if}
            <input
              type="file"
              accept="image/png,image/jpeg"
              on:change={handlePhotoFile}
            />
            <div class="muted">
              PNG/JPG up to ~5 MB. Square images (1:1) look best.
            </div>
          </div>
        {:else}
          <div class="row">
  <label>Current Password</label>
  <div class="input-wrap-lg">
    <input
      class="input-lg"
      type={showPwdCurrent ? 'text' : 'password'}
      name="pwdCurrent"
      placeholder="Enter your current password"
      required
    />
    <button
      class="eye-btn"
      type="button"
      on:click={() => (showPwdCurrent = !showPwdCurrent)}
      aria-label={showPwdCurrent ? 'Hide current password' : 'Show current password'}
      title={showPwdCurrent ? 'Hide' : 'Show'}
    >
      {#if showPwdCurrent}
        <!-- eye-off icon -->
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.04-2.84 3.05-5.2 5.66-6.6"></path>
          <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a10.95 10.95 0 0 1-4.06 5.06"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      {:else}
        <!-- eye icon -->
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      {/if}
    </button>
  </div>
          </div>
          <div class="row">
            <label>New Password</label>
            <div class="input-wrap-lg">
              <input
                class="input-lg"
                type={showPwd1 ? 'text' : 'password'}
                name="pwd1"
                placeholder="At least 8 characters"
                required
              />
              <button
                class="eye-btn"
                type="button"
                on:click={() => (showPwd1 = !showPwd1)}
                aria-label={showPwd1 ? 'Hide password' : 'Show password'}
                title={showPwd1 ? 'Hide' : 'Show'}
              >
                {#if showPwd1}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                       fill="none" stroke="currentColor" width="20" height="20" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.04-2.84 3.05-5.2 5.66-6.6"/>
                    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a10.95 10.95 0 0 1-4.06 5.06"/>
                    <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                       fill="none" stroke="currentColor" width="20" height="20" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                {/if}
              </button>
            </div>
          </div>
          <div class="row">
            <label>Confirm Password</label>
            <input
              class="input-lg"
              type="password"
              name="pwd2"
              placeholder="Re-enter new password"
              required
            />
          </div>
          {#if error}
            <div class="form-error">{error}</div>
          {/if}
          {#if msg}
            <div class="form-msg">{msg}</div>
          {/if}
        {/if}

        <div class="form-ft">
          <button type="button" class="btn-ghost" on:click={closeProfileModal}>Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
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
<style>
  .container {
  min-height: 100vh;
  overflow: visible;
}

  .aside {
    background: #fff;
    border-right: 1px solid #e5e7eb;
    padding: 15px;
    display: flex;
    flex-direction: column;
    position: sticky;
    top: 0;
    height: 100vh;
  }
  .top {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .bottom {
    margin-top: auto;
  }
  .main {
    background: var(--canvas, #F5F7FA);
    overflow-y: auto;
  }
  .container-inner {
    padding: 24px 24px 32px;
  }

  /* Sidebar Navigation */
  .nav {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .nav a,
  .nav-group {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    color: #217859;
    font-weight: 600;
    text-decoration: none;
    transition: background-color 0.2s;
  }
  button.nav-group {
    background: none;
    border: none;
    width: 100%;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .nav-group .chev {
    width: 18px;
    height: 18px;
    fill: #217859;
    margin-left: auto;
    flex-shrink: 0;
    opacity: 0.8;
    transition: transform 0.2s ease;
  }
  .nav-group.open .chev {
    transform: rotate(180deg);
  }
  .nav a:hover {
    background: #f3f4f6;
  }
  .nav a.active {
    background: #eaf6f7;
    color: #0F9B8E;
  }
  .nav-badge {
  margin-left: auto;
  background: #dc2626;   /* red */
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
  line-height: 1.4;
  position: relative;
  top: 1.5px;
  flex-shrink: 0;
  white-space: nowrap;
}

  .nav-approvals .text{ white-space: nowrap; }

  /* Sub-links specific styling */
  .sub-links {
    margin-left: 28px;
    display: flex;
    flex-direction: column;
    font-weight: 500;
  }
  .sub-links a .text::before {
    content: '•';
    margin-right: 8px;
    color: #9ca3af;
  }
  .sub-links a.active .text::before {
    color: #0F9B8E;
  }

  /* Icons */
  .ico {
    width: 24px;
    height: 24px;
    display: inline-grid;
    place-items: center;
  }
  .ico svg {
    width: 22px;
    height: 22px;
    fill: #217859;
  }
  .nav a.active .ico svg,
  .nav-group.active .ico svg {
    fill: #0F9B8E;
  }

  /* Sign Out Button */
  .signout {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    color: #DC2626;
    font-weight: 600;
    text-decoration: none;
  }
  .signout:hover {
    background: #feecec;
  }
  .signout .ico svg {
    fill: #DC2626;
  }

  /* Header — teal header band */
  .topbar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 16px;
    background: linear-gradient(135deg, var(--brand, #0F9B8E), var(--brand-dark, #0C8075));
  }
  .title-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: #fff;
  }
  .page-desc {
    margin: 2px 0 0;
    font-size: var(--fs-meta, 12.5px);
    line-height: 1.35;
    color: rgba(255, 255, 255, 0.75);
  }
  .hello {
  max-width: 980px;       /* kekalkan limit ruang */
  white-space: normal;    /* ❗ benarkan wrap */
  word-break: break-word;
  line-height: 1.3;

  font-size: var(--fs-body, 14px);
  font-weight: 400;
  opacity: 0.85;
  margin: 0;
  color: #fff;
}

  .page-title {
    margin: 0;
    font-size: var(--fs-page-title, 24px);
    line-height: 1.2;
    font-weight: 600;
    color: #fff;
  }
  .logo img {
    height: 38px;
    display: block;
    margin: auto;
  }

  /* Profile Dropdown */
  .profile {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .icon-btn {
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 6px;
    border-radius: 8px;
    color: #fff;
  }
  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }
  .caret {
    font-size: 16px;
  }
  .profile-info {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #fff;
  }
  .avatar-img {
    height: 70px;
    width: 70px;
    border-radius: 9999px;
    object-fit: cover;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25);
  }
  .who .name{ 
    font-size:14px; 
    font-weight:700;  
    max-width: 320px;     /* ikut ruang header */
    white-space: normal;  /* ❗ allow wrap */
    word-break: break-word;
    line-height: 1.2;
  }

  .who .sub {
    font-size: 12px;
    opacity: 0.95;
  }

  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
    min-width: 200px;
    padding: 6px;
    z-index: 30;
  }
  .menu-btn {
    display: block;
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: #fff;
    border-radius: 8px;
    color: #111827;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }
  .menu-btn:hover {
    background: #f3f4f6;
  }

  /* Modal */
  .modal-wrap {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: grid;
    place-items: center;
    z-index: 50;
  }
  .modal {
    background: #fff;
    border-radius: 12px;
    width: 420px;
    max-width: 95vw;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }
  .modal-hd {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
  }
  .modal-ttl {
    font-size: 18px;
    font-weight: 700;
    color: #0F9B8E;
  }
  .modal-x {
    border: none;
    background: transparent;
    font-size: 20px;
    cursor: pointer;
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid #e5e7eb;
  }
  .tabs button {
    flex: 1;
    padding: 10px;
    background: #f9fafb;
    border: none;
    cursor: pointer;
    font-weight: 600;
    color: #000;
  }
  .tabs button.selected {
    background: #fff;
    border-bottom: 2px solid #0F9B8E;
    color: #000;
  }

  .modal-bd {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .pic-wrap {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .preview {
    max-width: 100%;
    border-radius: 10px;
  }
  .placeholder {
    padding: 40px;
    text-align: center;
    color: #6b7280;
    border: 1px dashed #d1d5db;
    border-radius: 10px;
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row label {
    font-weight: 600;
    font-size: 14px;
    color: #000;
  }

  .form-ft {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 10px;
  }
  .btn-ghost {
    background: #fff;
    color: var(--ink, #1F2937);
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 0.6rem 1rem;
    font-weight: 600;
  }
  .btn-primary {
    background: #0F9B8E;
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 0.65rem 1.25rem;
    font-weight: 600;
    font-size: 14px;
  }
  .btn-primary:hover {
    filter: brightness(0.95);
  }

  .muted {
    color: #64748b;
    font-size: 12px;
  }

  .input-lg {
    font-size: 14px;
    padding: 12px 14px;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }
  .input-lg:focus {
    border-color: #0F9B8E;
    box-shadow: 0 0 0 3px rgba(15, 155, 142, 0.15);
  }

  .input-wrap-lg {
    position: relative;
    display: flex;
    align-items: center;
  }
  .input-wrap-lg .input-lg {
    width: 100%;
    padding-right: 44px; /* space for eye icon */
  }

  .eye-btn {
    position: absolute;
    right: 10px;
    height: 32px;
    min-width: 32px;
    display: grid;
    place-items: center;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 8px;
    color: #0c4a6e;
  }
  .eye-btn:hover {
    background: #f3f4f6;
  }

  /* Messages */
  .form-error {
    background: #feecec;
    color: #DC2626;
    padding: 10px 14px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
  }
  .form-msg {
    background: #eefaf9;
    color: #0c4a6e;
    padding: 10px 14px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
  }
  /* =========================
   TOAST NOTIFICATION
========================= */
/* ===== TOAST STACK ===== */
.toast-stack {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
}

/* ===== TOAST ITEM ===== */
.toast-item {
  display: flex;
  align-items: flex-start; 
  background: #fff;
  border-radius: 8px;
  min-width: 340px;
  max-width: 400px;
  padding: 12px 14px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.15);
  animation: slideIn 0.25s ease;
  border-left: 5px solid;
}

/* ICON */
.toast-icon {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  margin-top: 2px;
}

.toast-svg {
  width: 20px;
  height: 20px;
  fill: #fff;
}

/* BODY */
.toast-body {
  flex: 1;
}

.toast-body strong {
  display: block;
  font-size: 14px;
  color: #111827;
  margin-bottom: 2px;
}

.toast-body p {
  margin: 0;
  font-size: 13px;
  color: #4b5563;
}

/* CLOSE */
.toast-close {
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #9ca3af;
  margin-left: 10px;
}
.toast-close:hover {
  color: #111827;
}

/* ===== TYPES ===== */
.toast-item.success {
  border-color: #22c55e;
}
.toast-item.success .toast-icon {
  background: #22c55e;
}

.toast-item.error {
  border-color: #DC2626;
}
.toast-item.error .toast-icon {
  background: #DC2626;
}

.toast-item.info {
  border-color: #0F9B8E;
}
.toast-item.info .toast-icon {
  background: #3b82f6;
}

.toast-item.warning {
  border-color: #f59e0b;
}
.toast-item.warning .toast-icon {
  background: #f59e0b;
}

/* ===== ANIMATION ===== */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(24px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
@keyframes fadeOut {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(24px);
  }
}

.toast-item.closing {
  animation: fadeOut 0.25s ease forwards;
}

/* ========= HAMBURGER BUTTON ========= */
.hamburger {
  display: none;
  background: transparent;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  line-height: 0;
}
.hamburger svg {
  width: 26px;
  height: 26px;
}
.hamburger:hover {
  background: rgba(255,255,255,.12);
}

/* ========= MOBILE OVERLAY ========= */
.sidebar-overlay {
  display: none;
}

/* ========= MOBILE RESPONSIVE ========= */
@media (max-width: 860px) {
  .hamburger {
    display: grid;
    place-items: center;
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.4);
    z-index: 40;
  }

  .container {
    display: flex;
    flex-direction: column;
  }

  .container > .aside {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 260px;
    z-index: 50;
    transform: translateX(-100%);
    transition: transform .25s ease;
    box-shadow: none;
  }

  .container.sidebar-open .aside {
    transform: translateX(0);
    box-shadow: 4px 0 24px rgba(0,0,0,.15);
  }

  .main {
    min-width: 0;
    width: 100%;
    height: 100dvh;
    overflow-y: auto;
  }

  .page-title {
    font-size: 20px;
  }

  .hello {
    font-size: 14px;
  }

  .avatar-img {
    height: 44px;
    width: 44px;
  }
}

/* ===== Pending Approval Slide Panel ===== */
.pending-tab {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 100;
  background: #0F9B8E;
  color: #fff;
  border: none;
  border-radius: 8px 0 0 8px;
  padding: 12px 10px;
  cursor: pointer;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  box-shadow: -2px 0 12px rgba(0,0,0,.15);
  transition: right 0.3s ease, background 0.2s;
}

.pending-tab:hover {
  background: #0d8a7e;
}

.pending-tab.panel-open {
  right: 420px;
}

.pending-tab svg {
  width: 20px;
  height: 20px;
}

.tab-text {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.tab-badge {
  background: #dc2626;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  min-width: 20px;
  height: 20px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

.approval-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.3);
  z-index: 101;
  animation: fadeIn 0.2s ease;
}

.approval-panel {
  position: fixed;
  right: -420px;
  top: 0;
  bottom: 0;
  width: 420px;
  max-width: 90vw;
  background: #fff;
  z-index: 102;
  box-shadow: -4px 0 24px rgba(0,0,0,.2);
  transition: right 0.3s ease;
  display: flex;
  flex-direction: column;
}

.approval-panel.open {
  right: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}

.panel-close {
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  color: #6b7280;
  padding: 4px 8px;
  border-radius: 6px;
}

.panel-close:hover {
  background: #e5e7eb;
  color: #111827;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (max-width: 860px) {
  .pending-tab {
    top: auto;
    bottom: 20px;
    right: 0;
    transform: none;
    border-radius: 8px 0 0 8px;
  }
  
  .pending-tab.panel-open {
    right: 0;
    bottom: 20px;
  }
  
  .approval-panel {
    width: 100vw;
    max-width: 100vw;
    right: -100vw;
  }
  
  .approval-panel.open {
    right: 0;
  }
}
  
</style>
