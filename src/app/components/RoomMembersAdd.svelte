<script lang="ts">
  import {onMount} from "svelte"
  import {setKey, popKey} from "@lib/implicit"
  import {sleep} from "@welshman/lib"
  import {ManagementMethod} from "@welshman/util"
  import {manageRelay} from "@welshman/app"
  import {addRoomMember, displayProfileByPubkey, waitForThunkError} from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import ProfileMultiSelect from "@app/components/ProfileMultiSelect.svelte"
  import {pushToast} from "@app/util/toast"
  import {pushModal} from "@app/util/modal"
  import {deriveRoom, deriveSpaceMembers} from "@app/core/state"

  interface Props {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  const room = deriveRoom(url, h)
  const spaceMembers = deriveSpaceMembers(url)

  const back = () => history.back()

  const addMembers = async () => {
    loading = true

    try {
      // Show loading for auto submit callback
      await sleep(500)

      const results = await Promise.all(
        pubkeys
          .filter(pubkey => !$spaceMembers.includes(pubkey))
          .map(pubkey =>
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

      const errors = await Promise.all(
        pubkeys.map(pubkey => waitForThunkError(addRoomMember(url, $room, pubkey))),
      )

      for (const error of errors) {
        if (error) {
          return pushToast({theme: "error", message: errors[0]})
        }
      }

      pushToast({message: "Members have successfully been added!"})
      back()
    } finally {
      loading = false
    }
  }

  const onSubmit = async () => {
    const pubkeysSnapshot = $state.snapshot(pubkeys)
    const nonSpaceMembers = pubkeysSnapshot.filter(pubkey => !$spaceMembers.includes(pubkey))

    if (nonSpaceMembers.length > 0) {
      setKey("RoomMembersAdd.pubkeys", pubkeysSnapshot)

      pushModal(Confirm, {
        title: "New Space Members",
        subtitle: "Automatically add members to space",
        message:
          nonSpaceMembers.length === 1
            ? `${displayProfileByPubkey(nonSpaceMembers[0])} is not a member of this space. Add them?`
            : `${nonSpaceMembers.length} people are not members of this space. Add them?`,
        confirm: async () => {
          setKey("RoomMembersAdd.confirm", true)
          back()
        },
      })
    } else {
      addMembers()
    }
  }

  let loading = $state(false)
  let pubkeys: string[] = $state(popKey("RoomMembersAdd.pubkeys") || [])

  onMount(() => {
    if (popKey("RoomMembersAdd.confirm")) {
      addMembers()
    }
  })
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Add Members</ModalTitle>
      <ModalSubtitle>to <RoomName {url} {h} class="text-primary" /></ModalSubtitle>
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
    <Button class="btn btn-primary" onclick={onSubmit} disabled={loading}>
      <Spinner {loading}>Save changes</Spinner>
    </Button>
  </ModalFooter>
</Modal>
