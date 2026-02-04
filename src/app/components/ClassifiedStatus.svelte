<script lang="ts">
  import cx from "classnames"
  import type {TrustedEvent} from "@welshman/util"
  import {getTagValue} from "@welshman/util"
  import {ucFirst} from "@lib/util"

  type Props = {
    event: TrustedEvent
  }

  const {event}: Props = $props()

  const status = getTagValue("status", event.tags)
</script>

{#if status}
  <div class={cx("btn btn-xs rounded-full", {"btn-primary": status !== "active"})}>
    {ucFirst(status)}
  </div>
{/if}
