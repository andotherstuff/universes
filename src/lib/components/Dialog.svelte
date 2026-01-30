<script lang="ts">
  import type {Component} from "svelte"
  import cx from "classnames"
  import {onMount} from "svelte"
  import {noop} from "@welshman/lib"
  import {fade, fly} from "@lib/transition"

  type Props = {
    onClose?: any
    fullscreen?: boolean
    children: {
      component: Component<any>
      props: Record<string, any>
    }
  }

  const {onClose = noop, fullscreen = false, children}: Props = $props()

  const wrapperClass = $derived(
    cx("absolute inset-0 flex sm:relative pointer-events-none", {
      "items-center justify-center": fullscreen,
      "items-end sm:w-[520px] sm:items-center": !fullscreen,
    }),
  )

  const innerClass = $derived(
    cx(
      "relative text-base-content text-base-content flex-grow pointer-events-auto",
      "rounded-t-box sm:rounded-box",
      {
        "bg-alt shadow-m max-h-[90vh] flex flex-col": !fullscreen,
      },
    ),
  )
</script>

<div class="center fixed inset-0 z-modal">
  <button
    type="button"
    aria-label="Close dialog"
    class="absolute inset-0 cursor-pointer bg-[#ccc] opacity-75 dark:bg-black"
    transition:fade={{duration: 300}}
    onclick={onClose}>
  </button>
  <div class={wrapperClass}>
    <div class={innerClass} transition:fly={{duration: 300}}>
      <children.component {...children.props} />
    </div>
  </div>
</div>
