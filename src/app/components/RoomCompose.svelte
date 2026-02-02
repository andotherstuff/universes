<script lang="ts">
  import type {Instance} from "tippy.js"
  import {writable} from "svelte/store"
  import {once} from "@welshman/lib"
  import type {EventContent} from "@welshman/util"
  import {isMobile, preventDefault} from "@lib/html"
  import GallerySend from "@assets/icons/gallery-send.svg?dataurl"
  import WidgetAdd from "@assets/icons/widget-add.svg?dataurl"
  import Plane from "@assets/icons/plane-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import ComposeMenu from "@app/components/ComposeMenu.svelte"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import {makeEditor} from "@app/editor"
  import {onDestroy, onMount} from "svelte"

  type Props = {
    url?: string
    h?: string
    content?: string
    onEscape?: () => void
    onEditPrevious?: () => void
    onSubmit: (event: EventContent) => void
  }

  const {url, h, content, onEscape, onEditPrevious, onSubmit}: Props = $props()

  const autofocus = !isMobile

  const uploading = writable(false)

  export const focus = () => editor.then(ed => ed.chain().focus().run())

  export const canEnterEditPrevious = () =>
    editor.then(ed => ed.getText({blockSeparator: "\n"}) === "")

  const handleKeyDown = async (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      onEscape?.()
    }

    if (event.key === "ArrowUp" && (await canEnterEditPrevious())) {
      onEditPrevious?.()
    }
  }

  const uploadFiles = () =>
    // TODO: go back to the following command after PR is released
    // https://github.com/cesardeazevedo/nostr-editor/pull/37
    // editor.then(ed => ed.chain().selectFiles().run())
    editor.then(ed => {
      const input = document.createElement("input")

      input.type = "file"
      input.multiple = true
      input.accept = "image/jpeg,image/png,image/gif,video/mp4,video/mpeg,video/webm"
      input.style.display = "none"

      const cleanup = () => {
        input.removeEventListener("change", handleFiles)
        input.removeEventListener("input", handleFiles)
        input.removeEventListener("cancel", cleanup)

        if (input.parentNode) {
          input.parentNode.removeChild(input)
        }
      }

      const handleFiles = once((event: Event) => {
        const files = (event.target as HTMLInputElement).files

        if (files) {
          Array.from(files).forEach(file => {
            if (file) {
              ed.commands.addFile(file, ed.view.state.selection.from + 1)
            }
          })
        }

        cleanup()
      })

      // Add both change and input listeners for iOS compatibility
      input.addEventListener("change", handleFiles)
      input.addEventListener("input", handleFiles)
      input.addEventListener("cancel", cleanup)

      // Attach to DOM for iOS compatibility
      document.body.appendChild(input)

      // Small delay for iOS WebView
      setTimeout(() => {
        input.click()
      }, 100)
    })

  const showPopover = () => popover?.show()

  const hidePopover = () => popover?.hide()

  const submit = async () => {
    if ($uploading) return

    const ed = await editor
    const content = ed.getText({blockSeparator: "\n"}).trim()
    const tags = ed.storage.nostr.getEditorTags()

    if (!content) return

    onSubmit({content, tags})

    ed.chain().clearContent().run()
  }

  const editor = makeEditor({url, content, autofocus, submit, uploading, aggressive: true})

  let popover: Instance | undefined = $state()

  onMount(async () => {
    const ed = await editor
    ed.view.dom.addEventListener("keydown", handleKeyDown)
  })

  onDestroy(async () => {
    const ed = await editor
    ed?.view?.dom.removeEventListener("keydown", handleKeyDown)
  })
</script>

<form class="relative flex gap-2 p-2" onsubmit={preventDefault(submit)}>
  <div class="join">
    <Button
      data-tip="Add an image"
      class="center join-item tooltip tooltip-right h-10 w-10 min-w-10 rounded-full border border-solid border-base-200 bg-base-300"
      disabled={$uploading}
      onclick={uploadFiles}>
      {#if $uploading}
        <span class="loading loading-spinner loading-xs"></span>
      {:else}
        <Icon icon={GallerySend} />
      {/if}
    </Button>
    <Tippy
      bind:popover
      component={ComposeMenu}
      props={{url, h, onClick: hidePopover}}
      params={{trigger: "manual", interactive: true}}>
      <Button
        data-tip="More options"
        class="center join-item tooltip tooltip-right h-10 w-10 min-w-10 rounded-full border border-solid border-base-200 bg-base-300"
        disabled={$uploading}
        onclick={showPopover}>
        <Icon icon={WidgetAdd} />
      </Button>
    </Tippy>
  </div>
  <div class="chat-editor flex-grow overflow-hidden">
    <EditorContent {editor} />
  </div>
  <Button
    data-tip="{window.navigator.platform.includes('Mac') ? 'cmd' : 'ctrl'}+enter to send"
    class="center tooltip tooltip-left absolute right-4 h-10 w-10 min-w-10 rounded-full"
    disabled={$uploading}
    onclick={submit}>
    <Icon icon={Plane} />
  </Button>
</form>
