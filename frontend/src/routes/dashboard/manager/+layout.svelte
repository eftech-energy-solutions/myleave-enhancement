<script>
  import ManagerSidebar from '$lib/components/ManagerSidebar.svelte';
  export let data;
</script>

<div class="no-x-scroll">
  <ManagerSidebar {data}>
    <slot />
  </ManagerSidebar>
</div>
