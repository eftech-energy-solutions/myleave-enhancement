<script>
  import Sidebar from '$lib/components/Sidebar.svelte'; // the “normal” sidebar
  import { page } from '$app/stores';
  export let data;
  $: pathname = $page.url.pathname;
</script>

<div class="container">
  <aside class="aside">
    <Sidebar user={data.user} pathname={pathname} />
  </aside>
  <main class="main dash-main">
    <div class="container-inner"><slot /></div>
  </main>
</div>
