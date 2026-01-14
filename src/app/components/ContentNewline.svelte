<script lang="ts">
  const {value} = $props()
</script>

{#each value as _, i (i)}
  <br />
{/each}
