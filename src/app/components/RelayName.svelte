<script lang="ts">
  import {deriveRelayDisplay} from "@welshman/app"

  type Props = {
    url: string
    class?: string
  }

  const {url, ...props}: Props = $props()

  const display = $derived(deriveRelayDisplay(url))
</script>

<span class={props.class}>
  {$display}
</span>
