<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {getTagValue} from "@welshman/util"
  import Content from "@app/components/Content.svelte"

  const props: ComponentProps<typeof Content> = $props()

  const title = getTagValue("title", props.event.tags)
</script>

<div class="flex flex-col gap-2">
  {#if title}
    <p class="text-xl">{title}</p>
  {/if}
  {#if props.event.content}
    <Content {...props} />
  {/if}
</div>
