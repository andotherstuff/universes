import {sha256} from "@noble/hashes/sha2.js"

export const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("")

export const hexToBytes = (hex: string) => {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string length")
  }
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export const utf8ToBytes = (text: string) => new TextEncoder().encode(text)

export const bytesToUtf8 = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

export const sha256Bytes = (data: Uint8Array) => sha256(data)
