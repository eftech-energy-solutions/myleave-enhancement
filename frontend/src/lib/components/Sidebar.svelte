<script>
  export let user;
  export let pathname = '';
  const roleBase = user ? `/dashboard/${user.role.toLowerCase()}` : '/dashboard';
  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');
</script>

<nav class="nav">
  <a href={roleBase} class:active={isActive(roleBase)}><span class="ico">📊</span><span class="text">Dashboard</span></a>
  <a href={`${roleBase}/history`} class:active={isActive(`${roleBase}/history`)}><span class="ico">🗂️</span><span class="text">Leave History</span></a>
  <a href={`${roleBase}/employees`} class:active={isActive(`${roleBase}/employees`)}><span class="ico">👥</span><span class="text">Employees</span></a>
</nav>
