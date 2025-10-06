<!-- src/routes/dashboard/admin/+layout.svelte -->
<script>
  import AdminSidebar from '$lib/components/Sidebar.svelte';
  import { page } from '$app/stores';
  export let data; // should contain { user } at least
</script>

<AdminSidebar user={data.user} pathname={$page.url.pathname}>
  <slot />
</AdminSidebar>
