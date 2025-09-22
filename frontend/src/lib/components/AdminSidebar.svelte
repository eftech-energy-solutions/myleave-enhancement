<script>
  import { page } from '$app/stores';
  export let data; // contains { user }
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
</style>
