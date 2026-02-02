<script lang="ts">
  import {onMount} from "svelte"
  import {derived} from "svelte/store"
  import {page} from "$app/stores"
  import {groupBy, ago, WEEK, first, sortBy, now} from "@welshman/lib"
  import {MESSAGE, THREAD, ZAP_GOAL, EVENT_TIME, COMMENT, getTagValue} from "@welshman/util"
  import History from "@assets/icons/history.svg?dataurl"
  import Add from "@assets/icons/add.svg?dataurl"
  import {createScroller} from "@lib/html"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageBar from "@lib/components/PageBar.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import SpaceMenuButton from "@app/components/SpaceMenuButton.svelte"
  import ConversationCard from "@app/components/ConversationCard.svelte"
  import ThreadCard from "@app/components/ThreadCard.svelte"
  import GoalCard from "@app/components/GoalCard.svelte"
  import CalendarEventCard from "@app/components/CalendarEventCard.svelte"
  import CommentCard from "@app/components/CommentCard.svelte"
  import {decodeRelay, deriveEventsForUrl} from "@app/core/state"
  import {goToSpace} from "@app/util/routes"

  const url = decodeRelay($page.params.relay!)
  const since = ago(WEEK)
  const currentTime = now()

  const messages = deriveEventsForUrl(url, [{kinds: [MESSAGE], since}])
  const threads = deriveEventsForUrl(url, [{kinds: [THREAD], since}])
  const goals = deriveEventsForUrl(url, [{kinds: [ZAP_GOAL], since}])
  const events = deriveEventsForUrl(url, [{kinds: [EVENT_TIME]}])
  const comments = deriveEventsForUrl(url, [{kinds: [COMMENT], since}])

  const recentActivity = derived(
    [messages, threads, goals, events, comments],
    ([$messages, $threads, $goals, $events, $comments]) => {
      const activity: Array<{
        type: "message" | "thread" | "goal" | "event" | "upcoming" | "comment"
        event: any
        timestamp: number
        h?: string
        latest?: any
        count?: number
        replyCount?: number
      }> = []

      const byRoom = groupBy(e => getTagValue("h", e.tags), $messages)
      for (const [h, roomMessages] of byRoom.entries()) {
        const latest = first(roomMessages)
        if (latest) {
          activity.push({
            type: "message",
            event: latest,
            timestamp: latest.created_at,
            h,
            latest,
            count: roomMessages.length,
          })
        }
      }

      for (const thread of $threads) {
        const replies = $comments.filter(c => getTagValue("E", c.tags) === thread.id)
        activity.push({
          type: "thread",
          event: thread,
          timestamp: thread.created_at,
          h: getTagValue("h", thread.tags),
          replyCount: replies.length,
        })
      }

      for (const goal of $goals) {
        const replies = $comments.filter(c => getTagValue("E", c.tags) === goal.id)
        activity.push({
          type: "goal",
          event: goal,
          timestamp: goal.created_at,
          h: getTagValue("h", goal.tags),
          replyCount: replies.length,
        })
      }

      const pastEvents = $events.filter(e => {
        const start = getTagValue("start", e.tags)
        return start && parseInt(start) < currentTime
      })
      for (const event of pastEvents.slice(0, 5)) {
        const replies = $comments.filter(c => getTagValue("E", c.tags) === event.id)
        activity.push({
          type: "event",
          event,
          timestamp: event.created_at,
          h: getTagValue("h", event.tags),
          replyCount: replies.length,
        })
      }

      const upcomingEvents = $events.filter(e => {
        const start = getTagValue("start", e.tags)
        return start && parseInt(start) >= currentTime
      })
      for (const event of upcomingEvents.slice(0, 3)) {
        const replies = $comments.filter(c => getTagValue("E", c.tags) === event.id)
        const start = getTagValue("start", event.tags)
        activity.push({
          type: "upcoming",
          event,
          timestamp: start ? parseInt(start) : event.created_at,
          h: getTagValue("h", event.tags),
          replyCount: replies.length,
        })
      }

      for (const comment of $comments) {
        activity.push({
          type: "comment",
          event: comment,
          timestamp: comment.created_at,
          h: getTagValue("h", comment.tags),
        })
      }

      return sortBy(a => -a.timestamp, activity)
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
      <div class="flex flex-col items-center gap-4 py-12 text-center">
        <Icon icon={History} class="h-16 w-16 opacity-30" />
        <div class="flex flex-col gap-2">
          <h3 class="text-lg font-semibold">No Recent Activity</h3>
          <p class="opacity-70">There hasn't been any activity in the last week.</p>
        </div>
        <div class="flex flex-col gap-2">
          <Button class="btn-primary" onclick={() => goToSpace(url)}>
            <Icon icon={Add} />
            Browse Rooms
          </Button>
        </div>
      </div>
    {:else}
      {#each $recentActivity.slice(0, limit) as activity (activity.event.id)}
        {#if activity.type === "message"}
          <ConversationCard
            {url}
            h={activity.h}
            latest={activity.latest}
            count={activity.count || 0} />
        {:else if activity.type === "thread"}
          <ThreadCard {url} event={activity.event} replyCount={activity.replyCount || 0} />
        {:else if activity.type === "goal"}
          <GoalCard {url} event={activity.event} replyCount={activity.replyCount || 0} />
        {:else if activity.type === "event" || activity.type === "upcoming"}
          <CalendarEventCard {url} event={activity.event} replyCount={activity.replyCount || 0} />
        {:else if activity.type === "comment"}
          <CommentCard {url} event={activity.event} />
        {/if}
      {/each}
    {/if}
  </PageContent>
</div>
