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

      const container = $editor.options.element as HTMLElement | undefined

      if (container) {
        node.replaceChildren(container)
      }

      if ($editor.options.autofocus) {
        ;($editor.view.dom as HTMLElement | null)?.focus()
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
