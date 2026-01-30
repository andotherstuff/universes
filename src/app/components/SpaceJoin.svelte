<script lang="ts">
  import {onMount} from "svelte"
  import {goto} from "$app/navigation"
  import {sleep, dissoc} from "@welshman/lib"
  import {Pool, AuthStatus, SocketStatus} from "@welshman/net"
  import {deriveRelay} from "@welshman/app"
  import {displayRelayUrl} from "@welshman/util"
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import DangerTriangle from "@assets/icons/danger-triangle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import StatusIndicator from "@lib/components/StatusIndicator.svelte"
  import RelaySummary from "@app/components/RelaySummary.svelte"
  import SocketStatusIndicator from "@app/components/SocketStatusIndicator.svelte"
  import SpaceAccessRequest from "@app/components/SpaceAccessRequest.svelte"
  import {
    attemptRelayAccess,
    addSpaceMembership,
    broadcastUserData,
    setSpaceNotifications,
  } from "@app/core/commands"
  import {relaysMostlyRestricted, deriveSpaceMembers, notificationSettings} from "@app/core/state"
  import {pushModal} from "@app/util/modal"
  import {pushToast} from "@app/util/toast"
  import {makeSpacePath} from "@app/util/routes"
  import {Push} from "@app/util/notifications"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const relay = deriveRelay(url)
  const members = deriveSpaceMembers(url)

  const back = () => history.back()

  const join = async () => {
    if (error) {
      return pushModal(SpaceAccessRequest, {url, callback: back})
    }

    loading = true

    try {
      if (notifications) {
        if (!notificationSettings.get().push) {
          await setSpaceNotifications(url, true)
        } else {
          const permissions = await Push.request()

          if (permissions === "granted") {
            await setSpaceNotifications(url, true)
          }
        }
      } else {
        await setSpaceNotifications(url, false)
      }

      await addSpaceMembership(url)
      await goto(makeSpacePath(url), {replaceState: true})

      broadcastUserData([url])
      relaysMostlyRestricted.update(dissoc(url))
      pushToast({message: "Welcome to the space!"})
    } catch (e) {
      console.error("Failed to join space:", e)
      pushToast({theme: "error", message: "Failed to join space. Please try again."})
    } finally {
      loading = false
    }
  }

  let error: string | undefined = $state()
  let loading = $state(true)
  let notifications = $state(true)

  onMount(async () => {
    error = await attemptRelayAccess(url)
    loading = false
  })
</script>

<Modal tag="form" onsubmit={preventDefault(join)}>
  <ModalBody>
    <RelaySummary {url} />
    <div class="card2 card2-sm bg-alt">
      <div class="flex justify-between gap-12">
        <div class="col-1">
          <strong>Enable notifications for this space</strong>
          <p class="text-xs opacity-75">
            Get notified about new activity in this space. You can change this later in settings.
          </p>
        </div>
        <input type="checkbox" class="toggle toggle-primary" bind:checked={notifications} />
      </div>
    </div>
    <div class="card2 card2-sm bg-alt flex flex-col gap-2">
      <div class="flex justify-between">
        <strong>Connection Status</strong>
        {#if error}
          <StatusIndicator class="bg-error">Error</StatusIndicator>
        {:else}
          <SocketStatusIndicator {url} />
        {/if}
      </div>
      {#if error}
        <div class="flex items-center gap-2">
          <Icon icon={DangerTriangle} />
          <p class="text-sm opacity-75">{error}</p>
        </div>
      {/if}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="btn btn-primary" disabled={loading}>
      <Spinner {loading}>
        {error ? "Request Access" : "Join Space"}
      </Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
