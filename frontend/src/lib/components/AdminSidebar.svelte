<script>
  import { page } from '$app/stores';
  export let data; // contains { user }

  const user = data?.user ?? { name: 'admin', role: 'Human Resources', staffId: 'E8505' };
  let profileMenuOpen = false;

  // click-outside action for profile dropdown
  function clickOutside(node) {
    const onClick = (e) => { if (!node.contains(e.target)) profileMenuOpen = false; };
    document.addEventListener('click', onClick);
    return { destroy: () => document.removeEventListener('click', onClick) };
  }
</script>

<div class="container">
  <!-- LEFT SIDEBAR (full height) -->
  <aside class="aside">
    <div class="top">
      <div class="logo">
        <img src="/images/myleave.logo.png" alt="MyLeave" />
      </div>

      <nav class="nav">
        <!-- Admin-only dashboard group -->
        <div class="nav-group">
          <span class="ico">📊</span>
          <span class="font-bold">Dashboard</span>
        </div>
        <div class="sub-links">
          <a href="/dashboard/admin/main"
            class:active={$page.url.pathname.startsWith('/dashboard/admin/main')}>
            <span class="text">• Main</span>
          </a>
          <a href="/dashboard/admin/reports"
            class:active={$page.url.pathname.startsWith('/dashboard/admin/reports')}>
            <span class="text">• Reports</span>
          </a>
        </div>

        <a href="/dashboard/admin/history" class:active={$page.url.pathname.startsWith('/dashboard/history')}>
          <span class="ico">🗂️</span><span class="text">Leave History</span>
        </a>

        <a href="/dashboard/admin/employees" class:active={$page.url.pathname.startsWith('/dashboard/admin/employees')}>
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

  <!-- RIGHT: MAIN AREA -->
  <main class="main dash-main">
    <!-- ===== Topbar with Avatar Header ===== -->
    <!-- ===== Topbar with Conditional Title + Avatar (fixed) ===== -->
<header class="topbar">
  <!-- Left: dynamic title -->
  <div class="title-wrap">
    <div class="hello">Welcome back, {user?.name || 'admin'}!</div>

    {#if $page.url.pathname.startsWith('/dashboard/admin/main')}
      <h1 class="page-title">Dashboard</h1>
    {:else if $page.url.pathname.startsWith('/dashboard/admin/reports')}
      <h1 class="page-title">My Dashboard</h1>
    {:else if $page.url.pathname.startsWith('/dashboard/admin/history') || $page.url.pathname.startsWith('/dashboard/history')}
      <h1 class="page-title">Leave History</h1>
    {:else if $page.url.pathname.startsWith('/dashboard/admin/employees')}
      <h1 class="page-title">Employees</h1>
    {:else}
      <h1 class="page-title">My Dashboard</h1>
    {/if}
  </div>

  <!-- Right: avatar cluster (unchanged) -->
  <div class="profile" use:clickOutside>
    <button class="icon-btn bell" aria-label="Notifications">🔔</button>

    <div class="profile-info">
      <img
        src="/images/icontest1.png"
        alt="avatar"
        class="avatar-img"
        on:error={(e)=> e.currentTarget.style.display='none'}
      />
      <div class="who">
        <div class="name">{user?.name || 'Afiq Mikail'}</div>
        <div class="sub">{user?.role || 'Human Resources'}</div>
        <div class="sub">#{user?.staffId || 'E8505'}</div>
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
        <a role="menuitem" href="/dashboard/admin/profile">Update Profile Picture</a>
        <a role="menuitem" href="/dashboard/admin/profile">Update Password</a>
      </div>
    {/if}
  </div>
</header>


    <div class="container-inner">
      <slot />
    </div>
  </main>
</div>

<style>
  .sub-links {
    margin-left: 2rem; /* indent for child items */
    display: flex;
    flex-direction: column;
  }
  .sub-links a {
    font-size: 0.9rem;
    margin: 2px 0;
  }

  
  /* ===== Topbar + Avatar Header ===== */
 .topbar{
  display: flex;
  align-items: flex-end;      /* rapat bawah supaya Hello + Title sejajar */
  justify-content: space-between;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,.08);
}

.title-wrap {
  display: flex;
  flex-direction: column;
  gap: .5px;                  /* jarak antara "Welcome admin" dengan title */
  color: #fff;
}

.title-wrap .hello {
  font-size: 18px;
  font-weight: 400;
  opacity: .95;
  margin: 0;
  color: #fff;              /* putih */
}

.title-wrap .page-title {
  margin: 0;
  font-size: 55px;          /* besarkan tulisan Dashboard */
  line-height: 1.1;
  font-weight: 700;
  color: #fff;              /* putih */
  letter-spacing: .5px;
}


  .profile{
    position:relative;
    display:flex;
    align-items:center;
    gap:10px;
  }
  .icon-btn{
    border:none;
    background:transparent;
    cursor:pointer;
    font-size:18px;
    line-height:1;
    padding:6px;
    border-radius:8px;
    color:#fff;
  }
  .icon-btn:hover{ background:rgba(255,255,255,.12); }
  .caret{ font-size:16px; }

  .profile-info{
    display:flex;
    align-items:center;
    gap:10px;
    color:#fff;
    position:relative;
  }
  .avatar-img{
    height:70px; width:70px;
    border-radius:9999px;
    display:block;
    box-shadow:0 0 0 2px rgba(255,255,255,.25);
    object-fit:cover;
  }
  .who .name{  font-size:14px; font-weight:700; }
  .who .sub{   font-size:12px; opacity:.95; }

  .profile .menu{
    position:absolute;
    right:0;
    top:calc(100% + 8px);
    background:#fff;
    border:1px solid #e5e7eb;
    border-radius:10px;
    box-shadow:0 10px 30px rgba(0,0,0,.12);
    min-width:200px;
    padding:6px;
    z-index:30;
  }
  .profile .menu a{
    display:block;
    padding:10px 12px;
    border-radius:8px;
    color:#111827;
    font-weight:600;
    text-decoration:none;
  }
  .profile .menu a:hover{ background:#f3f4f6; }

  @media (max-width:640px){
    .who .sub{ display:none; }
    .avatar-img{ height:64px; width:64px; }
  }
</style>
