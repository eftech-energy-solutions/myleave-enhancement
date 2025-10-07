<!-- src/routes/dashboard/staff/+layout.svelte -->
<script>
  import StaffSidebar from '$lib/components/StaffSidebar.svelte';
  import { page } from '$app/stores';
  export let data; // expects at least { user }
</script>

<StaffSidebar user={data?.user} pathname={$page.url.pathname}>
  <slot />
</StaffSidebar>
