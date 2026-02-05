<script lang="ts">
  import {page} from "$app/stores"
  import {goto} from "$app/navigation"
  import {decodeRelay} from "@app/core/state"
  import {makeSpacePath} from "@app/util/routes"
  import {makeTitle} from "@app/util/title"

  const url = decodeRelay($page.params.relay!)
  const pageTitle = makeTitle("Space")

  goto(makeSpacePath(url, "recent"))
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>
