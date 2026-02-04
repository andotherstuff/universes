<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {EVENT_TIME, ZAP_GOAL, THREAD, CLASSIFIED} from "@welshman/util"
  import NoteContentEventTime from "@app/components/NoteContentEventTime.svelte"
  import NoteContentThread from "@app/components/NoteContentThread.svelte"
  import NoteContentClassified from "@app/components/NoteContentClassified.svelte"
  import NoteContentGoal from "@app/components/NoteContentGoal.svelte"
  import Content from "@app/components/Content.svelte"

  const props: ComponentProps<typeof Content> = $props()
</script>

{#key props.event.id}
  {#if props.event.kind === EVENT_TIME}
    <NoteContentEventTime {...props} />
  {:else if props.event.kind === THREAD}
    <NoteContentThread {...props} />
  {:else if props.event.kind === CLASSIFIED}
    <NoteContentClassified {...props} />
  {:else if props.event.kind === ZAP_GOAL}
    <NoteContentGoal {...props} />
  {:else}
    <Content {...props} />
  {/if}
{/key}
