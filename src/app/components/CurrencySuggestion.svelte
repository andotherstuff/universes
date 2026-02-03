<script lang="ts">
  import {displayCurrencyByCode} from "@lib/currency"

  type Props = {
    value: string
  }

  const {value}: Props = $props()
</script>

{displayCurrencyByCode(value)}
