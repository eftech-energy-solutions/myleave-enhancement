<script>
  export let user;
  export let pathname = '';
  const roleBase = user ? `/dashboard/${user.role.toLowerCase()}` : '/dashboard';
  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');
</script>

<aside class="aside">
  <!-- Top: logo + nav -->
  <div class="top">
    <div class="logo">
      <img src="/images/myleave.logo.png" alt="MyLeave" />
    </div>

    <nav class="nav">
      <a href={roleBase} class:active={isActive(roleBase)}>
        <span class="ico">📊</span><span class="text">Dashboard</span>
      </a>
      <a href={`${roleBase}/history`} class:active={isActive(`${roleBase}/history`)}>
        <span class="ico">🗂️</span><span class="text">Leave History</span>
      </a>
      <a href={`${roleBase}/employees`} class:active={isActive(`${roleBase}/employees`)}>
        <span class="ico">👥</span><span class="text">Employees</span>
      </a>
    </nav>
  </div>

  <!-- Bottom: pinned sign out -->
  <div class="bottom">
    <a href="/logout" class="signout">
      <span class="ico">🚪</span><span class="text">Sign out</span>
    </a>
  </div>
</aside>

<style>
  .aside{
    background:#fff;
    border-right:1px solid var(--ring, #e5e7eb);
    padding:20px 16px;
    height:100dvh;
    position:sticky; top:0;
    display:flex; flex-direction:column;
  }

  .top{
    display:flex; flex-direction:column; gap:16px;
  }

  /* Logo stays at the very top */
  .logo img{ height:26px; display:block; }

  /* Nav stack */
  .nav{
    display:flex; flex-direction:column; gap:12px;
  }
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

  /* Pinned bottom area */
  .bottom{ margin-top:auto; }            /* pushes to bottom */
  .signout{ color:#e34040; display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:12px; }
  .signout:hover{ background:#feecec; }
</style>
