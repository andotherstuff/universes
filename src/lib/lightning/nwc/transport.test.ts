import {describe, expect, it} from "vitest"
import {generateSecretKey, getPublicKey, nip19} from "nostr-tools"
import {bytesToHex} from "@noble/hashes/utils.js"
import {normalizePubkey, normalizeSecretKey, selectPreferredEncryption} from "./transport"

describe("nwc transport helpers", () => {
  it("normalizes nsec and npub keys", () => {
    const secretBytes = generateSecretKey()
    const secretHex = bytesToHex(secretBytes)
    const nsec = nip19.nsecEncode(secretBytes)

    const pubkeyHex = getPublicKey(secretBytes)
    const npub = nip19.npubEncode(pubkeyHex)

    expect(normalizeSecretKey(secretHex)).toBe(secretHex)
    expect(normalizeSecretKey(nsec)).toBe(secretHex)

    expect(normalizePubkey(pubkeyHex)).toBe(pubkeyHex)
    expect(normalizePubkey(npub)).toBe(pubkeyHex)
  })

  it("selects the preferred encryption", () => {
    expect(selectPreferredEncryption(["nip04"])).toBe("nip04")
    expect(selectPreferredEncryption(["nip04", "nip44_v2"])).toBe("nip44_v2")
    expect(selectPreferredEncryption(["unknown"])).toBeNull()
  })
})
