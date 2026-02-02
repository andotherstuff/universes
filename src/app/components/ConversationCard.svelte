<script lang="ts">
  import {goto} from "$app/navigation"
  import {formatTimestamp} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import ChatRoundDots from "@assets/icons/chat-round-dots.svg?dataurl"
  import Reply from "@assets/icons/reply.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import NoteContentMinimal from "@app/components/NoteContentMinimal.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import RoomNameWithImage from "@app/components/RoomNameWithImage.svelte"
  import {makeRoomPath, makeSpaceChatPath} from "@app/util/routes"

  type Props = {
    url: string
    h?: string
    latest: TrustedEvent
    count: number
  }

  const {url, h, latest, count}: Props = $props()

  const navigateToRoom = () => {
    goto(h ? makeRoomPath(url, h) : makeSpaceChatPath(url))
  }

  const handleReplyClick = (e: Event) => {
    e.stopPropagation()
    navigateToRoom()
  }
</script>

<Button class="card2 bg-alt shadow-md" onclick={navigateToRoom}>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-2 text-sm">
      {#if h}
        <RoomNameWithImage {url} {h} class="font-semibold" />
      {:else}
        <Icon icon={ChatRoundDots} class="h-6 w-6 opacity-50" />
        <span class="truncate font-semibold">Chat</span>
      {/if}
      <span class="ml-auto text-nowrap opacity-50">
        {formatTimestamp(latest.created_at)}
      </span>
    </div>
    <div class="flex items-start gap-3">
      <ProfileCircle pubkey={latest.pubkey} size={10} />
      <div class="min-w-0 flex-1">
        <NoteContentMinimal event={latest} />
      </div>
    </div>
    <div class="flex items-center justify-between gap-2 text-xs">
      <span class="opacity-50">
        {count}
        {count === 1 ? "message" : "messages"} this week
      </span>
      <Button class="btn btn-sm btn-primary" onclick={handleReplyClick}>
        <Icon icon={Reply} />
        Reply
      </Button>
    </div>
  </div>
</Button>
