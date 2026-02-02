<script lang="ts">
  import type {Snippet} from "svelte"

  interface Props {
    children: Snippet
  }

  const {children}: Props = $props()
</script>

<h1 class="heading">{@render children()}</h1>
