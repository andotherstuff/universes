<script lang="ts">
  import {page} from "$app/stores"
  import {goto} from "$app/navigation"
  import {resolve} from "$app/paths"
  import {displayRelayUrl} from "@welshman/util"
  import {decodeRelay} from "@app/core/state"
  import {makeSpacePath} from "@app/util/routes"
  import {makeTitle} from "@app/util/title"

  const url = decodeRelay($page.params.relay!)
  const pageTitle = makeTitle("Space", displayRelayUrl(url))

  goto(resolve(makeSpacePath(url, "recent")))
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>
