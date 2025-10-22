<script>
  import ManagerSidebar from '$lib/components/ManagerSidebar.svelte';
  export let data;
</script>

<ManagerSidebar {data}>
  <slot />
</ManagerSidebar>
