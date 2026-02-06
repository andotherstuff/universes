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

const openInNewTab = (url: string, filename?: string) => {
  const a = document.createElement("a")

  a.href = url
  a.target = "_blank"
  a.rel = "noopener"
  if (filename) {
    a.download = filename
  }
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
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

  const fallbackFilename = getTagValue("name", meta) || getTagValue("filename", meta)
  const fallback = () => openInNewTab(url, fallbackFilename)

  try {
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

    if (!response.ok || response.type === "opaque") {
      fallback()
      return
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
  } catch {
    fallback()
  }
}
