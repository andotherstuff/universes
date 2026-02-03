<script lang="ts">
  import {onMount} from "svelte"
  import CalendarMinimalistic from "@assets/icons/calendar-minimalistic.svg?dataurl"
  import StarFallMinimalistic from "@assets/icons/star-fall-minimalistic.svg?dataurl"
  import NotesMinimalistic from "@assets/icons/notes-minimalistic.svg?dataurl"
  import CaseMinimalistic from "@assets/icons/case-minimalistic.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import {pushModal} from "@app/util/modal"
  import CalendarEventCreate from "@app/components/CalendarEventCreate.svelte"
  import ThreadCreate from "@app/components/ThreadCreate.svelte"
  import ClassifiedCreate from "@app/components/ClassifiedCreate.svelte"
  import GoalCreate from "@app/components/GoalCreate.svelte"

  type Props = {
    url: string
    onClick: () => void
    h?: string
  }

  const {url, h, onClick}: Props = $props()

  const createGoal = () => pushModal(GoalCreate, {url, h})

  const createCalendarEvent = () => pushModal(CalendarEventCreate, {url, h})

  const createThread = () => pushModal(ThreadCreate, {url, h})

  const createClassified = () => pushModal(ClassifiedCreate, {url, h})

  let ul: Element

  onMount(() => {
    ul.addEventListener("click", onClick)
  })
</script>

<ul class="menu whitespace-nowrap rounded-box bg-base-100 p-2 shadow-md" bind:this={ul}>
  <li>
    <Button onclick={createGoal}>
      <Icon size={4} icon={StarFallMinimalistic} />
      Funding Goal
    </Button>
  </li>
  <li>
    <Button onclick={createCalendarEvent}>
      <Icon size={4} icon={CalendarMinimalistic} />
      Calendar Event
    </Button>
  </li>
  <li>
    <Button onclick={createClassified}>
      <Icon size={4} icon={CaseMinimalistic} />
      Classified Listing
    </Button>
  </li>
  <li>
    <Button onclick={createThread}>
      <Icon size={4} icon={NotesMinimalistic} />
      Create Thread
    </Button>
  </li>
</ul>
