import {describe, expect, it} from "vitest"
import {getPubkey, makeSecret, normalizeRelayUrl} from "@welshman/util"
import {NWCClient} from "./NWCClient"

describe("NWCClient", () => {
  it("builds and accepts wallet connect urls", () => {
    const secret = makeSecret()
    const walletSecret = makeSecret()
    const walletPubkey = getPubkey(walletSecret)
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
    expect(url).toContain(`pubkey=${getPubkey(secret)}`)
    expect(url).toContain(`secret=${secret}`)

    const parsedClient = new NWCClient({nostrWalletConnectUrl: url})

    expect(parsedClient.walletPubkey).toBe(walletPubkey)
    expect(parsedClient.relayUrls).toEqual(relayUrls.map(normalizeRelayUrl))
    expect(parsedClient.options.secret).toBe(secret)
  })

  it("accepts a single relay url", () => {
    const secret = makeSecret()
    const walletSecret = makeSecret()
    const walletPubkey = getPubkey(walletSecret)

    const client = new NWCClient({
      relayUrl: "wss://relay.single",
      walletPubkey,
      secret,
    })

    expect(client.relayUrls).toEqual([normalizeRelayUrl("wss://relay.single")])
  })

  it("requires hex keys", () => {
    expect(
      () =>
        new NWCClient({
          relayUrl: "wss://relay.single",
          walletPubkey: "npub1nothex",
          secret: makeSecret(),
        }),
    ).toThrow("Invalid wallet pubkey")

    expect(
      () =>
        new NWCClient({
          relayUrl: "wss://relay.single",
          walletPubkey: getPubkey(makeSecret()),
          secret: "nsec1nothex",
        }),
    ).toThrow("Invalid secret key")
  })
})
