<script lang="ts">
  import {onMount} from "svelte"
  import {goto} from "$app/navigation"
  import {resolve} from "$app/paths"
  import {goToSpace} from "@app/util/routes"
  import {makeTitle} from "@app/util/title"
  import {PLATFORM_RELAYS} from "@app/core/state"

  onMount(async () => {
    if (PLATFORM_RELAYS.length > 0) {
      goToSpace(PLATFORM_RELAYS[0])
    } else {
      goto(resolve("/home"))
    }
  })
</script>

<svelte:head>
  <title>{makeTitle("Redirecting")}</title>
</svelte:head>
