import {describe, expect, it} from "vitest"
import {
  isValidAmount,
  parseKeysendResponse,
  parseLnUrlPayResponse,
  parseNostrResponse,
} from "./utils"
import type {LnUrlRawData} from "./types"

describe("lnurl utils", () => {
  it("parses keysend response", () => {
    const result = parseKeysendResponse({
      tag: "keysend",
      status: "OK",
      pubkey: "abc",
      customData: [{customKey: "k", customValue: "v"}],
    })

    expect(result.destination).toBe("abc")
    expect(result.customKey).toBe("k")
    expect(result.customValue).toBe("v")
  })

  it("parses lnurl pay response", async () => {
    const raw: LnUrlRawData = {
      tag: "payRequest",
      callback: "https://example.com/callback",
      minSendable: 1000,
      maxSendable: 2000,
      metadata: JSON.stringify([
        ["text/plain", "hello"],
        ["text/identifier", "user@example.com"],
      ]),
    }

    const parsed = await parseLnUrlPayResponse(raw)

    expect(parsed.description).toBe("hello")
    expect(parsed.identifier).toBe("user@example.com")
    expect(parsed.fixed).toBe(false)
    expect(parsed.metadataHash.length).toBe(64)
  })

  it("parses nostr response", () => {
    const [data, pubkey, relays] = parseNostrResponse(
      {names: {alice: "pub"}, relays: {pub: ["wss://relay"]}},
      "alice",
    )

    expect(data.names.alice).toBe("pub")
    expect(pubkey).toBe("pub")
    expect(relays).toEqual(["wss://relay"])
  })

  it("validates amount ranges", () => {
    expect(isValidAmount({amount: 1000, min: 500, max: 2000})).toBe(true)
    expect(isValidAmount({amount: 2001, min: 500, max: 2000})).toBe(false)
  })
})
