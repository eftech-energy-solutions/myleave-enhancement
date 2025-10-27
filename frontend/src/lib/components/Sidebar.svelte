<script>
  import { page } from '$app/stores';

  // Props (unchanged)
  export let user = null;

  // ---- NAV (do.not change role) ----
  const roleBase = '/dashboard/admin';

  // Updated logic (unchanged)
  const isActive = (href) => {
    const current = $page.url.pathname;
    if (href === roleBase) {
      return current === href; // Exact match for Dashboard
    }
    return current.startsWith(href); // Partial match for other pages
  };

  // ---- Header state (unchanged) ----
  const safeUser = user ?? { name: 'admin', role: 'Human Resources', staffId: 'E8505' };
  let profileMenuOpen = false;
  let headerAvatarUrl = '/images/icontest1.png';

  // ---- Profile Modal State (unchanged) ----
  let profileModalOpen = false;
  let activeProfilePane = 'picture'; // 'picture' | 'password'
  let profilePhotoUrl = '';
  let showPwd1 = false;

  // ---- Settings Modal State (DIKEMASKINI) ----
  let settingsModalOpen = false;
  let settingsModalView = 'list'; // 'list' | 'form'
  let roleToEdit = null; // BARU: Untuk 'track' role yang sedang diedit

  // Senarai semua 'functions' yang boleh dipilih (unchanged)
  const allPermissions = [
    'Add employee/profile',
    'View employee/profile',
    'Edit employee/profile',
    'Delete employee/profile',
    'Add public holiday/additional leave',
    'View public holiday/additional leave',
    'Edit public holiday/additional leave',
    'Delete public holiday/additional leave',
    'Add leave',
    'View leave',
    'Delete leave',
    'Approve leave',
    'Add cancellation',
    'View cancellation',
    'Delete Cancellation',
    'Approve cancellation',
    'Add new password'
  ];

  // Data demo (DIKEMASKINI dengan 'staff')
  let roles = [
    { 
      id: 1, 
      name: 'Human Resources', 
      permissions: [
        'Add employee/profile',
        'View employee/profile',
        'Edit employee/profile',
        'Delete employee/profile',
        'View leave',
        'Approve leave'
      ],
      staff: [
        { id: 'E8505', email: 'admin@demo.com' },
        { id: 'E8506', email: 'hr_staff@demo.com' }
      ]
    },
    {
      id: 2,
      name: 'Manager',
      permissions: ['View employee/profile', 'View leave', 'Approve leave'],
      staff: [
        { id: 'M1001', email: 'manager1@demo.com' }
      ]
    }
  ];

  // State untuk borang 'Add/Edit Role'
  let newRoleName = '';
  let newRolePermissions = []; 

  // clickOutside action (unchanged)
  function clickOutside(node) {
    const onClick = (e) => { if (!node.contains(e.target)) profileMenuOpen = false; };
    document.addEventListener('click', onClick);
    return { destroy: () => document.removeEventListener('click', onClick) };
  }

  // --- Fungsi Modal Profile (unchanged) ---
  function openProfileModal() {
    activeProfilePane = 'picture';
    profileModalOpen = true;
    profileMenuOpen = false;
  }
  function closeProfileModal() { profileModalOpen = false; }
  
  // ---- Fungsi Modal Settings (DIKEMASKINI) ----
  function openSettingsModal() {
    settingsModalView = 'list'; 
    settingsModalOpen = true;
  }
  function closeSettingsModal() {
    settingsModalOpen = false;
    roleToEdit = null; // Pastikan 'reset' bila tutup
  }
  
  // BARU: Fungsi untuk tunjuk borang 'Add New'
  function goToAddRoleForm() {
    roleToEdit = null; // Pastikan 'null' untuk mode 'Add'
    newRoleName = ''; 
    newRolePermissions = []; 
    settingsModalView = 'form'; 
  }
  
  // BARU: Fungsi untuk tunjuk borang 'Edit'
  function startEditRole(role) {
    roleToEdit = role; // Set role yang nak diedit
    newRoleName = role.name; // Pra-isi nama
    newRolePermissions = [...role.permissions]; // Pra-isi 'functions' (buat salinan)
    settingsModalView = 'form'; // Tukar view
  }
  
  function goBackToList() {
    settingsModalView = 'list'; 
    roleToEdit = null; // 'Clear' state edit
  }

  // ---- Fungsi Simpan Role (DIKEMASKINI) ----
  function handleSaveRole() {
    if (!newRoleName) return alert('Please enter a role name.');
    if (newRolePermissions.length === 0) return alert('Please select at least one function.');

    if (roleToEdit) {
      // --- LOGIK EDIT ---
      // Cari role dalam array dan kemas kini
      roles = roles.map(role => {
        if (role.id === roleToEdit.id) {
          return {
            ...role, // Kekalkan ID dan senarai Staff
            name: newRoleName,
            permissions: newRolePermissions // Guna 'permissions' yang baru
          };
        }
        return role;
      });
      alert('Role updated!');

    } else {
      // --- LOGIK ADD NEW (asal) ---
      const newRole = {
        id: Date.now(),
        name: newRoleName,
        permissions: newRolePermissions,
        staff: [] // Role baru bermula tanpa staff (demo)
      };
      roles = [...roles, newRole];
      alert('New role added!');
    }
    
    goBackToList(); // Kembali ke senarai
  }
  
  // --- Fungsi Simpan Profile (unchanged) ---
  function saveProfile(e) {
    e.preventDefault();
    if (activeProfilePane === 'password') {
      const pwd1 = e.currentTarget.querySelector('input[name="pwd1"]').value;
      const pwd2 = e.currentTarget.querySelector('input[name="pwd2"]').value;
      if (!pwd1 || !pwd2) return alert('Please fill both password fields.');
      if (pwd1 !== pwd2) return alert('Passwords do not match.');
      if (pwd1.length < 8) return alert('Password must be at least 8 characters.');
      alert('Password updated (demo).');
    } else {
      if (!profilePhotoUrl) return alert('Please select a profile picture.');
      headerAvatarUrl = profilePhotoUrl; // live update
      alert('Profile picture updated (demo).');
    }
    closeProfileModal();
  }
  
  // --- Fungsi Lain (unchanged) ---
  function handlePhotoFile(e) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg)$/i.test(file.type)) {
      alert('Please choose a PNG or JPG image.');
      e.currentTarget.value = '';
      return;
    }
    profilePhotoUrl = URL.createObjectURL(file);
  }

  // ---- Page title (unchanged) ----
  $: pageTitle =
    $page.url.pathname === roleBase
      ? 'Dashboard'
      : $page.url.pathname.startsWith('/dashboard/admin/history')
        ? 'Leave Timeline'
        : $page.url.pathname.startsWith('/dashboard/admin/employees')
          ? 'Employees'
          : 'My Dashboard';

  // ---- Tajuk Modal Settings Dinamik (DIKEMASKINI) ----
  $: settingsModalTitle = 
    settingsModalView === 'list' 
      ? 'Role Access Permission' 
      : (roleToEdit ? 'Edit Role' : 'Add New Role');
