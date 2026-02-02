<script lang="ts">
  import {displayRelayUrl, ManagementMethod} from "@welshman/util"
  import {manageRelay} from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ProfileMultiSelect from "@app/components/ProfileMultiSelect.svelte"
  import {pushToast} from "@app/util/toast"

  interface Props {
    url: string
  }

  const {url}: Props = $props()

  const back = () => history.back()

  const addMember = async () => {
    loading = true

    try {
      const results = await Promise.all(
        pubkeys.map(pubkey =>
          manageRelay(url, {
            method: ManagementMethod.AllowPubkey,
            params: [pubkey],
          }),
        ),
      )

      for (const {error} of results) {
        if (error) {
          return pushToast({theme: "error", message: error})
        }
      }

      pushToast({message: "Members have successfully been added!"})
      back()
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
  let pubkeys: string[] = $state([])
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Add Members</ModalTitle>
      <ModalSubtitle>to {displayRelayUrl(url)}</ModalSubtitle>
    </ModalHeader>
    <Field>
      {#snippet label()}
        <p>Search for People</p>
      {/snippet}
      {#snippet input()}
        <ProfileMultiSelect bind:value={pubkeys} />
      {/snippet}
    </Field>
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="btn btn-primary" onclick={addMember} disabled={loading}>
      <Spinner {loading}>Save changes</Spinner>
    </Button>
  </ModalFooter>
</Modal>
