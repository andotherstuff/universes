import {describe, expect, it, vi} from "vitest"
import {WalletType, getPubkey, makeSecret} from "@welshman/util"
import {createWalletAdapter} from "./factory"
import {NWCWallet} from "./NWCWallet"
import {WebLNWallet, type WebLNProvider} from "./WebLNWallet"

describe("wallet factory", () => {
  it("creates NWC adapters", () => {
    const secret = makeSecret()
    const walletPubkey = getPubkey(makeSecret())
    const adapter = createWalletAdapter({
      type: WalletType.NWC,
      info: {
        lud16: "wallet@example.com",
        secret,
        relayUrl: "wss://relay.example.com",
        walletPubkey,
        nostrWalletConnectUrl: `nostr+walletconnect://${walletPubkey}?relay=wss://relay.example.com&secret=${secret}`,
      },
    })

    expect(adapter).toBeInstanceOf(NWCWallet)
  })

  it("creates WebLN adapters", () => {
    const provider: WebLNProvider = {
      enable: vi.fn().mockResolvedValue(undefined),
      getBalance: vi.fn().mockResolvedValue({balance: 1}),
      sendPayment: vi.fn().mockResolvedValue({}),
      makeInvoice: vi.fn().mockResolvedValue("lnbc1"),
    }
    const browserWindow = window as Window & {webln?: WebLNProvider}
    browserWindow.webln = provider

    const adapter = createWalletAdapter({
      type: WalletType.WebLN,
      info: {supports: ["lightning"]},
    })

    expect(adapter).toBeInstanceOf(WebLNWallet)

    delete browserWindow.webln
  })
})
