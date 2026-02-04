<script lang="ts">
  import type {Snippet} from "svelte"
  import type {TrustedEvent} from "@welshman/util"
  import {PublishStatus} from "@welshman/net"
  import {deriveIsDeleted} from "@welshman/store"
  import {thunks, mergeThunks, thunkHasStatus, repository} from "@welshman/app"
  import ThunkStatus from "@app/components/ThunkStatus.svelte"

  type Props = {
    event: TrustedEvent
    children?: Snippet
  }

  const {event, children}: Props = $props()

  const deleted = deriveIsDeleted(repository, event)
  const thunk = $derived(mergeThunks($thunks.filter(t => t.event.id === event.id)))
</script>

{#if $deleted}
  <div class="btn btn-error btn-xs rounded-full">Deleted</div>
{:else if thunk.thunks.length > 0 && !thunkHasStatus(PublishStatus.Success, thunk)}
  <ThunkStatus {thunk} />
{:else if children}
  {@render children?.()}
{/if}
