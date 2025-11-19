<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

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
  let error = "";
  let msg = "";

  // NAVIGATION (unchanged)
  const roleBase = '/dashboard/admin';

  const isActive = (href) => {
    const current = $page.url.pathname;
    if (href === roleBase) return current === href;
    return current.startsWith(href);
  };

  $: headerAvatarUrl = safeUser.photoUrl 
    ? `http://localhost:5000${safeUser.photoUrl}` 
    : '/images/icontest1.png';

  // FETCH USER
  onMount(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/employee/me', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        safeUser = { ...safeUser, ...data };
        profilePhotoUrl = safeUser.photoUrl
          ? `http://localhost:5000${safeUser.photoUrl}`
          : '';
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }

    try {
      const res2 = await fetch("http://localhost:5000/api/employee/me", {
        credentials: "include"
      });
      if (res2.ok) {
        const user = await res2.json();
        staffId = user.staffId;
      }
    } catch (err) {
      console.error('Error fetching info:', err);
    }

    loadingUser = false;
  });

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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return alert("Invalid email");
    if (newStaffEmailList.includes(email)) return alert("Already added");

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
    alert("No staff emails assigned.");
    return;
  }

  try {
    for (const email of newStaffEmailList) {
      const res = await fetch("http://localhost:5000/api/role-setting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          role: roleToEdit.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Error saving role:", data);
      }
    }

    alert("Role updated successfully!");
    goBackToList();
    settingsModalOpen = false;

  } catch (err) {
    console.error(err);
    alert("Server error while updating role.");
  }
}
  async function loadRolesFromDB() {
  try {
    const res = await fetch("http://localhost:5000/api/role-setting");
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
    console.log("Saving profile…");

    if (activeProfilePane === 'password') {
      const form = e.currentTarget;
      const pwdCurrent = form.querySelector('input[name="pwdCurrent"]').value;
      const pwd1 = form.querySelector('input[name="pwd1"]').value;
      const pwd2 = form.querySelector('input[name="pwd2"]').value;

      if (!pwdCurrent || !pwd1 || !pwd2) return alert("Fill all fields");
      if (pwd1 !== pwd2) return alert("Password mismatch");
      if (pwd1.length < 8) return alert("Password too short");

      const email = safeUser?.email || safeUser?.email;
      if (!email) return alert("Missing email");

      try {
        const res = await fetch("http://localhost:5000/api/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, currentPassword: pwdCurrent, newPassword: pwd1 })
        });

        const data = await res.json();
        if (!res.ok || !data?.success) throw new Error(data?.error);

        alert("Password updated");
        closeProfileModal();
      } catch (err) {
        alert(err.message);
      }
      return;
    }

    // picture upload
    if (activeProfilePane === 'picture') {
      if (!selectedFile) return alert("Choose a photo first");

      try {
        const fd = new FormData();
        fd.append("photo", selectedFile);

        const res = await fetch("http://localhost:5000/api/upload/profile", {
          method: "POST",
          body: fd,
          credentials: "include"
        });

        const data = await res.json();
        if (!data.success) return alert("Upload failed");

        const fullUrl = data.photoUrl.startsWith("http")
          ? data.photoUrl
          : `http://localhost:5000${data.photoUrl}`;

        profilePhotoUrl = fullUrl;
        safeUser.photoUrl = data.photoUrl;
        alert("Profile photo updated!");
      } catch (e) {
        alert("Upload failed");
      }
    }
  }

  function handlePhotoFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg)$/i.test(file.type)) return alert("PNG/JPG only");

    selectedFile = file;
    profilePhotoUrl = URL.createObjectURL(file);
  }

  // Page title
  $: pageTitle =
    $page.url.pathname === roleBase
      ? 'Dashboard'
      : $page.url.pathname.startsWith('/dashboard/admin/history')
      ? 'Leave Timeline'
      : $page.url.pathname.startsWith('/dashboard/admin/employees')
      ? 'Employees'
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
          <span class="text">Employees</span>
        </a>
      </nav>
    </div>

    <div class="bottom">
      <button type="button" class="settings-btn" title="Settings" on:click={openSettingsModal}>
        <span class="ico">
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>
        </span>
      </button>

      <a href="/logout" class="signout" title="Sign out">
        <span class="ico">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m17 7-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
        </span>
      </a>
    </div>
  </aside>

  <!-- ============ RIGHT CONTENT ============ -->
  <div class="right">
    <header class="topbar">
      <div class="title-wrap">
        <div class="hello">Welcome back, {safeUser.name}!</div>
        <h1 class="page-title">{pageTitle}</h1>
      </div>

      <div class="profile" use:clickOutside>
        <div class="profile-info">
          {#if safeUser.photoUrl}
            <img src={`http://localhost:5000${safeUser.photoUrl}`} class="avatar-img" alt="profile" />
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

    <div class="content-wrap">
      <main class="content">
        <slot />
      </main>
    </div>
  </div>
</div>

<!-- ================= PROFILE MODAL ================= -->
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
          <div class="row">
            <label>Current Password</label>
            <input type={showPwdCurrent ? 'text' : 'password'} name="pwdCurrent" class="input-lg" />
          </div>

          <div class="row">
            <label>New Password</label>
            <input type={showPwd1 ? 'text' : 'password'} name="pwd1" class="input-lg" />
          </div>

          <div class="row">
            <label>Confirm Password</label>
            <input type="password" name="pwd2" class="input-lg" />
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

<!-- ================= SETTINGS MODAL (ROLE) ================= -->
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
        <!-- === EDIT ROLE FORM === -->
        <form class="modal-bd" on:submit|preventDefault={saveRoleChanges}>
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
{/if}

<style>
  /* Layout (Tidak berubah) */
  .layout{
    display:grid;
    grid-template-columns: 220px 1fr;
    min-height:100dvh;
    background:#fafafa;
  }
  /* RIGHT SIDE (Tidak berubah) */
  .right{
    position: relative;
    display:flex;
    flex-direction:column;
    min-height:100dvh;
    background: linear-gradient(180deg,#49bdb3 0%,#2bb7b3 35%,#1798a5 65%,#0c4a6e 100%);
    overflow:hidden;
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

  /* Bottom Bar (Tidak berubah) */
  .bottom{ margin-top:auto; display:flex; justify-content:space-between; align-items:center; }
  .signout{ color:#e34040; display:flex; align-items:center; gap:12px; padding:10px; border-radius:12px; text-decoration:none; }
  .signout:hover{ background:#feecec; }
  .settings-btn{ display:flex; align-items:center; padding:10px; border-radius:12px; color:#217859; background:transparent; border:none; cursor:pointer; }
  .settings-btn:hover{ background:#f3f4f6; }
  
  /* Topbar (Tidak berubah) */
  .topbar{ display:flex; align-items:flex-end; justify-content:space-between; gap:10px; padding:20px 24px; background:transparent; border-bottom:1px solid rgba(255,255,255,.08); color:#fff; }
  .title-wrap{ display:flex; flex-direction:column; gap:.5px; color:#fff; }
  .hello{ font-size:18px; font-weight:400; opacity:.95; margin:0; color:#fff; }
  .page-title{ margin:0; font-size:55px; line-height:1.1; font-weight:700; color:#fff; }

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
  .who .name{ font-size:14px; font-weight:700; }
  .who .sub{ font-size:12px; opacity:.95; }

  .menu{ position:absolute; right:0; top:calc(100% + 8px); background:#fff; border:1px solid #e5e7eb; border-radius:10px; box-shadow:0 10px 30px rgba(0,0,0,.12); min-width:200px; padding:6px; z-index:30; }
  .menu-btn{ display:block; width:100%; padding:10px 12px; border:none; background:#fff; border-radius:8px; color:#111827; font-weight:600; text-align:left; cursor:pointer; }
  .menu-btn:hover{ background:#f3f4f6; }
  a.menu-btn{ text-decoration:none; } 

  /* Content (Tidak berubah) */
  .content-wrap{ flex:1; background:transparent; padding:16px; }
  .content{ max-width:1600px; margin:0 auto; }

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

  /* ============================
   FIXED ROLE SETTINGS (NEW)
   ============================ */

/* Wrapper list of roles (Admin / Manager / Staff) */
.role-fixed-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 420px;
  overflow-y: auto;
}

/* Single role card */
.role-fixed-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px 18px;
}

/* Role name (Admin / Manager / Staff) */
.role-fixed-title {
  font-weight: 700;
  font-size: 16px;
  margin-bottom: 10px;
  color: #0c4a6e;
}

/* Staff list inside role */
.role-staff-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 4px;
}

.role-staff-item {
  background: #eefaf9;
  border: 1px solid #d1f0ee;
  padding: 8px 12px;
  border-radius: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #0c4a6e;
}

/* Remove staff button */
.remove-staff-btn {
  background: #e34040;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 600;
}
.remove-staff-btn:hover {
  background: #cc2f2f;
}

/* Add staff section in Edit modal */
.add-staff-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.add-staff-row input {
  flex: 1;
  border-radius: 10px;
  padding: 12px 14px;
  border: 1px solid #d1d5db;
}

.add-staff-row button {
  background: #49bdb3;
  color: white;
  font-weight: 600;
  border: none;
  padding: 0 18px;
  border-radius: 10px;
  cursor: pointer;
}
.add-staff-row button:hover {
  background: #3ea9a1;
}

/* Email tags inside modal */
.edit-email-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #eefaf9;
  border: 1px solid #d1f0ee;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 13px;
  color: #0c4a6e;
  font-weight: 600;
}

.edit-email-chip .chip-x {
  color: #0c4a6e;
  border-radius: 5px;
  padding: 0 4px;
}
.edit-email-chip .chip-x:hover {
  background: #dff2f1;
}


  /* Email chips (Tidak berubah) */
  .add-email-row {
    display: flex;
    gap: 10px;
    align-items: stretch; /* match height */
  }
  .add-email-btn {
    background: #49bdb3;
    color: #fff;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    padding: 0 18px;
    cursor: pointer;
    font-size: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
  }
  .add-email-btn:hover {
    background: #3ea9a1; /* slightly darker on hover */
  }
  .email-chip-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }
  .email-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #eefaf9;
    color: #0c4a6e;
    border: 1px solid #d1f0ee;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
  }
  .chip-x {
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    color: #0c4a6e;
    padding: 0 2px;
    border-radius: 6px;
  }
  .chip-x:hover {
    background: #dff2f1;
  }

  /* NEW: Danger button */
  .btn-danger{
    padding:6px 12px;
    font-size:13px;
    font-weight:700;
    background:#e30707;
    color:#ffff;
    border:1px solid #f1b3af;
    border-radius:8px;
    cursor:pointer;
  }
  .btn-danger:hover{
    background:#d10606;
  }

  @media (max-width:768px){
    .settings-form-layout{ grid-template-columns:1fr; }
    .permission-box{ max-height:250px; }
  }
</style>
