<script>
  import Sidebar from '$lib/components/Sidebarlayout.svelte';
  export let data; // { user }
</script>

<div class="app">
  <Sidebar user={data.user} />
  <main class="content"><slot /></main>
</div>

<style>
  .app{display:flex;min-height:100vh}
  .content{flex:1;padding:16px}
</style>
