<script lang="ts">
  import {parse, isLink} from "@welshman/content"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Download from "@assets/icons/download.svg?dataurl"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import ChatMessageEmojiButton from "@app/components/ChatMessageEmojiButton.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import {downloadLinkFile} from "@app/util/download"
  import {pushModal} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"

  const {event, pubkeys, popover, replyTo} = $props()

  const reply = () => replyTo(event)

  const hasFileExtension = (url: URL) => {
    const filename = url.pathname.split("/").pop()

    if (!filename) return false

    const dotIndex = filename.lastIndexOf(".")

    return dotIndex > 0 && dotIndex < filename.length - 1
  }

  const downloadTarget = $derived.by(() => {
    for (const parsed of parse(event)) {
      if (isLink(parsed) && hasFileExtension(parsed.value.url)) {
        return parsed.value.url.toString()
      }
    }

    return undefined
  })

  const showInfo = () => {
    popover.hide()
    pushModal(EventInfo, {event})
  }

  const download = async () => {
    if (!downloadTarget) return

    popover.hide()

    try {
      await downloadLinkFile({url: downloadTarget, event})
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download file"
      pushToast({theme: "error", message})
    }
  }
</script>

<div class="join border border-solid border-neutral text-xs">
  <ChatMessageEmojiButton {event} {pubkeys} />
  {#if replyTo}
    <Button class="btn join-item btn-xs" onclick={reply}>
      <Icon size={4} icon={Reply} />
    </Button>
  {/if}
  {#if downloadTarget}
    <Button class="btn join-item btn-xs" onclick={download}>
      <Icon size={4} icon={Download} />
    </Button>
  {/if}
  <Button class="btn join-item btn-xs" onclick={showInfo}>
    <Icon size={4} icon={Code2} />
  </Button>
</div>
