import {describe, expect, it} from "vitest"
import {LightningAddress} from "./LightningAddress"

describe("LightningAddress", () => {
  it("parses lightning addresses", () => {
    const ln = new LightningAddress("Alice@Example.com", {proxy: false})

    expect(ln.username).toBe("alice")
    expect(ln.domain).toBe("example.com")
    expect(ln.lnurlpUrl()).toBe("https://example.com/.well-known/lnurlp/alice")
    expect(ln.keysendUrl()).toBe("https://example.com/.well-known/keysend/alice")
    expect(ln.nostrUrl()).toBe("https://example.com/.well-known/nostr.json?name=alice")
  })
})
