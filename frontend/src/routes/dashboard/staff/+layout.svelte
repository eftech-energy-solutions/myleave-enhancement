<!-- src/routes/+layout.svelte -->
<script>
  import StaffSidebar from '$lib/components/StaffSidebar.svelte';
  import { page } from '$app/stores';
  export let data;
</script>

<div class="no-x-scroll">
  <StaffSidebar user={data?.user} pathname={$page.url.pathname}>
    <slot />
  </StaffSidebar>
</div>
