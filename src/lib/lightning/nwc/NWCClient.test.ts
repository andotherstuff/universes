import {describe, expect, it} from "vitest"
import {NWCClient} from "./NWCClient"
import {derivePublicKey, generateSecret} from "./transport"

describe("NWCClient", () => {
  it("builds and accepts wallet connect urls", () => {
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

    const url = client.options.nostrWalletConnectUrl

    expect(url).toContain(`nostr+walletconnect://${walletPubkey}?`)
    expect(url).toContain(`relay=${relayUrls[0]}`)
    expect(url).toContain(`relay=${relayUrls[1]}`)
    expect(url).toContain(`pubkey=${derivePublicKey(secret)}`)
    expect(url).toContain(`secret=${secret}`)

    const parsedClient = new NWCClient({nostrWalletConnectUrl: url})

    expect(parsedClient.walletPubkey).toBe(walletPubkey)
    expect(parsedClient.relayUrls).toEqual(relayUrls)
    expect(parsedClient.options.secret).toBe(secret)
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
