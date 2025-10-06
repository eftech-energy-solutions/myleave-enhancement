<script>
  import { page } from '$app/stores';

  // Props (unchanged)
  export let user = null;
  export let pathname = '';

  // ---- NAV (do not change role) ----
  const roleBase = '/dashboard/admin';
  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  // ---- Header state (from your reference) ----
  const safeUser = user ?? { name: 'admin', role: 'Human Resources', staffId: 'E8505' };
  let profileMenuOpen = false;

  // Avatar header preview
  let headerAvatarUrl = '/images/icontest1.png';

  // Profile modal
  let profileModalOpen = false;
  let activeProfilePane = 'picture'; // 'picture' | 'password'
  let profilePhotoUrl = '';

  // Show/hide new password
  let showPwd1 = false;

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

  // ---- Page title based on admin paths ----
  $: currentPath = pathname || $page.url.pathname;
  $: pageTitle =
    currentPath === roleBase
      ? 'Dashboard'
      : currentPath.startsWith('/dashboard/admin/history')
        ? 'Leave Timeline'
        : currentPath.startsWith('/dashboard/admin/employees')
          ? 'Employees'
          : 'My Dashboard';
</script>

<div class="layout">
  <!-- LEFT SIDEBAR -->
  <aside class="aside">
    <div class="top">
      <div class="logo">
        <img src="/images/myleave.logo.png" alt="MyLeave" />
      </div>

      <nav class="nav">
        <a href={roleBase} class:active={isActive(roleBase)}>
          <span class="ico">📊</span><span class="text">Dashboard</span>
        </a>
        <a href="/dashboard/admin/history" class:active={isActive('/dashboard/admin/history')}>
          <span class="ico">🗂️</span><span class="text">Leave History</span>
        </a>
        <a href="/dashboard/admin/employees" class:active={isActive('/dashboard/admin/employees')}>
          <span class="ico">👥</span><span class="text">Employees</span>
        </a>
      </nav>
    </div>

    <div class="bottom">
      <a href="/logout" class="signout">
        <span class="ico">🚪</span><span class="text">Sign out</span>
      </a>
    </div>
  </aside>

  <!-- RIGHT: HEADER + CONTENT -->
  <div class="right">
    <!-- Topbar header (from your reference) -->
    <header class="topbar">
      <div class="title-wrap">
        <div class="hello">Welcome back, {safeUser?.name || 'admin'}!</div>
        <h1 class="page-title">{pageTitle}</h1>
      </div>

      <div class="profile" use:clickOutside>
        <button class="icon-btn bell" aria-label="Notifications">🔔</button>

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

    <!-- Pretty background behind content -->
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
                  <!-- eye-off -->
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                       fill="none" stroke="currentColor" width="20" height="20" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.04-2.84 3.05-5.2 5.66-6.6"/>
                    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a10.95 10.95 0 0 1-4.06 5.06"/>
                    <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                {:else}
                  <!-- eye -->
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

<style>
  /* Layout */
  .layout{
    display:grid;
    grid-template-columns: 260px 1fr;
    min-height:100dvh;
    background:#fafafa;
  }
/* RIGHT SIDE — smooth gradient like your screenshot */
.right{
  position: relative;
  display:flex;
  flex-direction:column;
  min-height:100dvh;

  /* flipped gradient: cerah atas → gelap bawah */
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

  /* Sidebar */
  .aside{
    background:#fff;
    border-right:1px solid var(--ring, #e5e7eb);
    padding:20px 16px;
    position:sticky; top:0;
    height:100dvh;
    display:flex; flex-direction:column;
  }
  .top{ display:flex; flex-direction:column; gap:16px; }
  .logo img{ height:26px; display:block; }
  .nav{ display:flex; flex-direction:column; gap:12px; }
  .nav a{
    display:flex; align-items:center; gap:12px;
    padding:10px 12px; border-radius:12px;
    color:#0f172a; font-weight:600; text-decoration:none;
  }
  .nav a:hover{ background:#f3f4f6; }
  .nav a.active{
    background:#eaf6f7;
    border-left:4px solid #1fb3b2;
    padding-left:8px;
  }
  .ico{ font-size:20px; width:20px; display:inline-grid; place-items:center; }
  .bottom{ margin-top:auto; }
  .signout{ color:#e34040; display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:12px; }
  .signout:hover{ background:#feecec; }

  /* Topbar (header from your reference) */
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
  .title-wrap{ display:flex; flex-direction:column; gap:.25rem; color:#fff; }
  .hello{ font-size:18px; font-weight:400; opacity:.95; margin:0; color:#fff; }
  .page-title{ margin:0; font-size:40px; line-height:1.15; font-weight:700; color:#fff; }

  .profile{ position:relative; display:flex; align-items:center; gap:10px; }
  .icon-btn{ border:none; background:transparent; cursor:pointer; font-size:18px; line-height:1; padding:6px; border-radius:8px; color:#fff; }
  .icon-btn:hover{ background:rgba(255,255,255,.12); }
  .caret{ font-size:16px; }
  .profile-info{ display:flex; align-items:center; gap:10px; color:#fff; }
  .avatar-img{ height:56px; width:56px; border-radius:9999px; object-fit:cover; box-shadow:0 0 0 2px rgba(255,255,255,.25); }
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

  /* Content background wrapper */
/* Background behind all content */
.content-wrap{
  flex:1;
  background:transparent;
  padding:16px;
}

  .content{ max-width:1600px; margin:0 auto; }

  /* Modal styles (copied) */
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
</style>
