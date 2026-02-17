import {fromMsats} from "@welshman/util"
import type {NWCInfo} from "@welshman/util"
import {NWCClient} from "../nwc"
import type {IWallet, WalletCreateInvoiceParams, WalletPayInvoiceParams} from "./IWallet"

export class NWCWallet implements IWallet {
  readonly client: NWCClient

  constructor(info: NWCInfo) {
    this.client = info.nostrWalletConnectUrl
      ? new NWCClient({nostrWalletConnectUrl: info.nostrWalletConnectUrl})
      : new NWCClient(info)
  }

  async getBalanceSats() {
    const response = await this.client.getBalance()

    return fromMsats(response.balance || 0)
  }

  payInvoice({invoice, msats}: WalletPayInvoiceParams) {
    const params: {invoice: string; amount?: number} = {invoice}

    if (msats) {
      params.amount = msats
    }

    return this.client.payInvoice(params)
  }

  async createInvoice({
    sats,
    description = "Receive via lightning",
  }: WalletCreateInvoiceParams): Promise<string> {
    const response = await this.client.makeInvoice({
      amount: sats * 1000,
      description,
    })

    if (!response.invoice) {
      throw new Error("NWC wallet failed to return an invoice")
    }

    return response.invoice
  }

  close() {
    this.client.close()
  }
}
