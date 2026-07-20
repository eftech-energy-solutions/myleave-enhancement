<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { apiFetch } from '$lib/api';
  import { PUBLIC_VITE_API_BASE } from '$env/static/public';

  // --- STATE ---
  let profileMenuOpen = false;
  let selectedFile = null;
  let profilePhotoUrl = '';
  let showPwd1 = false;
  let loadingUser = true;

  let safeUser = {
    name: '',
    role: '',
    position: '',
    staffId: '',
    department: '',
    photoUrl: null,
    email: ''
  };

  let staffId = "";
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

  // NAVIGATION (unchanged)
  const roleBase = '/dashboard/admin';

  const isActive = (href) => {
    const current = $page.url.pathname;
    if (href === roleBase) return current === href;
    return current.startsWith(href);
  };

$: headerAvatarUrl = safeUser.photoUrl
  ? `${PUBLIC_VITE_API_BASE}${safeUser.photoUrl}?v=${Date.now()}`
  : '/images/icontest1.png';

  // FETCH USER
 onMount(async () => {
  try {
    const res = await fetch(`${PUBLIC_VITE_API_BASE}/api/me/photo`, {
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      safeUser = { ...safeUser, ...data };

      const bust = `?v=${Date.now()}`;
      safeUser.photoUrl = data.photoUrl;

      profilePhotoUrl = data.photoUrl.startsWith('http')
        ? `${data.photoUrl}${bust}`
        : `${PUBLIC_VITE_API_BASE}${data.photoUrl}${bust}`;
    }
  } catch (err) {
    console.error('Error fetching user:', err);
  }

  try {
    const res2 = await fetch(
  `${PUBLIC_VITE_API_BASE}/api/employee/me`,
  { credentials: "include" }
);
    if (res2.ok) {
      const user = await res2.json();
      staffId = user.staffId;
    }
  } catch (err) {
    console.error('Error fetching info:', err);
  }

  loadingUser = false;
  await loadPendingCount();

  const handler = () => {
    loadPendingCount();
  };

  window.addEventListener('pending-updated', handler);

  return () => {
    window.removeEventListener('pending-updated', handler);
  };
});


  let pendingCount = 0;

async function loadPendingCount() {
  try {
    const res = await fetch(
  `${PUBLIC_VITE_API_BASE}/api/leave-requests`,
  { credentials: "include" }
);
    if (!res.ok) return;

    const data = await res.json();

    pendingCount = data.filter(
      r => r.status === "pending" || r.status === "cancellation_pending"
    ).length;
  } catch (err) {
    console.error("Failed to load pending count:", err);
  }
}


  // Profile modal state
  let profileModalOpen = false;
  let activeProfilePane = 'picture';
  let showPwdCurrent = false;

  // ====== ROLE SYSTEM (NEW CLEAN VERSION) ======

  // FIXED ROLES ONLY
  let roles = [
    {
      id: 'admin',
      name: 'Admin',
      staff: [] // emails added here
    },
    {
      id: 'manager',
      name: 'Manager',
      staff: []
    }
  ];

  // ROLE MODAL STATE
  let settingsModalOpen = false;
  let settingsModalView = 'list'; // list | form
  let roleToEdit = null;

  let newStaffEmail = "";
  let newStaffEmailList = [];

  async function openSettingsModal() {
  settingsModalView = 'list';
  settingsModalOpen = true;

  await loadRolesFromDB();
}

  function closeSettingsModal() {
    settingsModalOpen = false;
    roleToEdit = null;
  }

  function startEditRole(role) {
    roleToEdit = role;
    newStaffEmail = "";
    newStaffEmailList = [...(role.staff || [])];
    settingsModalView = 'form';
  }

  function goBackToList() {
    settingsModalView = 'list';
    roleToEdit = null;
  }

  function addStaffEmail() {
    const email = newStaffEmail.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast("Please enter a valid email address.", "warning", "Invalid Email");
    return;
  }

  if (newStaffEmailList.includes(email)) {
    showToast("This email has already been added.", "info", "Duplicate Email");
    return;
  }
    newStaffEmailList = [...newStaffEmailList, email];
    newStaffEmail = "";
  }

  function removeStaffEmail(i) {
    newStaffEmailList = newStaffEmailList.filter((_, idx) => idx !== i);
  }

  async function saveRoleChanges() {
  if (!roleToEdit) return;

  // roleToEdit.id = admin/manager/staff
  // newStaffEmailList = array of emails

  if (!newStaffEmailList.length) {
    if (!newStaffEmailList.length) {
      showToast(
        "Please add at least one staff email before saving.",
        "warning",
        "No Staff Assigned"
      );
      return;
    }
    return;
  }

  try {
    for (const email of newStaffEmailList) {
      const res = await fetch(
  `${PUBLIC_VITE_API_BASE}/api/role-setting`,
  {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      role: roleToEdit.id
    })
  }
);

      const data = await res.json();
      if (!res.ok) {
        console.error("Error saving role:", data);
      }
    }

    showToast(
    "Role access has been updated successfully.",
    "success",
    "Update Successful"
  );
    goBackToList();
    settingsModalOpen = false;

  } catch (err) {
    console.error(err);
    showToast(
    "Server error occurred while updating role access.",
    "error",
    "Update Failed"
  );
  }
}
  async function loadRolesFromDB() {
  try {
    const res = await fetch(
  `${PUBLIC_VITE_API_BASE}/api/role-setting`,
  { credentials: "include" }
);
    const data = await res.json();

    if (!res.ok) {
      console.error("Failed to load role-setting", data);
      return;
    }

    // Reset roles
    roles = roles.map(r => ({ ...r, staff: [] }));

    // Populate roles with DB data
    for (const row of data.data) {
      const role = row.role;
      const email = row.email;

      const targetRole = roles.find(r => r.id === role);
      if (targetRole) {
        targetRole.staff = [...targetRole.staff, email];
      }
    }

  } catch (err) {
    console.error("Error loading role-setting:", err);
  }
}

  // ============= PROFILE SAVE HANDLING (UNCHANGED) =============
  function clickOutside(node) {
    const onClick = (e) => { if (!node.contains(e.target)) profileMenuOpen = false; };
    document.addEventListener('click', onClick);
    return { destroy: () => document.removeEventListener('click', onClick) };
  }

  function openProfileModal() {
  activeProfilePane = 'picture';
  profileModalOpen = true;
  profileMenuOpen = false;
}

  function closeProfileModal() { profileModalOpen = false; }

