<script>
  import LeaveApprovals from "./LeaveApprovals.svelte";

  // 'true' => embed (slide-out panel) mode
  export let compact = false;
</script>

<LeaveApprovals role="director" {compact} />