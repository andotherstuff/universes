import {describe, expect, it} from "vitest"
import {bytesToHex, bytesToUtf8, hexToBytes, sha256Bytes, utf8ToBytes} from "./crypto"

describe("crypto helpers", () => {
  it("converts hex and bytes", () => {
    const bytes = new Uint8Array([1, 2, 255])
    const hex = bytesToHex(bytes)
    expect(hex).toBe("0102ff")
    expect(hexToBytes(hex)).toEqual(bytes)
  })

  it("converts utf8 and hashes", () => {
    const bytes = utf8ToBytes("hello")
    expect(bytesToUtf8(bytes)).toBe("hello")
    const digest = bytesToHex(sha256Bytes(bytes))
    expect(digest).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824")
  })
})