</script>

<div class="layout">
  <aside class="aside">
    <div class="top">
      <div class="logo">
        <img src="/images/myleave.logo.png" alt="MyLeave" />
      </div>
      <nav class="nav">
        <a href={roleBase} class:active={isActive(roleBase)}>
          <span class="ico">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10 3H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 11H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1zm11-11h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 11h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1z"></path></svg>
          </span>
          <span class="text">Dashboard</span>
        </a>
        <a href="/dashboard/admin/history" class:active={isActive('/dashboard/admin/history')}>
          <span class="ico">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zM5 8V6h14v2H5z"></path></svg>
          </span>
          <span class="text">Leave History</span>
        </a>
        <a href="/dashboard/admin/employees" class:active={isActive('/dashboard/admin/employees')}>
          <span class="ico">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"></path></svg>
          </span>
          <span class="text">Employees</span>
        </a>
      </nav>
    </div>
    <div class="bottom">
      <button 
        type="button"
        class="settings-btn" 
        title="Settings" 
        on:click={openSettingsModal}
      >
        <span class="ico">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25.35.272.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </span>
      </button>
      <a href="/logout" class="signout" title="Sign out">
        <span class="ico">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m17 7-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"></path></svg>
        </span>
      </a>
    </div>
  </aside>

  <div class="right">
    <header class="topbar">
      <div class="title-wrap">
        <div class="hello">Welcome back, {safeUser?.name || 'admin'}!</div>
        <h1 class="page-title">{pageTitle}</h1>
      </div>
      <div class="profile" use:clickOutside>
        <div class="profile-info">
          <img
            src={headerAvatarUrl}
            alt="avatar"
            class="avatar-img"
            on:error={(e)=> e.currentTarget.style.display='none'}
          />
          <div class="who">
            <div class="name">{safeUser?.name || 'Afiq Mikail'}</div>
            <div class="sub">{safeUser?.role || 'Human Resources'}</div>
            <div class="sub">#{safeUser?.staffId || 'E8505'}</div>
          </div>
        </div>
        <button
          class="icon-btn caret"
          aria-haspopup="menu"
          aria-expanded={profileMenuOpen}
          on:click={() => (profileMenuOpen = !profileMenuOpen)}
          aria-label="Open profile menu"
        >▾</button>
        {#if profileMenuOpen}
          <div class="menu" role="menu">
            <button class="menu-btn" type="button" on:click={openProfileModal}>
              Update Profile
            </button>
          </div>
        {/if}
      </div>
    </header>
    <div class="content-wrap">
      <main class="content">
        <slot />
      </main>
    </div>
  </div>
</div>

{#if profileModalOpen}
  <div class="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="profile-title">
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
          on:click={() => (activeProfilePane = 'picture')}
        >Profile Picture</button>
        <button
          class:selected={activeProfilePane === 'password'}
          role="tab"
          aria-selected={activeProfilePane === 'password'}
          on:click={() => (activeProfilePane = 'password')}
        >Password</button>
      </div>
      <form class="modal-bd" on:submit={saveProfile}>
        {#if activeProfilePane === 'picture'}
          <div class="pic-wrap">
            {#if profilePhotoUrl}
              <img src={profilePhotoUrl} alt="Preview" class="preview" />
            {:else}
              <div class="placeholder">No photo chosen</div>
            {/if}
            <input type="file" accept="image/png,image/jpeg" on:change={handlePhotoFile} />
            <div class="muted">PNG/JPG up to ~5 MB. Square images (1:1) look best.</div>
          </div>
        {:else}
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
                      fill="none" stroke="currentColor" width="20" height="20" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.04-2.84 3.05-5.2 5.66-6.6"/>
                    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a10.95 10.95 0 0 1-4.06 5.06"/>
                    <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" width="20" height="20" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
        {/if}
        <div class="form-ft">
          <button type="button" class="btn-ghost" on:click={closeProfileModal}>Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if settingsModalOpen}
  <div class="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    
    <div class="modal modal-lg">
      
      <div class="modal-hd">
        <div id="settings-title" class="modal-ttl">{settingsModalTitle}</div>
        <button class="modal-x" on:click={closeSettingsModal} aria-label="Close">✕</button>
      </div>

      {#if settingsModalView === 'list'}
        
        <div class="modal-bd">
          <div class="role-list">
            {#each roles as role (role.id)}
              <div class="role-item-wrapper">
                <details class="role-item">
                  <summary>{role.name}</summary>
                  
                  <div class="role-details-content">
                    <strong>Functions:</strong>
                    <ul class="permission-list">
                      {#each role.permissions as perm}
                        <li>{perm}</li>
                      {:else}
                        <li>No functions assigned.</li>
                      {/each}
                    </ul>
                    
                    <strong>Assigned Staff:</strong>
                    <ul class="staff-list">
                      {#each role.staff as s}
                        <li>{s.email} (ID: {s.id})</li>
                      {:else}
                        <li>No staff assigned.</li>
                      {/each}
                    </ul>
                  </div>
                </details>
                
                <button class="btn-edit" on:click={() => startEditRole(role)}>
                  Edit
                </button>
              </div>
            {:else}
              <div class="placeholder">No roles defined. Click 'Add New Role' to start.</div>
            {/each}
          </div>
        </div>
        
        <div class="form-ft" style="justify-content: space-between;">
          <button type="button" class="btn-ghost" on:click={closeSettingsModal}>Close</button>
          <button type="button" class="btn-primary" on:click={goToAddRoleForm}>
            Add New Role
          </button>
        </div>

      {:else}

        <form class="modal-bd" on:submit|preventDefault={handleSaveRole}>
          
          <div class="settings-form-layout">
            <div class="row">
              <label for="role-name">Role Name</label>
              <input
                type="text"
                id="role-name"
                class="input-lg"
                placeholder="e.g., Manager"
                bind:value={newRoleName}
                required
              />
            </div>

            <div class="row">
              <label>Functions / Permissions</label>
              <div class="permission-box">
                {#each allPermissions as perm (perm)}
                  <label class="checkbox-label">
                    <input type="checkbox" value={perm} bind:group={newRolePermissions} />
                    {perm}
                  </label>
                {/each}
              </div>
            </div>
          </div>

          <div class="form-ft">
            <button type="button" class="btn-ghost" on:click={goBackToList}>Back to List</button>
            <button type="submit" class="btn-primary">
              {roleToEdit ? 'Save Changes' : 'Save Role'}
            </button>
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
  background: linear-gradient(
    180deg,
    #49bdb3 0%,
    #2bb7b3 35%,
    #1798a5 65%,
    #0c4a6e 100%
  );
  overflow:hidden;
}
.right::before{
  content:"";
  position:absolute; inset:0;
  background:
    radial-gradient(1000px 420px at 110% -20%,
      rgba(255,255,255,.25) 0%,
      rgba(255,255,255,0) 70%),
    url('/images/bg.png') center/cover no-repeat fixed;
  opacity:.35;
  mix-blend-mode: soft-light;
  pointer-events:none;
}

  /* Sidebar (Tidak berubah) */
  .aside{
    background:#fff;
    border-right:1px solid var(--ring, #e5e7eb);
    padding:15px 14px;
    position:sticky; top:0;
    height:100dvh;
    display:flex; flex-direction:column;
  }
  .top{ display:flex; flex-direction:column; gap:16px; }
  .logo img{ height:38px; display:block; margin: auto;}
  .nav{ display:flex; flex-direction:column; gap:12px; }
  .nav a{
    display:flex; align-items:center; gap:12px;
    padding:10px 12px; border-radius:12px;
    color:#217859; font-weight:600; text-decoration:none;
  }
  .nav a:hover{ background:#f3f4f6; }
  .nav a.active{
    background:#eaf6f7;
    border-left:4px solid #1fb3b2;
    padding-left:8px;
    color: #1fb3b2;
  }
  .ico{ font-size:20px; width:24px; height: 24px; display:inline-grid; place-items:center; }
  
  /* SVG Icon Styles (unchanged) */
  .ico svg {
    width: 22px;
    height: 22px;
    fill: #217859; 
  }
  .nav a.active .ico svg {
    fill: #1fb3b2;
  }
  .signout .ico svg {
    fill: #e34040;
  }
  .settings-btn .ico svg {
    fill: none; /* Penting untuk ikon outline */
  }

  /* Bottom Bar (diubah untuk button) */
  .bottom{
    margin-top:auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .signout{
    color:#e34040;
    display:flex;
    align-items:center;
    gap:12px;
    padding:10px;
    border-radius:12px;
    text-decoration: none;
  }
  .signout:hover{ background:#feecec; }

  .settings-btn {
    display:flex;
    align-items:center;
    padding: 10px;
    border-radius: 12px;
    color: #217859; 
    background: transparent;
    border: none;
    cursor: pointer;
  }
  .settings-btn:hover {
    background: #f3f4f6;
  }
  
  /* Topbar (Tidak berubah) */
  .topbar{
    display:flex;
    align-items:flex-end;
    justify-content:space-between;
    gap:10px;
    padding:20px 24px;
    background:transparent; 
    border-bottom:1px solid rgba(255,255,255,.08);
    color:#fff;
  }
  .title-wrap{ display:flex; flex-direction:column; gap:.5px; color:#fff; }
  .hello{ font-size:18px; font-weight:400; opacity:.95; margin:0; color:#fff; }
  .page-title{ margin:0; font-size:55px; line-height:1.1; font-weight:700; color:#fff; }

  /* Profile Dropdown (Tidak berubah) */
  .profile{ position:relative; display:flex; align-items:center; gap:10px; }
  .icon-btn{ border:none; background:transparent; cursor:pointer; font-size:18px; line-height:1; padding:6px; border-radius:8px; color:#fff; }
  .icon-btn:hover{ background:rgba(255,255,255,.12); }
  .caret{ font-size:16px; }
  .profile-info{ display:flex; align-items:center; gap:10px; color:#fff; }
  .avatar-img{ height:70px; width:70px; border-radius:9999px; object-fit:cover; box-shadow:0 0 0 2px rgba(255,255,255,.25); }
  .who .name{ font-size:14px; font-weight:700; }
  .who .sub{ font-size:12px; opacity:.95; }

  .menu{
    position:absolute; right:0; top:calc(100% + 8px);
    background:#fff; border:1px solid #e5e7eb; border-radius:10px; box-shadow:0 10px 30px rgba(0,0,0,.12);
    min-width:200px; padding:6px; z-index:30;
  }
  .menu-btn{
    display:block; width:100%; padding:10px 12px; border:none; background:#fff;
    border-radius:8px; color:#111827; font-weight:600; text-align:left; cursor:pointer;
  }
  .menu-btn:hover{ background:#f3f4f6; }
  a.menu-btn { text-decoration: none; } 

  /* Content (Tidak berubah) */
  .content-wrap{
    flex:1;
    background:transparent;
    padding:16px;
  }
  .content{ max-width:1600px; margin:0 auto; }

  /* Modal styles (Umum) */
  .modal-wrap{ position:fixed; inset:0; background:rgba(0,0,0,.4); display:grid; place-items:center; z-index:50; }
  .modal{ background:#fff; border-radius:12px; width:420px; max-width:95vw; box-shadow:0 12px 30px rgba(0,0,0,.2); overflow:hidden; }
  .modal-hd{ display:flex; justify-content:space-between; align-items:center; padding:14px 18px; border-bottom:1px solid #e5e7eb; }
  .modal-ttl{ font-size:18px; font-weight:700; color:#49bdb3; }
  .modal-x{ border:none; background:transparent; font-size:20px; cursor:pointer; }

  .tabs{ display:flex; border-bottom:1px solid #e5e7eb; }
  .tabs button{ flex:1; padding:10px; background:#f9fafb; border:none; cursor:pointer; font-weight:600; color:#000; }
  .tabs button.selected{ background:#fff; border-bottom:2px solid #49bdb3; color:#000; }

  .modal-bd{ padding:18px; display:flex; flex-direction:column; gap:14px; }
  .pic-wrap{ display:flex; flex-direction:column; gap:10px; }
  .preview{ max-width:100%; border-radius:10px; }
  .placeholder{ padding:40px; text-align:center; color:#6b7280; border:1px dashed #d1d5db; border-radius:10px; }

  .row{ display:flex; flex-direction:column; gap:6px; }
  .row label{ font-weight:600; font-size:14px; color:#000; }

  .form-ft{ display:flex; justify-content:flex-end; gap:10px; margin-top:10px; padding: 18px; border-top: 1px solid #e5e7eb; background: #f9fafb;}
  .modal-bd + .form-ft { margin-top: 0; }
  
  .btn-ghost{ background:#fff; color:#000e; border:1px solid #d1d5db; border-radius:8px; padding:.6rem 1rem; font-weight:600; cursor:pointer; }
  .btn-primary{ background:#49bdb3; color:#fff; border:none; border-radius:8px; padding:.6rem 1rem; font-weight:700; cursor:pointer; }
  .btn-primary:hover{ filter:brightness(.95); }

  .muted{ color:#64748b; font-size:12px; }

  .input-lg{ font-size:16px; padding:12px 14px; border:1px solid #d1d5db; border-radius:10px; outline:none; width: 100%; box-sizing: border-box; }
  .input-lg:focus{ border-color:#49bdb3; box-shadow:0 0 0 3px rgba(73,189,179,.15); }

  .input-wrap-lg{ position:relative; display:flex; align-items:center; }
  .input-wrap-lg .input-lg{ width:100%; padding-right:44px; }
  .eye-btn{
    position:absolute; right:10px; height:32px; min-width:32px; display:grid; place-items:center;
    border:none; background:transparent; cursor:pointer; border-radius:8px; color:#0c4a6e;
  }
  .eye-btn:hover{ background:#f3f4f6; }


  /* #### CSS BARU UNTUK MODAL SETTINGS #### */

  /* 1. Besarkan modal */
  .modal-lg {
    width: 700px;
    max-width: 90vw;
  }

  /* 2. Style untuk senarai role (View 1) */
  .role-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 400px;
    overflow-y: auto;
  }
  .role-item-wrapper {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .role-item {
    flex-grow: 1; /* Ambil baki ruang */
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #f9fafb;
  }
  .role-item summary {
    padding: 12px 16px;
    font-weight: 600;
    cursor: pointer;
    list-style: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .role-item summary::after {
    content: '▾';
    font-size: 14px;
    transition: transform 0.2s;
  }
  .role-item[open] summary::after {
    transform: rotate(180deg);
  }
  .role-details-content {
    padding: 16px;
    padding-left: 40px;
    border-top: 1px solid #e5e7eb;
    background: #fff;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .role-details-content strong {
    font-size: 13px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .permission-list, .staff-list {
    padding: 0;
    margin: 0;
    margin-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .permission-list li, .staff-list li {
    font-size: 14px;
    color: #374151;
  }
  
  .btn-edit {
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 600;
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    cursor: pointer;
  }
  .btn-edit:hover {
    background: #e5e7eb;
  }


  /* 3. Style untuk borang (View 2) */
  .settings-form-layout {
    display: grid;
    grid-template-columns: 1fr 2fr; /* Kiri 1/3, Kanan 2/3 */
    gap: 24px;
  }

  .permission-box {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #d1d5db;
    padding: 12px;
    border-radius: 10px;
    background: #fdfdfd;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    cursor: pointer;
    padding: 4px;
  }
  /* Rupa (bila di-tick) */
  .checkbox-label input[type="checkbox"]:checked {
    background-color: #49bdb3; /* <-- INI DIA */
    border-color: #49bdb3;     /* <-- INI DIA */
  }
  .checkbox-label input {
    width: 16px;
    height: 16px;
  }

  /* Responsive untuk skrin kecil */
  @media (max-width: 768px) {
    .settings-form-layout {
      grid-template-columns: 1fr; /* Susun atas-bawah */
    }
    .permission-box {
      max-height: 250px;
    }
  }

</style>