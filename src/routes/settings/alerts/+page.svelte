<script lang="ts">
  import cx from "classnames"
  import {sleep} from "@welshman/lib"
  import {Capacitor} from "@capacitor/core"
  import {Badge} from "@capawesome/capacitor-badge"
  import {preventDefault} from "@lib/html"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import {pushToast} from "@app/util/toast"
  import {Push, clearBadges} from "@app/util/notifications"
  import {makeTitle} from "@app/util/title"
  import {notificationSettings} from "@app/core/state"

  const reset = () => {
    settings = {...notificationSettings.get()}
  }

  const onsubmit = preventDefault(async () => {
    loading = true

    try {
      if (!settings.badge) {
        clearBadges()
      }

      if (settings.push) {
        const permissions = await Push.request()

        if (permissions !== "granted") {
          await sleep(300)

          settings.push = false

          return pushToast({
            theme: "error",
            message: "Failed to request notification permissions.",
          })
        }
      }

      notificationSettings.set(settings)

      pushToast({message: "Your settings have been saved!"})
    } finally {
      loading = false
    }
  })

  let loading = $state(false)
  let settings = $state({...notificationSettings.get()})

  const pageTitle = makeTitle("Alert Settings")
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<form class="content column gap-4" {onsubmit}>
  <div class="card2 bg-alt col-4 shadow-md">
    <strong class="text-lg">Alert Settings</strong>
    {#await Badge.isSupported()}
      <!-- pass -->
    {:then { isSupported }}
      {#if isSupported}
        <div class="flex justify-between">
          <p>Show badge for unread alerts</p>
          <input type="checkbox" class="toggle toggle-primary" bind:checked={settings.badge} />
        </div>
      {/if}
    {/await}
    {#if !Capacitor.isNativePlatform()}
      <div class="flex justify-between">
        <p>Play sound for new activity</p>
        <input type="checkbox" class="toggle toggle-primary" bind:checked={settings.sound} />
      </div>
    {/if}
    <div class="flex justify-between">
      <p>Enable push notifications</p>
      <input type="checkbox" class="toggle toggle-primary" bind:checked={settings.push} />
    </div>
  </div>
  <div
    class={cx("card2 bg-alt col-4 shadow-md", {
      "pointer-events-none opacity-50": !settings.badge && !settings.sound && !settings.push,
    })}>
    <strong class="text-lg">Alert Types</strong>
    <div class="flex justify-between">
      <p>Notify me about new activity</p>
      <input type="checkbox" class="toggle toggle-primary" bind:checked={settings.spaces} />
    </div>
    <div class="flex justify-between">
      <p>Always notify me when mentioned</p>
      <input type="checkbox" class="toggle toggle-primary" checked={settings.mentions} />
    </div>
    <div class="flex justify-between">
      <p>Notify me about new messages</p>
      <input type="checkbox" class="toggle toggle-primary" bind:checked={settings.messages} />
    </div>
  </div>
  <div
    class="card2 bg-alt sticky -bottom-3 shadow-md flex flex-row items-center justify-between gap-4">
    <Button class="btn btn-neutral" onclick={reset} disabled={loading}>Discard Changes</Button>
    <Button type="submit" class="btn btn-primary" disabled={loading}>
      <Spinner {loading}>Save Changes</Spinner>
    </Button>
  </div>
</form>
