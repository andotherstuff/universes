<script lang="ts">
  import {Invoice} from "@getalby/lightning-tools/bolt11"
  import {session} from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {errorMessage} from "@lib/util"
  import QRCode from "@app/components/QRCode.svelte"
  import {createInvoice} from "@app/core/commands"
  import {pushToast} from "@app/util/toast"

  const back = () => history.back()

  const create = async () => {
    if (!$session?.wallet) {
      pushToast({theme: "error", message: "Connect a wallet to create invoices."})
      return
    }

    loading = true

    try {
      const satAmount = Math.floor(Number(sats))
      const paymentRequest = await createInvoice({sats: satAmount})

      invoice = new Invoice({pr: paymentRequest})
      sats = invoice.satoshi && invoice.satoshi > 0 ? invoice.satoshi : satAmount

      pushToast({message: "Invoice created"})
    } catch (e) {
      console.warn(e)

      const message = errorMessage(e)

      pushToast({
        theme: "error",
        message: `Failed to create invoice: ${message}`,
      })
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
  let invoice: Invoice | undefined = $state()
  let sats = $state(10)

  const invoiceHasAmount = $derived((invoice?.satoshi ?? 0) > 0)
  const amountInvalid = $derived(!Number.isFinite(sats) || sats <= 0)
  const createDisabledReason = $derived(
    !$session?.wallet
      ? "Connect a wallet to create invoices."
      : amountInvalid
        ? "Enter an amount greater than 0."
        : "",
  )
  const createDisabled = $derived(loading || amountInvalid || !$session?.wallet)
  const showCreateTooltip = $derived(Boolean(createDisabledReason))
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Receive with Lightning</ModalTitle>
      <ModalSubtitle
        >Use your Nostr wallet to receive Bitcoin payments over lightning.</ModalSubtitle>
    </ModalHeader>
    {#if invoice}
      <div class="card2 bg-alt flex flex-col gap-2">
        {#if $session?.wallet?.type === "webln" && !invoiceHasAmount}
          <p class="text-sm opacity-75">
            Uh oh! It looks like your wallet returned an invoice without an amount. Some wallets
            can't pay those, so you may want to create a new invoice with a pre-set amount.
          </p>
        {:else}
          <div class="flex flex-col items-center gap-12 pt-4">
            <QRCode code={invoice.paymentRequest} class="h-64 w-64" />
            <p class="text-center text-sm opacity-75">Scan with your wallet, or click to copy.</p>
          </div>
          <FieldInline>
            {#snippet label()}
              Amount (satoshis)
            {/snippet}
            {#snippet input()}
              <div class="flex flex-grow justify-end">
                <label class="input input-bordered flex items-center gap-2">
                  <Icon icon={Bolt} />
                  <input bind:value={sats} type="number" class="w-14" disabled={invoiceHasAmount} />
                </label>
              </div>
            {/snippet}
            {#snippet info()}
              Share this invoice to receive <strong>{sats}</strong> satoshis
              {invoiceHasAmount ? "" : " (payer chooses the exact amount)"}.
            {/snippet}
          </FieldInline>
        {/if}
      </div>
    {:else}
      <div class="card2 bg-alt flex flex-col gap-2">
        <FieldInline>
          {#snippet label()}
            Amount (satoshis)
          {/snippet}
          {#snippet input()}
            <div class="flex flex-grow justify-end">
              <label class="input input-bordered flex items-center gap-2">
                <Icon icon={Bolt} />
                <input bind:value={sats} type="number" class="w-14" placeholder="0" />
              </label>
            </div>
          {/snippet}
        </FieldInline>
        <p class="text-sm opacity-75">Enter an amount to generate an invoice with your wallet.</p>
      </div>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    {#if !invoice}
      <div class="flex flex-col items-end gap-1">
        <div
          class:tooltip={showCreateTooltip}
          class:tooltip-left={showCreateTooltip}
          data-tip={showCreateTooltip ? createDisabledReason : undefined}>
          <Button class="btn btn-primary" onclick={create} disabled={createDisabled}>
            {#if loading}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              <Icon icon={Bolt} />
            {/if}
            Create Invoice
          </Button>
        </div>
      </div>
    {/if}
  </ModalFooter>
</Modal>
