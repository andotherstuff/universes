<script lang="ts">
  import type {Snippet} from "svelte"

  interface Props {
    children: Snippet
  }

  const {children}: Props = $props()
</script>

<p class="text-center text-sm opacity-75">{@render children()}</p>
