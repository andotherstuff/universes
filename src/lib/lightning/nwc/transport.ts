import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip04,
  nip19,
  nip44,
  type Event,
  type EventTemplate,
} from "nostr-tools"
import {bytesToHex, hexToBytes} from "@noble/hashes/utils.js"
import type {Nip47EncryptionType} from "./types"

export const normalizeSecretKey = (secret?: string) => {
  if (!secret) return undefined
  if (secret.toLowerCase().startsWith("nsec")) {
    const decoded = nip19.decode(secret).data
    if (decoded instanceof Uint8Array) {
      return bytesToHex(decoded)
    }
    if (typeof decoded === "string") {
      return decoded
    }
  }
  return secret
}

export const normalizePubkey = (pubkey: string) => {
  if (pubkey.toLowerCase().startsWith("npub")) {
    const decoded = nip19.decode(pubkey).data
    if (typeof decoded === "string") {
      return decoded
    }
    if (decoded instanceof Uint8Array) {
      return bytesToHex(decoded)
    }
  }
  return pubkey
}

export const generateSecret = () => bytesToHex(generateSecretKey())

export const derivePublicKey = (secret: string) => getPublicKey(hexToBytes(secret))

export const signEvent = (event: EventTemplate, secret: string): Event => {
  return finalizeEvent(event, hexToBytes(secret))
}

export const encryptContent = async (
  secret: string,
  pubkey: string,
  content: string,
  encryption: Nip47EncryptionType,
) => {
  if (encryption === "nip04") {
    return await nip04.encrypt(secret, pubkey, content)
  }
  const key = nip44.getConversationKey(hexToBytes(secret), pubkey)
  return nip44.encrypt(content, key)
}

export const decryptContent = async (
  secret: string,
  pubkey: string,
  content: string,
  encryption: Nip47EncryptionType,
) => {
  if (encryption === "nip04") {
    return await nip04.decrypt(secret, pubkey, content)
  }
  const key = nip44.getConversationKey(hexToBytes(secret), pubkey)
  return nip44.decrypt(content, key)
}

export const selectPreferredEncryption = (encryptions: string[]): Nip47EncryptionType | null => {
  if (encryptions.includes("nip44_v2")) {
    return "nip44_v2"
  }
  if (encryptions.includes("nip04")) {
    return "nip04"
  }
  return null
}