async function saveProfile(e) {
  e.preventDefault();

  console.log('[saveProfile] activeProfilePane=', activeProfilePane, 'safeUser=', {
    email: safeUser?.email,
    staffId: safeUser?.staffId,
    role: safeUser?.role
  });

  // ----------------- PICTURE BRANCH -----------------
  if (activeProfilePane === 'picture') {
    if (!selectedFile) {
      showToast(
        "Please select a profile photo before saving.",
        "warning",
        "No File Selected"
      );
      return;
    }
    try {
      const formData = new FormData();
      formData.append('photo', selectedFile);

      const res = await fetch(
      `${PUBLIC_VITE_API_BASE}/api/upload/profile`,
      {
        method: 'POST',
        credentials: 'include',
        body: formData
      }
    );

      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await res.json() : { _nonJson: true, text: await res.text() };
      console.log('[upload/profile] status=', res.status, 'data=', data);

      if (!res.ok || (ct.includes('application/json') && !data?.success)) {
        const msgText = ct.includes('application/json')
          ? (data?.error || `Upload failed (status ${res.status})`)
          : `Upload failed (status ${res.status}). ${String(data.text).slice(0,180)}…`;
        throw new Error(msgText);
      }

      // success
      safeUser.photoUrl = data.photoUrl;
      profilePhotoUrl = data.photoUrl.startsWith('http')
        ? data.photoUrl
        : `${PUBLIC_VITE_API_BASE}${data.photoUrl}`;

      selectedFile = null;

      showToast(
        "Your profile photo has been updated successfully.",
        "success",
        "Profile Updated"
      );

      closeProfileModal();
      return;

    } catch (err) {
      console.error('[saveProfile][picture] error:', err);

      showToast(
        err.message || "Failed to update profile photo.",
        "error",
        "Upload Failed"
      );

      return;
    }
  }

  // ----------------- PASSWORD BRANCH -----------------
  if (activeProfilePane === 'password') {
    // grab form values safely
    const form = e.currentTarget;
    const pwdCurrent = (form.querySelector('input[name="pwdCurrent"]')?.value || '').trim();
    const pwd1 = (form.querySelector('input[name="pwd1"]')?.value || '').trim();
    const pwd2 = (form.querySelector('input[name="pwd2"]')?.value || '').trim();

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
    // Decide route:
    // IMPORTANT: force fallback for admin because your backend validates admin via employee/staffId route
    const isAdmin = (safeUser?.role || '').toLowerCase() === 'admin';
    const email = (safeUser?.email || '').trim().toLowerCase();
    const staffIdVal = safeUser?.staffId;

    console.log('[saveProfile][password] attempt', { isAdmin, email, staffId: staffIdVal });

    // helper to parse json or text
    async function parseSmartRes(res) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        return await res.json().catch(() => ({ _parseError: true }));
      }
      return { _nonJson: true, text: await res.text().catch(() => '') };
    }

    // Try email-based route only if NOT admin and email present
    if (!isAdmin && email) {
      try {
        console.log('[saveProfile] using email route /api/auth/change-password', { email });
        const res = await fetch(
          `${PUBLIC_VITE_API_BASE}/api/auth/change-password`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              currentPassword: pwdCurrent,
              newPassword: pwd1
            })
          }
        );

        const data = await parseSmartRes(res);
        console.log('[saveProfile][email-route] status=', res.status, 'data=', data);

        if (res.status === 404) {
          // endpoint missing -> fallback
          throw { _tryFallback: true, reason: '404' };
        }

        if (!res.ok || (data && typeof data === 'object' && data.success === false)) {
          // if backend returns specific error about current password, surface it
          const serverMsg = data?.error || data?.message || `Change failed (status ${res.status})`;
          throw new Error(serverMsg);
        }

       // success
       showToast(
          "Your password has been updated successfully.",
          "success",
          "Password Updated"
        );

        form.reset();
        closeProfileModal();
        return;
      } catch (err) {
        console.warn('[saveProfile][email-route] failed, will try fallback if allowed:', err);
        if (!err?._tryFallback) {
          // if it's not an explicit signal to fallback, still continue to fallback attempt
          // but show the error if no fallback possible
        }
        // continue to fallback below
      }
    }

    // FALLBACK: staffId route (PUT /api/employee/:staffId/password)
    if (!staffIdVal) {
      error = 'Missing staffId; cannot change password.';
      showToast(
      "Missing staff ID. Unable to change password.",
       "error",
       "Update Failed"
     );
      return;
    }


    try {
      console.log('[saveProfile] using staffId fallback route', { staffId: staffIdVal });
      const res2 = await fetch(
      `${PUBLIC_VITE_API_BASE}/api/employee/${encodeURIComponent(staffIdVal)}/password`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: pwdCurrent,
          newPassword: pwd1
        })
      }
    );


      const data2 = await parseSmartRes(res2);
      console.log('[saveProfile][staff-route] status=', res2.status, 'data=', data2);

      // handle 404 / errors from backend
      if (!res2.ok) {
        const serverMsg = data2?.error || data2?.message || `Password update failed (status ${res2.status})`;
        throw new Error(serverMsg);
      }

      // success
      showToast(
        data2?.message || "Your password has been updated successfully.",
        "success",
        "Password Updated"
      );

      form.reset();
      closeProfileModal(); // optional tapi UX lebih cantik
      return;
    } catch (err) {
      console.error('[saveProfile][staff-route] error:', err);

      showToast(
        err?.message || "An error occurred while updating password.",
        "error",
        "Password Update Failed"
      );

      return;
    }
  }
}
  function handlePhotoFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg)$/i.test(file.type)) {
      showToast(
        "Please choose a PNG or JPG image.",
        "warning",
        "Invalid File Type"
      );
      return;
    }
    selectedFile = file;
    profilePhotoUrl = URL.createObjectURL(file);
  }

  // Page title
