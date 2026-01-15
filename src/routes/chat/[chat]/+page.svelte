<script lang="ts">
  import {page} from "$app/stores"
  import type {MakeNonOptional} from "@welshman/lib"
  import {append, uniq} from "@welshman/lib"
  import {displayPubkey} from "@welshman/util"
  import {pubkey} from "@welshman/app"
  import Chat from "@app/components/Chat.svelte"
  import {notifications, setChecked} from "@app/util/notifications"
  import {makeTitle} from "@app/util/title"
  import {splitChatId} from "@app/core/state"

  const {chat} = $page.params as MakeNonOptional<typeof $page.params>
  const pubkeys = $derived(uniq(append($pubkey!, splitChatId(chat))))
  const others = $derived(pubkeys.filter(pk => pk !== $pubkey!))

  const pageTitle = $derived.by(() => {
    if (others.length === 1) {
      return makeTitle(`Chat with ${displayPubkey(others[0])}`)
    }

    if (others.length > 1) {
      return makeTitle(`Group chat (${others.length})`)
    }

    return makeTitle("Chat")
  })

  // We have to watch this one, since on mobile the badge will be visible when active
  $effect(() => {
    if ($notifications.has($page.url.pathname)) {
      setChecked($page.url.pathname)
    }
  })
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<Chat {pubkeys} />
