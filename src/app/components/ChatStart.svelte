<script lang="ts">
  import * as nip19 from "nostr-tools/nip19"
  import {onMount} from "svelte"
  import {writable} from "svelte/store"
  import {goto} from "$app/navigation"
  import {tryCatch, uniq} from "@welshman/lib"
  import {fromNostrURI} from "@welshman/util"
  import {loadMessagingRelayList} from "@welshman/app"
  import {preventDefault} from "@lib/html"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ProfileMultiSelect from "@app/components/ProfileMultiSelect.svelte"
  import {makeChatPath} from "@app/util/routes"

  const back = () => history.back()

  const onSubmit = () => goto(makeChatPath(pubkeys))

  const addPubkey = (pubkey: string) => {
    pubkeys = uniq([...pubkeys, pubkey])
    term.set("")
  }

  const term = writable("")

  let pubkeys: string[] = $state([])

  $effect(() => {
    pubkeys.forEach(pubkey => loadMessagingRelayList(pubkey))
  })

  onMount(() => {
    return term.subscribe(t => {
      if (t.match(/^[0-9a-f]{64}$/)) {
        addPubkey(t)
      }

      if (t.match(/^(nostr:)?(npub1|nprofile1)/)) {
        tryCatch(() => {
          const {type, data} = nip19.decode(fromNostrURI(t))

          if (type === "npub") {
            addPubkey(data)
          }

          if (type === "nprofile") {
            addPubkey(data.pubkey)
          }
        })
      }
    })
  })
</script>

<Modal tag="form" onsubmit={preventDefault(onSubmit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Start a Chat</ModalTitle>
      <ModalSubtitle>Create an encrypted chat room for private conversations.</ModalSubtitle>
    </ModalHeader>
    <Field>
      {#snippet input()}
        <ProfileMultiSelect autofocus bind:value={pubkeys} {term} />
      {/snippet}
    </Field>
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={pubkeys.length === 0}>
      Create Chat
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
