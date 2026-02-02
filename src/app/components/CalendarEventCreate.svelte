<script lang="ts">
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import CalendarEventForm from "@app/components/CalendarEventForm.svelte"

  type Props = {
    url: string
    h?: string
  }

  const {url, h}: Props = $props()
</script>

<CalendarEventForm {url} {h}>
  {#snippet header()}
    <ModalHeader>
      <ModalTitle>Create an Event</ModalTitle>
      <ModalSubtitle>Invite other group members to events online or in real life.</ModalSubtitle>
    </ModalHeader>
  {/snippet}
</CalendarEventForm>
