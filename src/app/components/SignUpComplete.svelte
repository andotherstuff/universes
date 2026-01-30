<script lang="ts">
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import HomeSmile from "@assets/icons/home-smile.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"

  type Props = {
    next: () => void
  }

  const {next}: Props = $props()

  const back = () => history.back()
</script>

<Modal tag="form" onsubmit={preventDefault(next)}>
  <ModalBody>
    <ModalHeader>
      {#snippet title()}
        <div>You're all set!</div>
      {/snippet}
    </ModalHeader>
    <p>
      You've created your profile, saved your keys, and now you're ready to start chatting — all
      without asking permission!
    </p>
    <p>
      From your dashboard, you can use invite links, discover community spaces, and keep up-to-date
      on groups you've already joined. Click below to get started!
    </p>
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="btn btn-primary" type="submit">
      <Icon icon={HomeSmile} />
      Go to Dashboard
    </Button>
  </ModalFooter>
</Modal>
