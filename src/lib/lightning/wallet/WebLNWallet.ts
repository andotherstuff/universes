import type {WebLNInfo} from "@welshman/util"
import type {IWallet, WalletCreateInvoiceParams, WalletPayInvoiceParams} from "./IWallet"

export type WebLNBalanceResponse = {
  balance?: number
}

export type WebLNInvoiceResponse =
  | string
  | {
      paymentRequest?: string
      pr?: string
    }

export type WebLNProvider = {
  enable: () => Promise<void>
  getInfo?: () => Promise<WebLNInfo>
  getBalance?: () => Promise<WebLNBalanceResponse>
  sendPayment?: (invoice: string) => Promise<unknown>
  makeInvoice?: (args: {amount: number; defaultMemo?: string}) => Promise<WebLNInvoiceResponse>
}

export const getWebLn = () => (window as unknown as {webln?: WebLNProvider}).webln

export class WebLNWallet implements IWallet {
  constructor(private provider: WebLNProvider | undefined) {}

  async getBalanceSats() {
    const provider = this.requireProvider()

    if (!provider.getBalance) {
      throw new Error("WebLN wallet does not support balance checks")
    }

    await provider.enable()

    const response = await provider.getBalance()

    return Math.floor(response.balance || 0)
  }

  async payInvoice({invoice, msats}: WalletPayInvoiceParams) {
    const provider = this.requireProvider()

    if (msats) {
      throw new Error("Unable to pay zero invoices with webln")
    }

    if (!provider.sendPayment) {
      throw new Error("WebLN wallet does not support sending payments")
    }

    await provider.enable()

    return provider.sendPayment(invoice)
  }

  async createInvoice({
    sats,
    description = "Receive via lightning",
  }: WalletCreateInvoiceParams): Promise<string> {
    const provider = this.requireProvider()

    if (!provider.makeInvoice) {
      throw new Error("WebLN wallet does not support creating invoices")
    }

    await provider.enable()

    const response = await provider.makeInvoice({
      amount: sats,
      defaultMemo: description,
    })

    const paymentRequest =
      typeof response === "string" ? response : response.paymentRequest || response.pr || ""

    if (!paymentRequest) {
      throw new Error("Invalid payment request returned from WebLN")
    }

    return paymentRequest
  }

  close() {
    // WebLN providers are managed by the browser extension.
  }

  private requireProvider() {
    if (!this.provider) {
      throw new Error("WebLN not available")
    }

    return this.provider
  }
}
