<script lang="ts">
  import Button from "@lib/components/Button.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import Profile from "@app/components/Profile.svelte"

  interface Props {
    title: any
    pubkeys: any
    subtitle?: string
    url?: string
  }

  const {subtitle = "", pubkeys, url, ...restProps}: Props = $props()
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>{restProps.title}</ModalTitle>
      <ModalSubtitle>{subtitle}</ModalSubtitle>
    </ModalHeader>
    {#each pubkeys as pubkey (pubkey)}
      <div class="card2 bg-alt">
        <Profile {pubkey} {url} />
      </div>
    {/each}
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-primary" onclick={() => history.back()}>Got it</Button>
  </ModalFooter>
</Modal>
