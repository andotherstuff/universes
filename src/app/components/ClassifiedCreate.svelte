<script lang="ts">
  import {makeEvent, CLASSIFIED} from "@welshman/util"
  import {publishThunk} from "@welshman/app"
  import {isMobile, preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ImagesInput from "@lib/components/ImagesInput.svelte"
  import CurrencyInput from "@app/components/CurrencyInput.svelte"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import {pushToast} from "@app/util/toast"
  import {PROTECTED} from "@app/core/state"
  import {makeEditor} from "@app/editor"
  import {canEnforceNip70, uploadFile} from "@app/core/commands"

  type Props = {
    url: string
    h?: string
  }

  const {url, h}: Props = $props()

  const shouldProtect = canEnforceNip70(url)

  const back = () => history.back()

  const submit = async () => {
    loading = true

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
        message: "Please provide a description for your listing.",
      })
    }

    const tags = [...ed.storage.nostr.getEditorTags(), ["summary", content], ["title", title]]

    try {
      if (await shouldProtect) {
        tags.push(PROTECTED)
      }

      if (h) {
        tags.push(["h", h])
      }

      for (const image of images) {
        if (typeof image === "string") {
          tags.push(["image", image])
        } else {
          const {result, error} = await uploadFile(image, {url})

          if (error) {
            return pushToast({
              theme: "error",
              message: `Failed to upload file ${image.name}`,
            })
          }

          if (result) {
            tags.push(["image", result.url])
          }
        }
      }

      publishThunk({
        relays: [url],
        event: makeEvent(CLASSIFIED, {content, tags}),
      })

      history.back()
    } finally {
      loading = false
    }
  }

  const editor = makeEditor({
    url,
    submit,
    placeholder: "Provide a detailed description for your listing.",
  })

  let title = $state("")
  let loading = $state(false)
  let currencyCode = $state("SAT")
  let currencyAmount = $state(0)
  let images = $state<(string | File)[]>([])
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
          <div class="join grid grid-cols-2">
            <label class="join-item input input-bordered flex w-full items-center gap-2">
              <input bind:value={currencyAmount} class="grow w-32" type="number" />
            </label>
            <CurrencyInput class="join-item" bind:value={currencyCode} />
          </div>
        {/snippet}
      </Field>
      <Field>
        {#snippet label()}
          <p>Images (optional)</p>
        {/snippet}
        {#snippet input()}
          <ImagesInput bind:value={images} />
        {/snippet}
      </Field>
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading}>
      <Spinner {loading}>Create Listing</Spinner>
    </Button>
  </ModalFooter>
</Modal>
