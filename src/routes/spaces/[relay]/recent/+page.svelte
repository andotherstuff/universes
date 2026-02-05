<script lang="ts">
  import {onMount} from "svelte"
  import {derived} from "svelte/store"
  import {page} from "$app/stores"
  import {groupBy, ago, MONTH, first, sortBy, uniqBy} from "@welshman/lib"
  import {
    MESSAGE,
    THREAD,
    CLASSIFIED,
    ZAP_GOAL,
    EVENT_TIME,
    COMMENT,
    getTagValue,
    getTagValues,
    getIdAndAddress,
  } from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {repository} from "@welshman/app"
  import History from "@assets/icons/history.svg?dataurl"
  import {createScroller} from "@lib/html"
  import Icon from "@lib/components/Icon.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import SpaceMenuButton from "@app/components/SpaceMenuButton.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import ThreadItem from "@app/components/ThreadItem.svelte"
  import ClassifiedItem from "@app/components/ClassifiedItem.svelte"
  import GoalItem from "@app/components/GoalItem.svelte"
  import CalendarEventItem from "@app/components/CalendarEventItem.svelte"
  import RecentConversation from "@app/components/RecentConversation.svelte"
  import {decodeRelay, deriveEventsForUrl, CONTENT_KINDS} from "@app/core/state"
  import {makeTitle} from "@app/util/title"

  const url = decodeRelay($page.params.relay!)
  const since = ago(MONTH)

  const messages = deriveEventsForUrl(url, [{kinds: [MESSAGE], since}])
  const content = deriveEventsForUrl(url, [{kinds: CONTENT_KINDS, since}])
  const comments = deriveEventsForUrl(url, [{kinds: [COMMENT], since}])
  const pageTitle = makeTitle("Recent Activity")

  const recentActivity = derived(
    [messages, content, comments],
    ([$messages, $content, $comments]) => {
      const activity: Array<{
        type: "message" | "content"
        event: TrustedEvent
        count: number
        timestamp: number
      }> = []

      const byRoom = groupBy(e => getTagValue("h", e.tags), $messages)
      for (const roomMessages of byRoom.values()) {
        const latest = first(roomMessages)
        if (latest) {
          activity.push({
            type: "message",
            event: latest,
            count: roomMessages.length,
            timestamp: latest.created_at,
          })
        }
      }

      const latestActivityByKey = new Map<string, number>()

      for (const event of $content) {
        for (const k of getIdAndAddress(event)) {
          latestActivityByKey.set(k, Math.max(latestActivityByKey.get(k) || 0, event.created_at))
        }
      }

      for (const event of $comments) {
        for (const k of getTagValues(["E", "A"], event.tags)) {
          latestActivityByKey.set(k, Math.max(latestActivityByKey.get(k) || 0, event.created_at))
        }
      }

      for (const [address, timestamp] of latestActivityByKey.entries()) {
        const event = repository.getEvent(address)

        if (event) {
          activity.push({type: "content", event, timestamp, count: 1})
        }
      }

      return sortBy(
        a => -a.timestamp,
        uniqBy(a => a.event.id, activity),
      )
    },
  )

  let limit = $state(20)
  let element: Element | undefined = $state()

  onMount(() => {
    const scroller = createScroller({
      element: element!,
      onScroll: () => {
        limit += 10
      },
    })

    return () => scroller.stop()
  })
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<PageBar>
  {#snippet icon()}
    <div class="center">
      <Icon icon={History} />
    </div>
  {/snippet}
  {#snippet title()}
    <strong>Recent Activity</strong>
  {/snippet}
  {#snippet action()}
    <div class="row-2">
      <SpaceMenuButton {url} />
    </div>
  {/snippet}
</PageBar>

<div bind:this={element}>
  <PageContent class="flex flex-col gap-2 p-2 pt-4">
    {#if $recentActivity.length === 0}
      <p class="flex flex-col items-center py-20 text-center">No recent activity found!</p>
    {:else}
      {#each $recentActivity.slice(0, limit) as { type, event, count = 0 } (event.id)}
        {#if type === "message"}
          <RecentConversation {url} {event} {count} />
        {:else if event.kind === THREAD}
          <ThreadItem {url} {event} />
        {:else if event.kind === CLASSIFIED}
          <ClassifiedItem {url} {event} />
        {:else if event.kind === ZAP_GOAL}
          <GoalItem {url} {event} />
        {:else if event.kind === EVENT_TIME}
          <CalendarEventItem {url} {event} />
        {:else}
          <NoteItem {url} {event} />
        {/if}
      {/each}
    {/if}
  </PageContent>
</div>
