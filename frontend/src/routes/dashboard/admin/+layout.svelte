<!-- src/routes/dashboard/admin/+layout.svelte -->
<script>
  import AdminSidebar from '$lib/components/Sidebar.svelte';
  import { page } from '$app/stores';
  export let data;
</script>

<div class="no-x-scroll">
  <AdminSidebar user={data.user} pathname={$page.url.pathname}>
    <slot />
  </AdminSidebar>
</div>
