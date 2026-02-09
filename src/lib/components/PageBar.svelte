<script lang="ts">
  import type {Snippet} from "svelte"
  import {displayRelayUrl} from "@welshman/util"
  import {page} from "$app/stores"
  import {decodeRelay} from "@app/core/state"

  interface Props {
    icon?: Snippet
    title?: Snippet
    action?: Snippet
    [key: string]: any
  }

  const {...props}: Props = $props()
</script>

<div data-component="PageBar" class="cw top-sai fixed z-nav p-2 {props.class}">
  <div class="rounded-xl bg-base-100 p-4 shadow-md h-20 md:h-12 flex flex-col justify-center">
    <div class="flex items-center justify-between gap-4">
      <div class="ellipsize flex items-center gap-4 whitespace-nowrap">
        {@render props.icon?.()}
        {@render props.title?.()}
      </div>
      {@render props.action?.()}
    </div>
    {#if $page.params.relay}
      <div class="text-xs text-primary md:hidden">
        {displayRelayUrl(decodeRelay($page.params.relay))}
      </div>
    {/if}
  </div>
</div>
