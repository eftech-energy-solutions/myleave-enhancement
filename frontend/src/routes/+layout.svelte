<script>
  import '../app.css';
  import { page } from '$app/stores';

  $: title = resolveTitle($page.url.pathname);

  function resolveTitle(pathname) {
    if (pathname === '/login') return 'Login | MyLeave';
    if (!pathname.startsWith('/dashboard')) return 'MyLeave';
    const rest = pathname.replace(/^\/dashboard\/[^/]+/, '');
    let t = 'Dashboard';
    if (rest === '/history') t = 'Leave History';
    else if (rest === '/myhistory' || rest === '/staffhistory') t = 'My Leave History';
    else if (rest === '/employees' || rest === '/employees/all') t = 'Employees';
    else if (rest === '/leave-approvals') t = 'Approve Leave';
    else if (rest === '/profile') t = 'My Profile';
    else if (rest === '/logs') t = 'Activity Logs';
    else if (rest === '/chat') t = 'Chat';
    else if (rest === '/reports') t = 'My Dashboard';
    return `${t} | MyLeave`;
  }
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

<slot />