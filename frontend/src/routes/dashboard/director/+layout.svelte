<script>
  import DirectorSidebar from '$lib/components/DirectorSidebar.svelte';
  export let data;
</script>

<div class="no-x-scroll">
  <DirectorSidebar {data}>
    <slot />
  </DirectorSidebar>
</div>
