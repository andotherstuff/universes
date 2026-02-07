import {describe, expect, it} from "vitest"
import {NWAClient, type NewNWAClientOptions} from "./NWAClient"

const relayUrls = ["wss://relay.one", "wss://relay.two"]

const baseOptions: NewNWAClientOptions = {
  relayUrls,
  requestMethods: ["get_info"],
  name: "Test App",
  icon: "https://example.com/icon.png",
  returnTo: "https://example.com/return",
}

describe("NWAClient", () => {
  it("builds a connection uri", () => {
    const client = new NWAClient(baseOptions)
    const uri = client.getConnectionUri()

    expect(uri).toContain("nostr+walletauth://")
    expect(uri).toContain(`request_methods=${encodeURIComponent("get_info")}`)
    expect(uri).toContain(`relay=${encodeURIComponent(relayUrls[0])}`)
    expect(uri).toContain(`relay=${encodeURIComponent(relayUrls[1])}`)
  })

  it("parses a wallet auth url", () => {
    const client = new NWAClient(baseOptions)
    const uri = client.getConnectionUri()
    const parsed = NWAClient.parseWalletAuthUrl(uri)

    expect(parsed.appPubkey).toBe(client.options.appPubkey)
    expect(parsed.relayUrls).toEqual(relayUrls)
    expect(parsed.requestMethods).toEqual(["get_info"])
  })
})
