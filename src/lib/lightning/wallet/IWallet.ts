export type WalletPayInvoiceParams = {
  invoice: string
  msats?: number
}

export type WalletCreateInvoiceParams = {
  sats: number
  description?: string
}

export interface IWallet {
  getBalanceSats: () => Promise<number>
  payInvoice: (params: WalletPayInvoiceParams) => Promise<unknown>
  createInvoice: (params: WalletCreateInvoiceParams) => Promise<string>
  close: () => void
}
