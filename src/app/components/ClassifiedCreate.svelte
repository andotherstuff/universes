<script lang="ts">
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ClassifiedForm from "@app/components/ClassifiedForm.svelte"

  type Props = {
    url: string
    h?: string
  }

  const {url, h}: Props = $props()
</script>

<ClassifiedForm {url} {h}>
  {#snippet header()}
    <ModalHeader>
      <ModalTitle>Create a Classified Listing</ModalTitle>
      <ModalSubtitle>Advertise a job, sale, or need.</ModalSubtitle>
    </ModalHeader>
  {/snippet}
</ClassifiedForm>
