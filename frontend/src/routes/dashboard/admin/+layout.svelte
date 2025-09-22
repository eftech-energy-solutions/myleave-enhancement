<!-- src/routes/dashboard/admin/+layout.svelte -->
<script>
  import AdminSidebar from '$lib/components/AdminSidebar.svelte';
  export let data;
</script>

<AdminSidebar {data}>
  <slot />
</AdminSidebar>