$: pageTitle =
  $page.url.pathname === roleBase
    ? 'Dashboard'
    : $page.url.pathname.startsWith('/dashboard/admin/history')
    ? 'Approved Leave History'
    : $page.url.pathname.startsWith('/dashboard/admin/employees')
    ? 'Employees'
    : $page.url.pathname.startsWith('/dashboard/admin/logs')
    ? 'Activity Logs'
    : $page.url.pathname.startsWith('/dashboard/admin/chat')
    ? 'Chat'
    : 'My Dashboard';

  // Settings Modal Title
  $: settingsModalTitle =
    settingsModalView === 'list'
      ? 'Role Access Permission'
      : 'Edit Role';
</script>
<div class="layout">
  <!-- ============ SIDEBAR ============ -->
  <aside class="aside">
    <div class="top">
      <div class="logo">
        <img src="/images/myleave.logo.png" alt="MyLeave" />
      </div>
      <nav class="nav">
        <a href={roleBase} class:active={isActive(roleBase)}>
          <span class="ico">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10 3H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 11H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1zm11-11h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 11h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1z"/></svg>
          </span>
          <span class="text">Dashboard</span>
        </a>
        <a href="/dashboard/admin/history" class:active={isActive('/dashboard/admin/history')}>
          <span class="ico">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zM5 8V6h14v2H5z"/></svg>
          </span>
          <span class="text">Leave History</span>
        </a>
        <a href="/dashboard/admin/employees" class:active={isActive('/dashboard/admin/employees')}>
          <span class="ico">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          </span>
           <span class="text">
              Employees
              {#if pendingCount > 0}
                <span class="nav-badge">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              {/if}
          </span>
        </a>
         <a href="/dashboard/admin/logs" class:active={isActive('/dashboard/admin/logs')}>
          <span class="ico">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
          </span>
          <span class="text">Activity Logs</span>
        </a>
          <a
            href="/dashboard/admin/chat"
            class:active={isActive('/dashboard/admin/chat')}
          >
            <span class="ico">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M4 4h16c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H8l-4 4V6c0-1.1.9-2 2-2zm2 2v11.17L7.17 16H20V6H6zm2 3h8v2H8V9zm0 4h6v2H8v-2z"/>
              </svg>
            </span>

            <span class="text">Chat</span>
          </a>
      </nav>
    </div>

    <div class="bottom">
      <!-- <button type="button" class="settings-btn" title="Settings" on:click={openSettingsModal}>
        <span class="ico">
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>
        </span>
      </button> -->

      <a href="/logout" class="signout" title="Sign out">
        <span class="ico">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m17 7-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
        </span>
        <span class="text">Sign out</span>
      </a>
    </div>
  </aside>

  <!-- ============ RIGHT CONTENT ============ -->
  <div class="right">
    <header class="topbar">
      <div class="title-wrap">
        <div class="hello">Welcome back, {safeUser?.name}!</div>
        <h1 class="page-title">{pageTitle}</h1>
      </div>

      <div class="profile" use:clickOutside>
        <div class="profile-info">
          {#if safeUser.photoUrl}
            <img
              src={`${PUBLIC_VITE_API_BASE}${safeUser.photoUrl}`}
              class="avatar-img"
              alt="profile"
            />
          {:else}
            <div class="avatar-fallback">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#9ca3af">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4.2 4.2-6.5 8-6.5s8 2.3 8 6.5"/>
              </svg>
            </div>
          {/if}

          <div class="who">
            <div class="name">{safeUser.name}</div>
            <div class="sub">{safeUser.position}</div>
          </div>

          <button class="icon-btn caret" on:click={() => (profileMenuOpen = !profileMenuOpen)}>▾</button>

          {#if profileMenuOpen}
            <div class="menu">
              <button class="menu-btn" on:click={openProfileModal}>Update Profile</button>
            </div>
          {/if}
        </div>
      </div>
    </header>

    <div
  class="content-wrap"
  class:chat-mode={$page.url.pathname.startsWith('/dashboard/admin/chat')}
>
      <main
  class="content"
  class:chat-content={$page.url.pathname.startsWith('/dashboard/admin/chat')}
>
        <slot />
      </main>
    </div>
  </div>
</div>
{#if profileModalOpen}
  <div class="modal-wrap">
    <div class="modal">
      <div class="modal-hd">
        <div class="modal-ttl">Update Profile</div>
        <button class="modal-x" on:click={closeProfileModal}>✕</button>
      </div>

      <div class="tabs">
        <button class:selected={activeProfilePane === 'picture'} on:click={() => activeProfilePane = 'picture'}>Profile Picture</button>
        <button class:selected={activeProfilePane === 'password'} on:click={() => activeProfilePane = 'password'}>Password</button>
      </div>

      <form class="modal-bd" on:submit|preventDefault={saveProfile}>
        {#if activeProfilePane === 'picture'}
          <div class="pic-wrap">
            {#if profilePhotoUrl}
              <img src={profilePhotoUrl} class="preview" alt="" />
            {:else}
              <div class="placeholder">No photo chosen</div>
            {/if}

            <input type="file" accept="image/*" on:change={handlePhotoFile} />
          </div>

        {:else}

  <!-- CURRENT PASSWORD -->
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
        aria-label={showPwdCurrent ? 'Hide' : 'Show'}
      >
        {#if showPwdCurrent}
          <!-- eye-off icon -->
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.04-2.84 3.05-5.2 5.66-6.6"/>
            <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a10.95 10.95 0 0 1-4.06 5.06"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        {:else}
          <!-- eye icon -->
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        {/if}
      </button>
    </div>
  </div>

  <!-- NEW PASSWORD -->
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
        aria-label={showPwd1 ? 'Hide' : 'Show'}
      >
        {#if showPwd1}
          <!-- eye-off -->
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.04-2.84 3.05-5.2 5.66-6.6"/>
            <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a10.95 10.95 0 0 1-4.06 5.06"/>
            <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        {:else}
          <!-- eye -->
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        {/if}
      </button>
    </div>
  </div>

  <!-- CONFIRM PASSWORD -->
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
        {/if}

        <div class="form-ft">
          <button type="button" class="btn-ghost" on:click={closeProfileModal}>Cancel</button>
          <button class="btn-primary">Save</button>
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
<!-- ================= SETTINGS MODAL (ROLE) =================
{#if settingsModalOpen}
  <div class="modal-wrap">
    <div class="modal modal-lg">
      <div class="modal-hd">
        <div class="modal-ttl">{settingsModalTitle}</div>
        <button class="modal-x" on:click={closeSettingsModal}>✕</button>
      </div>

      {#if settingsModalView === 'list'}
        <div class="modal-bd">
          <div class="role-list">
            {#each roles as role}
              <div class="role-item-wrapper">
                <details class="role-item">
                  <summary>{role.name}</summary>

                  <div class="role-details-content">
                    <strong>Assigned Staff:</strong>
                    <ul class="staff-list">
                      {#each role.staff as email, i}
                        <li>{email}</li>
                      {:else}
                        <li>No staff assigned.</li>
                      {/each}
                    </ul>
                  </div>
                </details>

                <button class="btn-edit" on:click={() => startEditRole(role)}>Edit</button>
              </div>
            {/each}
          </div>
        </div>

        <div class="form-ft">
          <button class="btn-ghost" on:click={closeSettingsModal}>Close</button>
        </div>

      {:else}
        === EDIT ROLE FORM ===
        <!-- <form class="modal-bd" on:submit|preventDefault={saveRoleChanges}>
          <div class="row">
            <label>Role Name</label>
            <input class="input-lg" disabled value={roleToEdit?.name} />
          </div>

          <div class="row">
            <label>Add Staff (email)</label>
            <div class="add-email-row">
              <input
                class="input-lg"
                type="email"
                placeholder="staff@company.com"
                bind:value={newStaffEmail}
              />
              <button type="button" class="btn-primary" on:click={addStaffEmail}>Add</button>
            </div>

            {#if newStaffEmailList.length}
              <div class="email-chip-wrap">
                {#each newStaffEmailList as e, i}
                  <span class="email-chip">
                    {e}
                    <button type="button" class="chip-x" on:click={() => removeStaffEmail(i)}>✕</button>
                  </span>
                {/each}
              </div>
            {/if}
          </div>

          <div class="form-ft">
            <button type="button" class="btn-ghost" on:click={goBackToList}>Back</button>
            <button class="btn-primary">Save Changes</button>
          </div>
        </form>
      {/if}
    </div>
  </div>
{/if} --> 

<style>
  /* Layout (Tidak berubah) */
.layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  min-height: 100dvh;
  background: #fafafa;
}

  /* RIGHT SIDE (Tidak berubah) */
.right {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 100dvh;

  background: linear-gradient(
    180deg,
    #49bdb3 0%,
    #2bb7b3 35%,
    #1798a5 65%,
    #0c4a6e 100%
  );

  overflow: visible;
}
  .right::before{
    content:"";
    position:absolute; inset:0;
    background:
      radial-gradient(1000px 420px at 110% -20%,rgba(255,255,255,.25) 0%,rgba(255,255,255,0) 70%),
      url('/images/bg.png') center/cover no-repeat fixed;
    opacity:.35; mix-blend-mode: soft-light; pointer-events:none;
  }

  /* Sidebar (Tidak berubah) */
  .aside{ background:#fff; border-right:1px solid var(--ring,#e5e7eb); padding:15px 14px; position:sticky; top:0; height:100dvh; display:flex; flex-direction:column; }
  .top{ display:flex; flex-direction:column; gap:16px; }
  .logo img{ height:38px; display:block; margin:auto; }
  .nav{ display:flex; flex-direction:column; gap:12px; }
  .nav a{ display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:12px; color:#217859; font-weight:600; text-decoration:none; }
  .nav a:hover{ background:#f3f4f6; }
  .nav a.active{ background:#eaf6f7; border-left:4px solid #1fb3b2; padding-left:8px; color:#1fb3b2; }
  .ico{ font-size:20px; width:24px; height:24px; display:inline-grid; place-items:center; }
  .ico svg{ width:22px; height:22px; fill:#217859; }
  .nav a.active .ico svg{ fill:#1fb3b2; }
  .signout .ico svg{ fill:#e34040; }

  .success-msg {
  background: #eef6ff;        
  color: #1e3a8a;             
  border: none;
  padding: 12px 16px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
}


.error-msg {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
  padding: 10px 14px;
  border-radius: 8px;
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 14px;
}


  /* Bottom Bar (Tidak berubah) */
  .bottom{ margin-top:auto; display:flex; justify-content:space-between; align-items:center; }
  .signout{ color:#e34040; display:flex; align-items:center; gap:12px; padding:10px; border-radius:12px; text-decoration:none; width: 100%; }
  .signout:hover{ background:#feecec; }
  .settings-btn{ display:flex; align-items:center; padding:10px; border-radius:12px; color:#217859; background:transparent; border:none; cursor:pointer; }
  .settings-btn:hover{ background:#f3f4f6; }
  
  /* Topbar (Tidak berubah) */
  /* Header */
  .topbar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .title-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.5px;
    color: #fff;
  }
  .hello {
  max-width: 980px;       /* kekalkan limit ruang */
  white-space: normal;    /* ❗ benarkan wrap */
  word-break: break-word;
  line-height: 1.3;

  font-size: 18px;
  font-weight: 400;
  opacity: 0.95;
  margin: 0;
  color: #fff;
}

  .page-title{ margin:0; font-size:55px; line-height:1.1; font-weight:700; color:#fff; }

  .nav-badge {
  margin-left: 10px;
  background: #dc2626;   /* red */
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
  line-height: 1.4;
  position: relative;
  top: -1.5px; 
}


  /* Profile Dropdown (Tidak berubah) */
  .profile{ position:relative; display:flex; align-items:center; gap:10px; }
  .icon-btn{ border:none; background:transparent; cursor:pointer; font-size:18px; line-height:1; padding:6px; border-radius:8px; color:#fff; }
  .icon-btn:hover{ background:rgba(255,255,255,.12); }
  .caret{ font-size:16px; }
  .profile-info{ display:flex; align-items:center; gap:10px; color:#fff; }
  .avatar-img {
    height: 70px;
    width: 70px;
    border-radius: 9999px;
    object-fit: cover;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25);
  }
.avatar-fallback {
  width: 38px;
  height: 38px;
  border-radius: 9999px;
  display: grid;
  place-items: center;
  background: #e5e7eb;
}
  .who .name{ 
    font-size:14px; 
    font-weight:700;  
    max-width: 320px;     /* ikut ruang header */
    white-space: normal;  /* ❗ allow wrap */
    word-break: break-word;
    line-height: 1.2;
  }
    
  .who .sub{ font-size:12px; opacity:.95; }

  .menu{ position:absolute; right:0; top:calc(100% + 8px); background:#fff; border:1px solid #e5e7eb; border-radius:10px; box-shadow:0 10px 30px rgba(0,0,0,.12); min-width:200px; padding:6px; z-index:30; }
  .menu-btn{ display:block; width:100%; padding:10px 12px; border:none; background:#fff; border-radius:8px; color:#111827; font-weight:600; text-align:left; cursor:pointer; }
  .menu-btn:hover{ background:#f3f4f6; }
  a.menu-btn{ text-decoration:none; } 

  /* Content (Tidak berubah) */
.content-wrap {
  flex: 1;
  min-width: 0;
  padding: 16px;
  overflow-y: auto;
  background: transparent;
}

.content {
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
}

.content-wrap.chat-mode {
  height: calc(100dvh - 100px);
  min-height: 0;
  overflow: hidden;
}

.content.chat-content {
  height: 100%;
  min-height: 0;
}

.chat-container {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);

  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;

  overflow: hidden;
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
}

.conversation-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-right: 1px solid #e5e7eb;
}

.employee-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 10px 14px;
}

.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.messages-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
}

.message-form {
  flex-shrink: 0;
}

.empty-chat {
  flex: 1;
  min-height: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  padding: 30px;
  text-align: center;
}

  /* Modal styles (Umum) (Tidak berubah) */
  .modal-wrap{ position:fixed; inset:0; background:rgba(0,0,0,.4); display:grid; place-items:center; z-index:50; }
  .modal{ background:#fff; border-radius:12px; width:420px; max-width:95vw; box-shadow:0 12px 30px rgba(0,0,0,.2); overflow:hidden; }
  .modal-hd{ display:flex; justify-content:space-between; align-items:center; padding:14px 18px; border-bottom:1px solid #e5e7eb; }
  .modal-ttl{ font-size:18px; font-weight:700; color:#49bdb3; }
  .modal-x{ border:none; background:transparent; font-size:20px; cursor:pointer; }
  .tabs{ display:flex; border-bottom:1px solid #e5e7eb; }
  .tabs button{ flex:1; padding:10px; background:#f9fafb; border:none; cursor:pointer; font-weight:600; color:#000; }
  .tabs button.selected{ background:#fff; border-bottom:2px solid #49bdb3; color:#000; }
  .modal-bd {
    padding: 18px 28px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .pic-wrap{ display:flex; flex-direction:column; gap:10px; }
  .preview{ max-width:100%; border-radius:10px; }
  .placeholder{ padding:40px; text-align:center; color:#6b7280; border:1px dashed #d1d5db; border-radius:10px; }
  .row{ display:flex; flex-direction:column; gap:6px; }
  .row label{ font-weight:600; font-size:14px; color:#000; }
  .form-ft{ display:flex; justify-content:flex-end; gap:10px; margin-top:10px; padding:18px; border-top:1px solid #e5e7eb; background:#f9fafb; }
  .modal-bd + .form-ft { margin-top:0; }
  .btn-ghost{ background:#fff; color:#000e; border:1px solid #d1d5db; border-radius:8px; padding:.6rem 1rem; font-weight:600; cursor:pointer; }
  .btn-primary{ background:#49bdb3; color:#fff; border:none; border-radius:8px; padding:.6rem 1rem; font-weight:700; cursor:pointer; }
  .btn-primary:hover{ filter:brightness(.95); }
  .muted{ color:#64748b; font-size:12px; }
  .input-lg {
    font-size: 16px;
    padding: 12px 14px;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }
  .input-lg:focus {
    border-color: #49bdb3;
    box-shadow: 0 0 0 3px rgba(73, 189, 179, 0.15);
  }
  .input-wrap-lg {
    position: relative;
    display: flex;
    align-items: center;
  }
  .input-wrap-lg .input-lg {
    width: 100%;
    padding-right: 48px; /* space for eye icon */
  }
  .eye-btn{ position:absolute; right:10px; height:32px; min-width:32px; display:grid; place-items:center; border:none; background:transparent; cursor:pointer; border-radius:8px; color:#0c4a6e; }
  .eye-btn:hover{ background:#f3f4f6; }

/* ========= ROLE LIST SECTION ONLY ========== */

/* whole list container */
.role-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 10px;
}

/* wrapper with accordion + edit button */
.role-item-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 14px 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
}

/* accordion summary (Admin / Manager) */
.role-item summary {
  font-size: 16px;
  font-weight: 700;
  color: #0c4a6e;
  cursor: pointer;
  margin-top: 6px;

}

/* make the arrow cleaner */
.role-item summary::-webkit-details-marker {
  display: none;
}

/* OUR CUSTOM ARROW */
.role-item[open] summary::before {
  content: "▼";
  position: absolute;
  left: 0;
  top: 1px;
  color: #0c4a6e;
  font-size: 14px;
}
.role-item summary::before {
  content: "▶";          /* Arrow closed */
  position: absolute;
  left: 0;
  top: 1px;
  color: #0c4a6e;
  font-size: 14px;
  font-weight: 700;
}
/* Input styling */
.input-lg {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #d1d5db;
  background: #fff;
  font-size: 15px;
  box-sizing: border-box;
  transition: 0.15s;
}

.input-lg:focus {
  border-color: #49bdb3;
  box-shadow: 0 0 0 3px rgba(73, 189, 179, 0.25);
  outline: none;
}

/* Input + Add button row */
.add-email-row {
  display: flex;
  gap: 12px;
  margin-top: 4px;
  align-items: center;
}
.add-email-row button:hover {
  filter: brightness(0.92);
}

/* ==================== INPUT PANJANG + ADD BUTTON KECIK ==================== */
.add-email-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.add-email-row .input-lg {
  flex: 3;                  /* 👉 lebih panjang ke kanan */
  height: 42px;
  font-size: 14px;
  padding: 10px 14px;
  color: #000;              /* 👉 email input text hitam */
}

.add-email-row button {
  height: 34px;             /* 👉 lagi kecil */
  padding: 0 12px;          /* 👉 kecilkan width */
  font-size: 13px;
  border-radius: 8px;
  background: #49bdb3;
  color: #fff;
  font-weight: 700;
  border: none;
  cursor: pointer;
}

/* ==================== LABEL STYLE LAGI BOLD + WARNA SAMA ==================== */
.row > label,
.role-form-row > label {
  font-size: 15px;
  font-weight: 600;
  color: #000;   /* HITAM */
}

/* ==================== EMAIL CHIP STYLING NEW ==================== */

.email-chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.email-chip {
  display: flex;                 /* penting */
  justify-content: space-between;/* email kiri, X kanan */
  align-items: center;
  
  padding: 10px 14px;
  background: #f0f0f0;
  border-radius: 16px;

  font-size: 14px;
  color: #000;
  font-weight: 600;

  width: 300px;                   /* biar fleksibel */
  max-width: 320px;              /* optional */
}

.email-chip .chip-x {
  background: transparent;
  border: none;
  color: #999;
  font-size: 16px;
  padding: 0 4px;
  cursor: pointer;
}

.email-chip .chip-x:hover {
  color: #555;           /* slightly darker on hover */
  background: transparent;
}

/* ==================== CLEANER LOOK ==================== */

.role-details-content {
  margin-top: 10px;
  padding-left: 28px;
  font-size: 14px;
  color: #334155;
}


/* staff list inside */
.staff-list {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* edit button */
.btn-edit {
  background: #49bdb3;
  color: #fff;
  border: none;
  padding: 8px 14px;
  font-weight: 700;
  border-radius: 10px;
  cursor: pointer;
  margin-left: 10px;
}

.btn-edit:hover {
  filter: brightness(.92);
}
/* Row for input + Add button */
.add-email-row {
  display: flex;
  gap: 10px;
  align-items: center; /* ensure perfect vertical alignment */
}

/* Input */
.add-email-row .input-lg {
  height: 42px;          /* match clean height */
  font-size: 14px;
  padding: 10px 14px;
}

/* Add button (smaller + aligned) */
.add-email-row button {
  height: 38px;          /* smaller height */
  padding: 0 16px;       /* smaller width */
  font-size: 14px;       /* smaller text */
  border-radius: 8px;
  background: #49bdb3;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center; /* center the text */
}

.add-email-row button:hover {
  filter: brightness(.92);
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
  border-color: #ef4444;
}
.toast-item.error .toast-icon {
  background: #ef4444;
}

.toast-item.info {
  border-color: #3b82f6;
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

  @media (max-width:768px){
    .settings-form-layout{ grid-template-columns:1fr; }
    .permission-box{ max-height:250px; }
  }
</style>
