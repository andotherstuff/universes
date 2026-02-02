<script lang="ts">
  import {displayUrl} from "@welshman/lib"
  import {preventDefault} from "@lib/html"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {pushToast} from "@app/util/toast"
  import {attemptRelayAccess} from "@app/core/commands"
  import {parseInviteLink} from "@app/core/state"

  type Props = {
    url: string
    callback: () => void
  }

  const {url, callback}: Props = $props()

  const back = () => history.back()

  const join = async () => {
    loading = true

    try {
      const claim = parseInviteLink(value)?.claim || value
      const message = await attemptRelayAccess(url, claim)

      if (message) {
        return pushToast({theme: "error", message, timeout: 30_000})
      }

      callback()
    } finally {
      loading = false
    }
  }

  let value = $state("")
  let loading = $state(false)
</script>

<Modal tag="form" onsubmit={preventDefault(join)}>
  <ModalBody>
    <ModalHeader>
      {#snippet title()}
        <div>Request Access</div>
      {/snippet}
      {#snippet info()}
        <div>Enter an invite code below to request access to {displayUrl(url)}.</div>
      {/snippet}
    </ModalHeader>
    <Field>
      {#snippet label()}
        <p>Invite code*</p>
      {/snippet}
      {#snippet input()}
        <label class="input input-bordered flex w-full items-center gap-2">
          <Icon icon={LinkRound} />
          <input bind:value class="grow" type="text" />
        </label>
      {/snippet}
    </Field>
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading}>
      <Spinner {loading}>Join Space</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
