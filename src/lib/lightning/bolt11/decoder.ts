import {bytesToHex, bytesToUtf8} from "../core"
import {bech32Decode, convertBits} from "./bech32"
import {parseHrpAmount} from "./amount"

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
const SIGNATURE_WORDS = 104

export type DecodedInvoice = {
  paymentHash: string
  satoshi: number
  timestamp: number
  expiry: number | undefined
  description: string | undefined
}

type TagResult = {
  paymentHash?: string
  description?: string
  expiry?: number
}

const wordsToNumber = (words: number[]) => words.reduce((acc, word) => acc * 32 + word, 0)

const decodeTagData = (tag: string, words: number[]) => {
  if (tag === "p") {
    const bytes = Uint8Array.from(convertBits(words, 5, 8, false))
    return {paymentHash: bytesToHex(bytes)}
  }
  if (tag === "d") {
    const bytes = Uint8Array.from(convertBits(words, 5, 8, false))
    return {description: bytesToUtf8(bytes)}
  }
  if (tag === "x") {
    return {expiry: wordsToNumber(words)}
  }
  return {}
}

const decodeTags = (words: number[]) => {
  const dataEnd = words.length - SIGNATURE_WORDS
  if (dataEnd < 7) {
    throw new Error("Invalid bolt11 data length")
  }

  const timestamp = wordsToNumber(words.slice(0, 7))
  const tagResult: TagResult = {}

  let index = 7
  while (index < dataEnd) {
    const tagValue = words[index]
    const tag = CHARSET[tagValue]
    index += 1

    if (!tag) {
      throw new Error("Invalid bolt11 tag")
    }

    const dataLength = (words[index] << 5) + words[index + 1]
    index += 2

    const tagWords = words.slice(index, index + dataLength)
    index += dataLength

    Object.assign(tagResult, decodeTagData(tag, tagWords))
  }

  return {timestamp, tagResult}
}

export const decodeInvoice = (invoice: string): DecodedInvoice | null => {
  if (!invoice) return null

  try {
    const {hrp, words} = bech32Decode(invoice)
    const amount = parseHrpAmount(hrp)
    const {timestamp, tagResult} = decodeTags(words)

    if (!tagResult.paymentHash) {
      return null
    }

    return {
      paymentHash: tagResult.paymentHash,
      satoshi: amount?.satoshi ?? 0,
      timestamp,
      expiry: tagResult.expiry,
      description: tagResult.description,
    }
  } catch {
    return null
  }
}
