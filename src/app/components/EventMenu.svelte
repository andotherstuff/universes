<script lang="ts">
  import {onMount} from "svelte"
  import type {Snippet} from "svelte"
  import {goto} from "$app/navigation"
  import {resolve} from "$app/paths"
  import type {TrustedEvent} from "@welshman/util"
  import {parse, isLink} from "@welshman/content"
  import {COMMENT, ManagementMethod} from "@welshman/util"
  import {pubkey, repository, relaysByUrl, manageRelay} from "@welshman/app"
  import ShareCircle from "@assets/icons/share-circle.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import Download from "@assets/icons/download.svg?dataurl"
  import Danger from "@assets/icons/danger.svg?dataurl"
  import {setKey} from "@lib/implicit"
  import Button from "@lib/components/Button.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import Report from "@app/components/Report.svelte"
  import EventShare from "@app/components/EventShare.svelte"
  import EventDeleteConfirm from "@app/components/EventDeleteConfirm.svelte"
  import {hasNip29, deriveUserIsSpaceAdmin} from "@app/core/state"
  import {downloadLinkFile} from "@app/util/download"
  import {pushModal} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"
  import {makeSpaceChatPath} from "@app/util/routes"

  type Props = {
    url: string
    noun: string
    event: TrustedEvent
    onClick: () => void
    customActions?: Snippet
  }

  const {url, noun, event, onClick, customActions}: Props = $props()

  const isRoot = event.kind !== COMMENT
  const userIsAdmin = deriveUserIsSpaceAdmin(url)

  const hasFileExtension = (url: URL) => {
    const filename = url.pathname.split("/").pop()

    if (!filename) return false

    const dotIndex = filename.lastIndexOf(".")

    return dotIndex > 0 && dotIndex < filename.length - 1
  }

  const downloadTarget = $derived.by(() => {
    for (const parsed of parse(event)) {
      if (isLink(parsed) && hasFileExtension(parsed.value.url)) {
        return parsed.value.url.toString()
      }
    }

    return null
  })

  const report = () => pushModal(Report, {url, event})

  const showInfo = () => pushModal(EventInfo, {url, event})

  const download = async () => {
    if (!downloadTarget) return

    try {
      await downloadLinkFile({url: downloadTarget, event})
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download file"
      pushToast({theme: "error", message})
    }
  }

  const share = async () => {
    if (hasNip29($relaysByUrl.get(url))) {
      pushModal(EventShare, {url, event})
    } else {
      setKey("share", event)
      goto(resolve(makeSpaceChatPath(url)))
    }
  }

  const showDelete = () => pushModal(EventDeleteConfirm, {url, event})

  const showAdminDelete = () =>
    pushModal(Confirm, {
      title: `Delete ${noun}`,
      message: `Are you sure you want to delete this ${noun.toLowerCase()} from the space?`,
      confirm: async () => {
        const {error} = await manageRelay(url, {
          method: ManagementMethod.BanEvent,
          params: [event.id],
        })

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "Event has successfully been deleted!"})
          repository.removeEvent(event.id)
          history.back()
        }
      },
    })

  let ul: Element

  onMount(() => {
    ul.addEventListener("click", onClick)
  })
</script>

<ul class="menu whitespace-nowrap rounded-box bg-base-100 p-2 shadow-md" bind:this={ul}>
  {#if isRoot}
    <li>
      <Button onclick={share}>
        <Icon size={4} icon={ShareCircle} />
        Share to Chat
      </Button>
    </li>
  {/if}
  <li>
    <Button onclick={showInfo}>
      <Icon size={4} icon={Code2} />
      {noun} Details
    </Button>
  </li>
  {@render customActions?.()}
  {#if downloadTarget}
    <li>
      <Button onclick={download}>
        <Icon size={4} icon={Download} />
        Download
      </Button>
    </li>
  {/if}
  {#if event.pubkey === $pubkey}
    <li>
      <Button onclick={showDelete} class="text-error">
        <Icon size={4} icon={TrashBin2} />
        Delete {noun}
      </Button>
    </li>
  {:else}
    <li>
      <Button class="text-error" onclick={report}>
        <Icon size={4} icon={Danger} />
        Report Content
      </Button>
    </li>
    {#if $userIsAdmin}
      <li>
        <Button class="text-error" onclick={showAdminDelete}>
          <Icon size={4} icon={TrashBin2} />
          Delete {noun}
        </Button>
      </li>
    {/if}
  {/if}
</ul>
