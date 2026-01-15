import {
  getBlob,
  getTagValue,
  getTags,
  decryptFile,
  tagsFromIMeta,
  makeBlossomAuthEvent,
} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {signer} from "@welshman/app"
import {downloadBlob} from "@lib/html"

type DownloadLinkFileOptions = {
  url: string
  event: TrustedEvent
}

const decodePath = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const guessFilename = (url: string, meta: string[][], hash?: string) => {
  const tagName = getTagValue("name", meta) || getTagValue("filename", meta)

  if (tagName) {
    return tagName
  }

  const path = decodePath(new URL(url).pathname)
  const candidate = path.split("/").pop()

  if (candidate) {
    return candidate
  }

  if (hash) {
    return `download-${hash}`
  }

  return "download"
}

export const downloadLinkFile = async ({url, event}: DownloadLinkFileOptions) => {
  const meta =
    getTags("imeta", event.tags)
      .map(tagsFromIMeta)
      .find(tags => getTagValue("url", tags) === url) || event.tags

  const hash = getTagValue("x", meta)
  const key = getTagValue("decryption-key", meta)
  const nonce = getTagValue("decryption-nonce", meta)
  const algorithm = getTagValue("encryption-algorithm", meta)
  const $signer = signer.get()

  let response: Response | undefined

  if (hash && $signer) {
    const server = new URL(url).origin
    const template = makeBlossomAuthEvent({action: "get", server, hashes: [hash]})
    const authEvent = await $signer.sign(template)

    response = await getBlob(server, hash, {authEvent})
  }

  if (!response?.ok) {
    response = await fetch(url)
  }

  if (!response.ok) {
    throw new Error(`Failed to download file (HTTP ${response.status})`)
  }

  let data = new Uint8Array(await response.arrayBuffer())

  if (algorithm === "aes-gcm" && key && nonce) {
    const decrypted = await decryptFile({ciphertext: data, key, nonce, algorithm})
    data = new Uint8Array(decrypted)
  }

  const filename = guessFilename(url, meta, hash)
  const contentType = getTagValue("type", meta) || response.headers.get("content-type")
  const blob = new Blob([data], {type: contentType || "application/octet-stream"})

  downloadBlob(filename, blob)
}
