<script lang="ts">
  import {Editor} from "@welshman/editor"
  import {onDestroy} from "svelte"

  type Props = {
    editor: Promise<Editor>
  }

  const {editor}: Props = $props()

  const mountEditor = (node: HTMLElement) => {
    let active = true

    editor.then($editor => {
      if (!active) return

      $editor.setOptions({element: node})

      if ($editor.options.autofocus) {
        ;(node.querySelector("[contenteditable]") as HTMLElement | null)?.focus()
      }
    })

    return {
      destroy() {
        active = false
      },
    }
  }

  onDestroy(() => {
    editor.then($editor => $editor.destroy())
  })
</script>

<div use:mountEditor></div>
