<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  let selectedFile = null;
  // ---- NAV (staff role) ----
  const roleBase = '/dashboard/staff';
  
  // Updated logic: Dashboard requires an EXACT match.
  const isActive = (href) => {
    const current = $page.url.pathname;
    if (href === roleBase) {
      return current === href; // Exact match for Dashboard
    }
    return current.startsWith(href);
  };

// Fallback user info (before fetching from server)
  let safeUser = { 
    name: '', 
    role: '', 
    position:'',
    staffId: '', 
    department: '',
    photoUrl: null 
  };
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
  ? `http://localhost:5000${safeUser.photoUrl}?v=${Date.now()}`
  : '/images/icontest1.png';

  // --- Fetch current user on mount ---
  onMount(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/me/photo', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        // merge backend data (photoUrl, staffId, etc.) into safeUser
        safeUser = { ...safeUser, ...data };
        profilePhotoUrl = safeUser.photoUrl 
          ? `http://localhost:5000${safeUser.photoUrl}` 
          : '';
        console.log('safeUser updated on mount:', safeUser);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  });

  let profileMenuOpen = false;
  // Avatar header preview
  let headerAvatarUrl = '/images/icontest1.png';

  // Profile modal
  let profileModalOpen = false;
  let activeProfilePane = 'picture'; // 'picture' | 'password'
  let profilePhotoUrl = '';

  // Show/hide new password
  let showPwd1 = false;
  let showPwdCurrent = false; // <— add this

  // clickOutside action
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

  // function handlePhotoFile(e) {
  //   const file = e.currentTarget.files?.[0];
  //   if (!file) return;
  //   if (!/^image\/(png|jpeg)$/i.test(file.type)) {
  //     alert('Please choose a PNG or JPG image.');
  //     e.currentTarget.value = '';
  //     return;
  //   }
  //   profilePhotoUrl = URL.createObjectURL(file);
  // }

  async function saveProfile(e) {
    e.preventDefault();
    if (activeProfilePane === 'password') {
  const form = e.currentTarget;
  const pwdCurrent = form.querySelector('input[name="pwdCurrent"]').value || '';
  const pwd1 = form.querySelector('input[name="pwd1"]').value || '';
  const pwd2 = form.querySelector('input[name="pwd2"]').value || '';

  if (!pwdCurrent || !pwd1 || !pwd2) return alert('Please fill all password fields.');
  if (pwd1 !== pwd2) return alert('Passwords do not match.');
  if (pwd1.length < 8) return alert('Password must be at least 8 characters.');

  try {
    // cuba guna email kalau ada
    const email = (safeUser?.email || '').trim().toLowerCase();

    let res, data;

    if (email) {
      res = await fetch('http://localhost:5000/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          currentPassword: pwdCurrent,
          newPassword: pwd1,
        }),
      });

      data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to change password.');
      }

      alert('Password updated successfully!');
      closeProfileModal();
      return;
    }

    // fallback: guna staffId
    if (!safeUser.staffId) {
      throw new Error('Missing Staff ID or Email. Please re-login.');
    }

    res = await fetch(
      `http://localhost:5000/api/employee/${encodeURIComponent(safeUser.staffId)}/password`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: pwdCurrent,
          newPassword: pwd1,
        }),
      }
    );

    data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || 'Failed to change password.');
    }

    alert('Password updated successfully!');
    closeProfileModal();
  } catch (err) {
    console.error(err);
    alert(err.message || 'Server error.');
  }

  return;
}
else {
      // if (!profilePhotoUrl) return alert('Please select a profile picture.');
      // headerAvatarUrl = profilePhotoUrl; // live update
      // alert('Profile picture updated (demo).');

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

      const res = await fetch('http://localhost:5000/api/upload/profile', {
        method: 'POST',
        body: formData,
        credentials: 'include', // important for cookie auth
      });

      const data = await res.json();
       console.log('📤 Server response:', data);

      if (data.success) {
      const bust = `?v=${Date.now()}`;

      // 🔄 UPDATE DATA (source of truth)
      safeUser.photoUrl = data.photoUrl;

      // 🖼️ Modal preview
      profilePhotoUrl = `http://localhost:5000${data.photoUrl}${bust}`;

      // 🖼️ Sidebar avatar auto update (reactive)
      // headerAvatarUrl already reactive, no need manual set

      selectedFile = null;

      // ✅ TOAST SUCCESS
      showToast(
        'Profile photo updated successfully.',
        'success',
        'Profile Updated'
      );

      closeProfileModal();
      return;
    } else {
        alert(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error(err);
      alert('Upload failed.');
    }
  } else if (activeProfilePane === 'password') {
    // your existing password update logic here
  }

    }
    closeProfileModal();
  }

function handlePhotoFile(e) {
    const file = e.currentTarget.files?.[0];
    console.log('📁 File selected:', file);
    if (!file) return;
    if (!/^image\/(png|jpeg)$/i.test(file.type)) {
      alert('Please choose a PNG or JPG image.');
      e.currentTarget.value = '';
      return;
    }
    selectedFile = file;
    profilePhotoUrl = URL.createObjectURL(file);
  }

  // ---- Page title (staff paths) ----
  $: pageTitle =
    $page.url.pathname === roleBase
      ? 'My Dashboard'
      : $page.url.pathname.startsWith('/dashboard/staff/staffhistory')
        ? 'Leave Timeline'
        : 'My Dashboard'; // Fallback title
</script>

