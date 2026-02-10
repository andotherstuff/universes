<script lang="ts">
  import {type Instance} from "tippy.js"
  import {between, throttle} from "@welshman/lib"
  import {isMobile} from "@lib/html"
  import Button from "@lib/components/Button.svelte"
  import Dialog from "@lib/components/Dialog.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import IconPicker from "@app/components/IconPicker.svelte"
  import IconPickerDialog from "@app/components/IconPickerDialog.svelte"

  const {...props} = $props()

  const open = () => {
    if (isMobile) {
      showIconPicker = true
    } else {
      popover?.show()
    }
  }

  const close = () => {
    if (isMobile) {
      showIconPicker = false
    } else {
      popover?.hide()
    }
  }

  const onClick = (iconUrl: string) => {
    props.onSelect(iconUrl)
    close()
  }

  const onMouseMove = throttle(300, ({clientX, clientY}: any) => {
    if (popover) {
      const {x, width} = popover.popper.getBoundingClientRect()

      if (!between([x - 50, x + width + 50], clientX)) {
        popover.hide()
      }
    }
  })

  let showIconPicker = $state(false)
  let popover: Instance | undefined = $state()
</script>

<svelte:document onmousemove={onMouseMove} />

<Tippy
  bind:popover
  component={IconPickerDialog}
  props={{onSelect: onClick}}
  params={{trigger: "manual", interactive: true, placement: "top-end"}}>
  <Button onclick={open} class={props.class}>
    {@render props.children?.()}
  </Button>
</Tippy>

{#if showIconPicker}
  <Dialog
    onClose={close}
    children={{
      component: IconPicker,
      props: {
        onSelect: onClick,
      },
    }} />
{/if}
