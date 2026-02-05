<script lang="ts">
  import {onMount} from "svelte"
  import {goto} from "$app/navigation"
  import {goToSpace} from "@app/util/routes"
  import {makeTitle} from "@app/util/title"
  import {PLATFORM_RELAYS} from "@app/core/state"

  const pageTitle = makeTitle("Redirecting")

  onMount(async () => {
    if (PLATFORM_RELAYS.length > 0) {
      goToSpace(PLATFORM_RELAYS[0])
    } else {
      goto("/home")
    }
  })
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>
