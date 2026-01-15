<script lang="ts">
  import {slide} from "@lib/transition"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  interface Props {
    title?: import("svelte").Snippet
    description?: import("svelte").Snippet
    children?: import("svelte").Snippet
    [key: string]: any
  }

  const {...props}: Props = $props()

  const toggle = () => {
    isOpen = !isOpen
  }

  let isOpen = $state(false)
</script>

<div class="relative flex flex-col gap-4 {props.class}">
  <button
    type="button"
    class="relative flex w-full items-start p-4 text-left sm:-m-6 sm:p-6"
    aria-expanded={isOpen}
    onclick={toggle}>
    <div class="flex flex-col gap-2 pr-10">
      {@render props.title?.()}
      {@render props.description?.()}
    </div>
    <span
      class="absolute right-0 top-8 h-4 w-4 transition-all max-lg:right-3"
      class:rotate-90={!isOpen}>
      <Icon icon={AltArrowDown} />
    </span>
  </button>
  {#if isOpen}
    <div transition:slide>
      {@render props.children?.()}
    </div>
  {/if}
</div>
