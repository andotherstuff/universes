<script lang="ts">
  import {page} from "$app/stores"
  import {goto} from "$app/navigation"
  import Dialog from "@lib/components/Dialog.svelte"
  import SpaceInviteAccept from "@app/components/SpaceInviteAccept.svelte"
  import {makeTitle} from "@app/util/title"

  const children = {
    component: SpaceInviteAccept,
    props: {
      invite: $page.url.href,
      back: () => goto("/home"),
    },
  }

  const pageTitle = makeTitle("Join Space")
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<Dialog {children} />
