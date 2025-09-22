<script>
  // Only dashboard pages use this CSS
  import '../../app.css';
  import { page } from '$app/stores';
  export let data;
</script>

<!-- Two-column layout: sidebar + main -->
<div class="container">
  <!-- LEFT SIDEBAR (full height) -->
  <aside class="aside">
    <div class="top">
      <div class="logo">
        <img src="/images/myleave.logo.png" alt="MyLeave" />
      </div>

      <nav class="nav">
        <a href="/dashboard/staff" class:active={$page.url.pathname.startsWith('/dashboard/staff')}>
          <span class="ico">📊</span><span class="text">Dashboard</span>
        </a>
        <a href="/dashboard/history" class:active={$page.url.pathname.startsWith('/dashboard/history')}>
          <span class="ico">🗂️</span><span class="text">Leave History</span>
        </a>
        <a href="/dashboard/employees" class:active={$page.url.pathname.startsWith('/dashboard/employees')}>
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
    <!-- Keep .container-inner INSIDE MAIN so it doesn't push the sidebar -->
    <div class="container-inner">
      <slot />
    </div>
  </main>
</div>
