<script lang="ts">
  import {writable} from "svelte/store"
  import {makeEvent, CLASSIFIED} from "@welshman/util"
  import {publishThunk} from "@welshman/app"
  import {isMobile, preventDefault} from "@lib/html"
  import Paperclip from "@assets/icons/paperclip-2.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import {pushToast} from "@app/util/toast"
  import {PROTECTED} from "@app/core/state"
  import {makeEditor} from "@app/editor"
  import {canEnforceNip70} from "@app/core/commands"

  type Props = {
    url: string
    h?: string
  }

  const {url, h}: Props = $props()

  const shouldProtect = canEnforceNip70(url)

  const uploading = writable(false)

  const back = () => history.back()

  const selectFiles = () => editor.then(ed => ed.commands.selectFiles())

  const submit = async () => {
    if ($uploading) return

    if (!title) {
      return pushToast({
        theme: "error",
        message: "Please provide a title for your listing.",
      })
    }

    const ed = await editor
    const content = ed.getText({blockSeparator: "\n"}).trim()

    if (!content.trim()) {
      return pushToast({
        theme: "error",
        message: "Please provide a message for your listing.",
      })
    }

    const tags = [...ed.storage.nostr.getEditorTags(), ["title", title]]

    if (await shouldProtect) {
      tags.push(PROTECTED)
    }

    if (h) {
      tags.push(["h", h])
    }

    publishThunk({
      relays: [url],
      event: makeEvent(CLASSIFIED, {content, tags}),
    })

    history.back()
  }

  const editor = makeEditor({url, submit, uploading, placeholder: "What's on your mind?"})

  let title: string = $state("")
</script>

<Modal tag="form" onsubmit={preventDefault(submit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Create a Classified Listing</ModalTitle>
      <ModalSubtitle>Advertise a job, sale, or need.</ModalSubtitle>
    </ModalHeader>
    <div class="col-8 relative">
      <Field>
        {#snippet label()}
          <p>Title*</p>
        {/snippet}
        {#snippet input()}
          <label class="input input-bordered flex w-full items-center gap-2">
            <!-- svelte-ignore a11y_autofocus -->
            <input
              autofocus={!isMobile}
              bind:value={title}
              class="grow"
              type="text"
              placeholder="What is this listing for?" />
          </label>
        {/snippet}
      </Field>
      <Field>
        {#snippet label()}
          <p>Description*</p>
        {/snippet}
        {#snippet input()}
          <div class="note-editor flex-grow overflow-hidden">
            <EditorContent {editor} />
          </div>
        {/snippet}
      </Field>
      <Field>
        {#snippet label()}
          <p>Price*</p>
        {/snippet}
        {#snippet input()}
           todo: value and search select inline
        {/snippet}
      </Field>
      <Field>
        {#snippet label()}
          <p>Images</p>
        {/snippet}
        {#snippet input()}
           todo: attach multiple images
        {/snippet}
      </Field>
      <Button
        data-tip="Add an image"
        class="tooltip tooltip-left absolute bottom-1 right-2"
        onclick={selectFiles}>
        {#if $uploading}
          <span class="loading loading-spinner loading-xs"></span>
        {:else}
          <Icon icon={Paperclip} size={3} />
        {/if}
      </Button>
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary">Create Listing</Button>
  </ModalFooter>
</Modal>
