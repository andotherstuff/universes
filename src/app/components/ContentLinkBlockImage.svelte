<script lang="ts">
  import {onMount, onDestroy} from "svelte"
  import {displayUrl} from "@welshman/lib"
  import {
    getTags,
    getBlob,
    decryptFile,
    getTagValue,
    tagsFromIMeta,
    makeBlossomAuthEvent,
  } from "@welshman/util"
  import {signer} from "@welshman/app"
  import {downloadLinkFile} from "@app/util/download"
  import {pushToast} from "@app/util/toast"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import {preventDefault, stopPropagation} from "svelte/legacy"

  const {value, event, ...props} = $props()

  const url = value.url.toString()
  const meta =
    getTags("imeta", event.tags)
      .map(tagsFromIMeta)
      .find(meta => getTagValue("url", meta) === url) || event.tags

  const hash = getTagValue("x", meta)
  const key = getTagValue("decryption-key", meta)
  const nonce = getTagValue("decryption-nonce", meta)
  const algorithm = getTagValue("encryption-algorithm", meta)

  const download = async () => {
    try {
      await downloadLinkFile({url, event})
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download file"
      pushToast({theme: "error", message})
    }
  }

  const onError = async () => {
    // If the image failed to load, try authenticating
    if (hash && $signer) {
      const server = new URL(url).origin
      const template = makeBlossomAuthEvent({action: "get", server, hashes: [hash]})
      const authEvent = await $signer.sign(template)
      const res = await getBlob(server, hash, {authEvent})

      if (res.status === 200) {
        src = URL.createObjectURL(await res.blob())
      } else {
        hasError = true
      }
    } else {
      hasError = true
    }
  }

  let hasError = $state(false)
  let src = $state("")

  onMount(async () => {
    // If we have an encryption algorithm, fetch and decrypt
    if (algorithm === "aes-gcm" && key && nonce) {
      const response = await fetch(url)

      if (response.ok) {
        const ciphertext = new Uint8Array(await response.arrayBuffer())
        const decryptedData = await decryptFile({ciphertext, key, nonce, algorithm})

        src = URL.createObjectURL(new Blob([new Uint8Array(decryptedData)]))
      }
    } else {
      src = url
    }
  })

  onDestroy(() => {
    URL.revokeObjectURL(src)
  })
</script>

{#if hasError}
  <div class="flex flex-wrap items-center gap-2">
    <a
      href={url}
      rel="external"
      class="link-content whitespace-nowrap"
      onclick={e => {
        e.stopPropagation()
      }}>
      <Icon icon={LinkRound} size={3} class="inline-block" />
      {displayUrl(url)}
    </a>
    <button
      type="button"
      class="btn btn-neutral btn-xs"
      onclick={stopPropagation(preventDefault(download))}>
      Download
    </button>
  </div>
{:else if src}
  <img alt="" {src} onerror={onError} {...props} />
{/if}
