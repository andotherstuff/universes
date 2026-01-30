<script lang="ts">
  import {page} from "$app/stores"
  import {goto} from "$app/navigation"
  import Dialog from "@lib/components/Dialog.svelte"
  import SpaceInviteAccept from "@app/components/SpaceInviteAccept.svelte"

  const children = {
    component: SpaceInviteAccept,
    props: {
      invite: $page.url.href,
      back: () => goto("/home"),
    },
  }
</script>

<Dialog {children} />
