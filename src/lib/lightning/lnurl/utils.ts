import {bytesToHex, sha256Bytes, utf8ToBytes} from "../core"
import type {
  Event,
  KeySendRawData,
  KeysendResponse,
  LnUrlPayResponse,
  LnUrlRawData,
  LUD18ServicePayerData,
  NostrResponse,
  ZapArgs,
  ZapOptions,
} from "./types"

const TAG_KEYSEND = "keysend"
const TAG_PAY_REQUEST = "payRequest"

export const parseKeysendResponse = (data: KeySendRawData): KeysendResponse => {
  if (data.tag !== TAG_KEYSEND) throw new Error("Invalid keysend params")
  if (data.status !== "OK") throw new Error("Keysend status not OK")
  if (!data.pubkey) throw new Error("Pubkey does not exist")

  const destination = data.pubkey
  const firstCustom = data.customData?.[0]

  return {
    destination,
    customKey: firstCustom?.customKey,
    customValue: firstCustom?.customValue,
  }
}

export const generateZapEvent = async (
  {satoshi, comment, p, e, relays}: ZapArgs,
  options: ZapOptions = {},
): Promise<Event> => {
  const nostr = options.nostr ?? (globalThis as {nostr?: ZapOptions["nostr"]}).nostr
  if (!nostr) {
    throw new Error("nostr option or window.nostr is not available")
  }

  const tags = [
    ["relays", ...relays],
    ["amount", satoshi.toString()],
  ]
  if (p) tags.push(["p", p])
  if (e) tags.push(["e", e])

  const pubkey = await nostr.getPublicKey()
  const event: Event = {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 9734,
    tags,
    content: comment ?? "",
  }

  event.id = getEventHash(event)
  return await nostr.signEvent(event as Event & {pubkey: string; id: string})
}

export const validateEvent = (event: Event): boolean => {
  if (typeof event.content !== "string") return false
  if (typeof event.created_at !== "number") return false
  if (!Array.isArray(event.tags)) return false

  for (const tag of event.tags) {
    if (!Array.isArray(tag)) return false
    for (const value of tag) {
      if (typeof value === "object") return false
    }
  }

  return true
}

export const serializeEvent = (event: Event): string => {
  if (!validateEvent(event)) {
    throw new Error("can't serialize event with wrong or missing properties")
  }

  return JSON.stringify([0, event.pubkey, event.created_at, event.kind, event.tags, event.content])
}

export const getEventHash = (event: Event): string => {
  const payload = utf8ToBytes(serializeEvent(event))
  return bytesToHex(sha256Bytes(payload))
}

export const parseNostrResponse = (nostrData: NostrResponse, username: string | undefined) => {
  let nostrPubkey: string | undefined
  let nostrRelays: string[] | undefined
  if (username && nostrData) {
    nostrPubkey = nostrData.names?.[username]
    nostrRelays = nostrPubkey ? nostrData.relays?.[nostrPubkey] : undefined
  }

  return [nostrData, nostrPubkey, nostrRelays] as const
}

const URL_REGEX =
  /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)((?:\/[+~%/.\w-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[\w]*))?)/

export const isUrl = (url: string | null): url is string => {
  if (!url) return false
  return URL_REGEX.test(url)
}

export const isValidAmount = ({amount, min, max}: {amount: number; min: number; max: number}) =>
  amount > 0 && amount >= min && amount <= max

export const parseLnUrlPayResponse = async (data: LnUrlRawData): Promise<LnUrlPayResponse> => {
  if (data.tag !== TAG_PAY_REQUEST) {
    throw new Error("Invalid pay service params")
  }

  const callback = (data.callback + "").trim()
  if (!isUrl(callback)) throw new Error("Callback must be a valid url")

  const min = Math.ceil(Number(data.minSendable || 0))
  const max = Math.floor(Number(data.maxSendable))
  if (!(min && max) || min > max) throw new Error("Invalid pay service params")

  let metadata: Array<Array<string>>
  let metadataHash: string
  try {
    metadata = JSON.parse(data.metadata + "") as Array<Array<string>>
    metadataHash = bytesToHex(sha256Bytes(utf8ToBytes(data.metadata + "")))
  } catch {
    metadata = []
    metadataHash = bytesToHex(sha256Bytes(utf8ToBytes("[]")))
  }

  let email = ""
  let image = ""
  let description = ""
  let identifier = ""
  for (const entry of metadata) {
    const [key, value] = entry
    switch (key) {
      case "text/plain":
        description = value
        break
      case "text/identifier":
        identifier = value
        break
      case "text/email":
        email = value
        break
      case "image/png;base64":
      case "image/jpeg;base64":
        image = "data:" + key + "," + value
        break
    }
  }

  const payerData = data.payerData as LUD18ServicePayerData | undefined

  let domain: string | undefined
  try {
    domain = new URL(callback).hostname
  } catch {
    domain = undefined
  }

  return {
    callback,
    fixed: min === max,
    min,
    max,
    domain,
    metadata,
    metadataHash,
    identifier,
    email,
    description,
    image,
    payerData,
    commentAllowed: Number(data.commentAllowed) || 0,
    rawData: data,
    allowsNostr: data.allowsNostr || false,
  }
}
