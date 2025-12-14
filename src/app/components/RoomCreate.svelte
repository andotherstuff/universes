<script lang="ts">
  import {goto} from "$app/navigation"
<<<<<<< HEAD
  import type {RoomMeta} from "@welshman/util"
  import {displayRelayUrl} from "@welshman/util"
=======
  import {displayRelayUrl, makeRoomMeta} from "@welshman/util"
  import {deriveRelay, waitForThunkError, createRoom, editRoom, joinRoom} from "@welshman/app"
  import StickerSmileSquare from "@assets/icons/sticker-smile-square.svg?dataurl"
  import Hashtag from "@assets/icons/hashtag.svg?dataurl"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
>>>>>>> ac46870 (Add Turborepo build graph and tooling, switch `@welshman` deps to `workspace:*`, refactor application to match the latest `@welshman` APIs)
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RoomForm from "@app/components/RoomForm.svelte"
  import {makeSpacePath} from "@app/util/routes"

  const {url} = $props()

  const back = () => history.back()

<<<<<<< HEAD
  const onsubmit = (room: RoomMeta) => goto(makeSpacePath(url, room.h))
=======
  const tryCreate = async () => {
    room.name = name
    room.picture = undefined
    room.pictureMeta = undefined

    if (imageFile) {
      const {error, result} = await uploadFile(imageFile)

      if (error) {
        return pushToast({theme: "error", message: error})
      }

      room.picture = result.url
      room.pictureMeta = result.tags
    } else if (selectedIcon) {
      room.picture = selectedIcon
    }

    const createMessage = await waitForThunkError(createRoom(url, room))

    if (createMessage && !createMessage.match(/^duplicate:|already a member/)) {
      return pushToast({theme: "error", message: createMessage})
    }

    const editMessage = await waitForThunkError(editRoom(url, room))

    if (editMessage) {
      return pushToast({theme: "error", message: editMessage})
    }

    const joinMessage = await waitForThunkError(joinRoom(url, room))

    if (joinMessage && !joinMessage.includes("already")) {
      return pushToast({theme: "error", message: joinMessage})
    }

    await loadChannel(url, room.h)

    goto(makeSpacePath(url, room.h))
  }

  const create = async () => {
    loading = true

    try {
      await tryCreate()
    } finally {
      loading = false
    }
  }

  let name = $state("")
  let loading = $state(false)
  let imageFile = $state<File | undefined>()
  let imagePreview = $state<string | undefined>()
  let selectedIcon = $state<string | undefined>()

  const handleImageUpload = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0]

    if (file && file.type.startsWith("image/")) {
      selectedIcon = undefined
      imageFile = await compressFile(file, {maxWidth: 64, maxHeight: 64})

      const reader = new FileReader()

      reader.onload = e => {
        imagePreview = e.target?.result as string
      }

      reader.readAsDataURL(imageFile)
    }
  }

  const handleIconSelect = (iconUrl: string) => {
    imageFile = undefined
    imagePreview = undefined
    selectedIcon = iconUrl
  }
>>>>>>> ac46870 (Add Turborepo build graph and tooling, switch `@welshman` deps to `workspace:*`, refactor application to match the latest `@welshman` APIs)
</script>

<RoomForm {url} {onsubmit}>
  {#snippet header()}
    <ModalHeader>
      {#snippet title()}
        <div>Create a Room</div>
      {/snippet}
      {#snippet info()}
        <div>
          On <span class="text-primary">{displayRelayUrl(url)}</span>
        </div>
      {/snippet}
    </ModalHeader>
  {/snippet}
  {#snippet footer({loading})}
    <ModalFooter>
      <Button class="btn btn-link" onclick={back}>
        <Icon icon={AltArrowLeft} />
        Go back
      </Button>
      <Button type="submit" class="btn btn-primary" disabled={loading}>
        <Spinner {loading}>Create Room</Spinner>
        <Icon icon={AltArrowRight} />
      </Button>
    </ModalFooter>
  {/snippet}
</RoomForm>
