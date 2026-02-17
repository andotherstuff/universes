import {describe, expect, it, vi} from "vitest"
import {WebLNWallet, type WebLNProvider} from "./WebLNWallet"

const makeProvider = (): WebLNProvider => ({
  enable: vi.fn().mockResolvedValue(undefined),
  getBalance: vi.fn().mockResolvedValue({balance: 123}),
  sendPayment: vi.fn().mockResolvedValue({preimage: "00"}),
  makeInvoice: vi.fn().mockResolvedValue({paymentRequest: "lnbc123"}),
})

describe("WebLNWallet", () => {
  it("returns balance in sats", async () => {
    const provider = makeProvider()
    const wallet = new WebLNWallet(provider)

    await expect(wallet.getBalanceSats()).resolves.toBe(123)
    expect(provider.enable).toHaveBeenCalledTimes(1)
  })

  it("rejects msat amount overrides", async () => {
    const wallet = new WebLNWallet(makeProvider())

    await expect(wallet.payInvoice({invoice: "lnbc123", msats: 1000})).rejects.toThrow(
      "Unable to pay zero invoices with webln",
    )
  })

  it("normalizes invoice responses", async () => {
    const provider = makeProvider()
    provider.makeInvoice = vi.fn().mockResolvedValue("lnbc456")
    const wallet = new WebLNWallet(provider)

    await expect(wallet.createInvoice({sats: 10})).resolves.toBe("lnbc456")
  })
})
