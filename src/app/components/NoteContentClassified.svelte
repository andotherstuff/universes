<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {getTag, getTagValue, getTagValues} from "@welshman/util"
  import CurrencySymbol from "@lib/components/CurrencySymbol.svelte"
  import Content from "@app/components/Content.svelte"
  import ContentLinkBlock from "@app/components/ContentLinkBlock.svelte"

  const props: ComponentProps<typeof Content> = $props()

  const title = getTagValue("title", props.event.tags)
  const images = getTagValues("image", props.event.tags)
  const [_, price = 0, currency = "SAT"] = getTag("price", props.event.tags) || []
</script>

<div class="flex flex-col gap-2">
  {#if title}
    <p class="text-xl">
      {title} —
      <CurrencySymbol code={currency} />{price}
    </p>
  {/if}
  {#if props.event.content}
    <Content {...props} />
  {/if}
  <div class="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9">
    {#each images as image (image)}
      <ContentLinkBlock event={props.event} value={{url: image}} />
    {/each}
  </div>
</div>