<div class="layout">
  <!-- LEFT SIDEBAR (STAFF) -->
  <aside class="aside">
    <div class="top">
      <div class="logo">
        <img src="/images/myleave.logo.png" alt="MyLeave" />
      </div>

      <nav class="nav">
        <a href={roleBase} class:active={isActive(roleBase)}>
          <span class="ico">
            <!-- Filled Grid Icon -->
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10 3H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 11H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1zm11-11h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 11h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1z"></path></svg>
          </span>
          <span class="text">My Dashboard</span>
        </a>
        <a href="/dashboard/staff/staffhistory" class:active={isActive('/dashboard/staff/staffhistory')}>
          <span class="ico">
            <!-- Filled Calendar Icon -->
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zM5 8V6h14v2H5z"></path></svg>
          </span>
          <span class="text">Leave History</span>
        </a>
      </nav>
    </div>

    <div class="bottom">
      <a href="/logout" class="signout">
        <span class="ico">
          <!-- Filled Logout Icon -->
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m17 7-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"></path></svg>
        </span>
        <span class="text">Sign out</span>
      </a>
    </div>
  </aside>

  <!-- RIGHT: HEADER + CONTENT -->
  <div class="right">
    <header class="topbar">
      <div class="title-wrap">
        <div class="hello">Welcome back, {safeUser?.name}!</div>
        <h1 class="page-title">{pageTitle}</h1>
      </div>  

      <div class="profile" use:clickOutside>
        <div class="profile-info">
          {#if safeUser?.photoUrl}
            {console.log('Rendering sidebar image URL:', safeUser.photoUrl)}
            <img
              src={`http://localhost:5000${safeUser.photoUrl}`}
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

<!-- PROFILE MODAL -->
{#if profileModalOpen}
  <div class="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="profile-title">
    <div class="modal">
      <div class="modal-hd">
        <div id="profile-title" class="modal-ttl">Update Profile</div>
        <button class="modal-x" on:click={closeProfileModal} aria-label="Close">✕</button>
      </div>

      <!-- Tabs -->
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

      <!-- Content -->
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
                <!-- icons unchanged -->
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
  /* Layout */
.layout{
    display:grid;
    grid-template-columns: 220px 1fr;
    min-height:100dvh;
    background:#fafafa;
}

  /* RIGHT SIDE gradient */
  .right{
    position: relative;
    display:flex;
    flex-direction:column;
    min-height:100dvh;
    background: linear-gradient(180deg,#49bdb3 0%,#2bb7b3 35%,#1798a5 65%,#0c4a6e 100%);
    overflow-y:auto;
  }
  .right::before{
    content:"";
    position:absolute; inset:0;
    background:
      radial-gradient(1000px 420px at 110% -20%, rgba(255,255,255,.25) 0%, rgba(255,255,255,0) 70%),
      url('/images/bg.png') center/cover no-repeat fixed;
    opacity:.35; mix-blend-mode: soft-light; pointer-events:none;
  }

  /* Sidebar */
  .aside{
    background:#fff; border-right:1px solid var(--ring, #e5e7eb);
    padding:20px 16px; position:sticky; top:0; height:100dvh;
    display:flex; flex-direction:column;
  }
  .top{ display:flex; flex-direction:column; gap:16px; }
  .logo img{ height:38px; display:block; margin: auto;}
  .nav{ display:flex; flex-direction:column; gap:12px; }
  .nav a{
    display:flex; align-items:center; gap:12px;
    padding:10px 12px; border-radius:12px;
    color: #217859; /* Your requested color */
    font-weight:600; text-decoration:none;
  }
  .nav a:hover{ background:#f3f4f6; }
  .nav a.active{
    background:#eaf6f7;
    border-left:4px solid #1fb3b2;
    padding-left:8px;
    color: #1fb3b2; /* Active color */
  }
  .ico{ display:inline-grid; place-items:center; width: 24px; height: 24px;}

  /* SVG Icon Styles */
  .ico svg {
    width: 22px;
    height: 22px;
    fill: #217859; /* Your requested color */
  }
  .nav a.active .ico svg {
    fill: #1fb3b2; /* Active color to match border */
  }
  .signout .ico svg {
    fill: #e34040; /* Keep signout icon red */
  }

  .bottom{ margin-top:auto; }
  .signout{ color:#e34040; display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:12px; }
  .signout:hover{ background:#feecec; }
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

  .page-title {
    margin: 0;
    font-size: 55px;
    line-height: 1.1;
    font-weight: 700;
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

  /* Content */
  .content-wrap{ flex:1; background:transparent; padding:16px; }
  .content{ max-width:1600px; margin:0 auto; }

  /* Modal styles */
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

  .form-ft{ display:flex; justify-content:flex-end; gap:10px; margin-top:10px; }
  .btn-ghost{ background:#fff; color:#000e; border:1px solid #d1d5db; border-radius:8px; padding:.6rem 1rem; font-weight:600; cursor:pointer; }
  .btn-primary{ background:#49bdb3; color:#fff; border:none; border-radius:8px; padding:.6rem 1rem; font-weight:700; cursor:pointer; }
  .btn-primary:hover{ filter:brightness(.95); }

  .muted{ color:#64748b; font-size:12px; }

  .input-lg{ font-size:16px; padding:12px 14px; border:1px solid #d1d5db; border-radius:10px; outline:none; }
  .input-lg:focus{ border-color:#49bdb3; box-shadow:0 0 0 3px rgba(73,189,179,.15); }

  .input-wrap-lg{ position:relative; display:flex; align-items:center; }
  .input-wrap-lg .input-lg{ width:100%; padding-right:44px; }
  .eye-btn{
    position:absolute; right:10px; height:32px; min-width:32px; display:grid; place-items:center;
    border:none; background:transparent; cursor:pointer; border-radius:8px; color:#0c4a6e;
  }
  .eye-btn:hover{ background:#f3f4f6; }
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
</style>

