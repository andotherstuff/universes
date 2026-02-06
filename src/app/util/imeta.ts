import type {FileAttributes} from "@welshman/editor"
import {parse, isLink} from "@welshman/content"
import {uniqTags} from "@welshman/util"
import {pushToast} from "@app/util/toast"

const imetaByUrl = new Map<string, string[]>()
const imetaByHash = new Map<string, string[]>()
const MISSING_IMETA_MESSAGE =
  "Encrypted link missing metadata. Re-upload the file in this editor to share it."

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const extractHash = (value: string) => {
  try {
    const {pathname} = new URL(value)
    const match = pathname.match(/[a-f0-9]{64}/i)
    return match ? match[0].toLowerCase() : undefined
  } catch {
    return undefined
  }
}

const isLikelyFileUrl = (value: string) => {
  try {
    if (!value.startsWith("http")) return false
    return Boolean(extractHash(value))
  } catch {
    return false
  }
}

const buildImetaTag = (file: FileAttributes) => {
  const meta: Record<string, string> = {
    url: file.src,
    x: file.sha256,
    ox: file.sha256,
  }

  if (file.file?.type) {
    meta.m = file.file.type
  }

  if (file.file?.size) {
    meta.size = String(file.file.size)
  }

  if (file.file?.name) {
    meta.name = file.file.name
  }

  for (const [key, value] of file.tags || []) {
    if (key && value) {
      meta[key] = value
    }
  }

  return [
    "imeta",
    ...Object.entries(meta)
      .filter(([, value]) => value)
      .map(pair => pair.join(" "))
      .sort(),
  ]
}

export const recordImetaFromFiles = (files: FileAttributes[]) => {
  files
    .filter(file => file?.src && file?.sha256 && file?.file)
    .forEach(file => {
      const tag = buildImetaTag(file)
      const decoded = safeDecode(file.src)

      imetaByUrl.set(file.src, tag)
      imetaByUrl.set(decoded, tag)

      const hash = file.sha256 || extractHash(file.src)

      if (hash) {
        imetaByHash.set(hash, tag)
      }
    })
}

const findImetaTag = (url: string) => {
  const decoded = safeDecode(url)
  const hash = extractHash(url)

  return (
    imetaByUrl.get(url) || imetaByUrl.get(decoded) || (hash ? imetaByHash.get(hash) : undefined)
  )
}

export const collectImetaForContent = (content: string) => {
  const tags: string[][] = []
  const missing: string[] = []

  for (const token of parse({content})) {
    if (!isLink(token)) continue

    const url = token.value.url.toString()
    const tag = findImetaTag(url)

    if (tag) {
      tags.push(tag)
    } else if (isLikelyFileUrl(url)) {
      missing.push(url)
    }
  }

  return {tags: uniqTags(tags), missing}
}

export const mergeImetaTags = (content: string, tags: string[][]) => {
  const {tags: imetaTags, missing} = collectImetaForContent(content)

  return {
    tags: uniqTags([...tags, ...imetaTags]),
    missing,
  }
}

export const warnMissingImeta = (missing: string[]) => {
  if (missing.length === 0) return

  pushToast({
    theme: "error",
    message: MISSING_IMETA_MESSAGE,
  })
}
