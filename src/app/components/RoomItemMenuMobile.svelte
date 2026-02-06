<script lang="ts">
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import {parse, isLink} from "@welshman/content"
  import type {TrustedEvent} from "@welshman/util"
  import {pubkey} from "@welshman/app"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Download from "@assets/icons/download.svg?dataurl"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Link from "@lib/components/Link.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import EmojiPicker from "@lib/components/EmojiPicker.svelte"
  import ZapButton from "@app/components/ZapButton.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import EventDeleteConfirm from "@app/components/EventDeleteConfirm.svelte"
  import {ENABLE_ZAPS} from "@app/core/state"
  import {publishReaction, canEnforceNip70} from "@app/core/commands"
  import {downloadLinkFile} from "@app/util/download"
  import {getRoomItemPath} from "@app/util/routes"
  import {pushModal} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"

  type Props = {
    url: string
    event: TrustedEvent
    reply: () => void
  }

  const {url, event, reply}: Props = $props()

  const path = getRoomItemPath(url, event)

  const shouldProtect = canEnforceNip70(url)

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

  const onEmoji = (async (event: TrustedEvent, url: string, emoji: NativeEmoji) => {
    history.back()
    publishReaction({
      event,
      relays: [url],
      content: emoji.unicode,
      protect: await shouldProtect,
    })
  }).bind(undefined, event, url)

  const showEmojiPicker = () => pushModal(EmojiPicker, {onClick: onEmoji}, {replaceState: true})

  const sendReply = () => {
    history.back()
    reply()
  }

  const showInfo = () => pushModal(EventInfo, {url, event}, {replaceState: true})

  const showDelete = () => pushModal(EventDeleteConfirm, {url, event})

  const download = async () => {
    if (!downloadTarget) return

    history.back()

    try {
      await downloadLinkFile({url: downloadTarget, event})
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download file"
      pushToast({theme: "error", message})
    }
  }
</script>

<div class="flex flex-col gap-2">
  {#if event.pubkey === $pubkey}
    <Button class="btn btn-neutral text-error" onclick={showDelete}>
      <Icon size={4} icon={TrashBin2} />
      Delete Message
    </Button>
  {/if}
  <Button class="btn btn-neutral" onclick={showInfo}>
    <Icon size={4} icon={Code2} />
    Message Info
  </Button>
  {#if downloadTarget}
    <Button class="btn btn-neutral" onclick={download}>
      <Icon size={4} icon={Download} />
      Download
    </Button>
  {/if}
  {#if path}
    <Link class="btn btn-neutral" href={path}>
      <Icon size={4} icon={MenuDots} />
      View Details
    </Link>
  {/if}
  {#if ENABLE_ZAPS}
    <ZapButton replaceState {url} {event} class="btn btn-neutral w-full">
      <Icon size={4} icon={Bolt} />
      Send Zap
    </ZapButton>
  {/if}
  <Button class="btn btn-neutral w-full" onclick={sendReply}>
    <Icon size={4} icon={Reply} />
    Send Reply
  </Button>
  <Button class="btn btn-neutral w-full" onclick={showEmojiPicker}>
    <Icon size={4} icon={SmileCircle} />
    Send Reaction
  </Button>
</div>
