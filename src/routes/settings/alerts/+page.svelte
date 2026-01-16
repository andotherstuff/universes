<script lang="ts">
  import Alerts from "@app/components/Alerts.svelte"
  import {makeTitle} from "@app/util/title"
</script>

<svelte:head>
  <title>{makeTitle("Settings", "Alerts")}</title>
</svelte:head>

<div class="content column">
  <Alerts />
</div>
