import {describe, expect, it} from "vitest"
import {NWCClient} from "./NWCClient"
import {derivePublicKey, generateSecret} from "./transport"

describe("NWCClient", () => {
  it("parses and rebuilds wallet connect urls", () => {
    const secret = generateSecret()
    const walletSecret = generateSecret()
    const walletPubkey = derivePublicKey(walletSecret)
    const relayUrls = ["wss://relay.one", "wss://relay.two"]

    const client = new NWCClient({
      relayUrls,
      walletPubkey,
      secret,
      lud16: "user@example.com",
    })

    const url = client.getNostrWalletConnectUrl()
    const parsed = NWCClient.parseWalletConnectUrl(url)

    expect(parsed.walletPubkey).toBe(walletPubkey)
    expect(parsed.relayUrls).toEqual(relayUrls)
    expect(parsed.secret).toBe(secret)
    expect(url).toContain(`nostr+walletconnect://${walletPubkey}?`)
    expect(url).toContain(`relay=${relayUrls[0]}`)
    expect(url).toContain(`relay=${relayUrls[1]}`)
    expect(url).toContain(`pubkey=${client.publicKey}`)
  })

  it("accepts a single relay url", () => {
    const secret = generateSecret()
    const walletSecret = generateSecret()
    const walletPubkey = derivePublicKey(walletSecret)

    const client = new NWCClient({
      relayUrl: "wss://relay.single",
      walletPubkey,
      secret,
    })

    expect(client.relayUrls).toEqual(["wss://relay.single"])
  })
})
