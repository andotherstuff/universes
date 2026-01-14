<script lang="ts">
  import {page} from "$app/stores"
  import {goto} from "$app/navigation"
  import {resolve} from "$app/paths"
  import {decodeRelay} from "@app/core/state"
  import {makeSpacePath} from "@app/util/routes"

  const url = decodeRelay($page.params.relay!)

  goto(resolve(makeSpacePath(url, "recent")))
</script>
