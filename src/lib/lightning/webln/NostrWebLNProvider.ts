import type {Event, UnsignedEvent} from "nostr-tools"
import type {
  GetBalanceResponse,
  KeysendArgs,
  LookupInvoiceArgs,
  LookupInvoiceResponse,
  MakeInvoiceResponse,
  RequestInvoiceArgs,
  SendPaymentResponse,
  SignMessageResponse,
  WebLNNode,
  WebLNProvider,
  WebLNRequestMethod,
  WebLNMethod,
} from "@webbtc/webln-types"
import type {GetInfoResponse} from "@webbtc/webln-types"
import {bytesToHex} from "../core"
import type {
  Nip47Method,
  Nip47PayKeysendRequest,
  Nip47Transaction,
  NWCAuthorizationUrlOptions,
} from "../nwc"
import {NWCClient, type NWCOptions, type NewNWCClientOptions} from "../nwc"

export type Transaction = Nip47Transaction

export type ListTransactionsResponse = {
  transactions: Transaction[]
}

export type ListTransactionsArgs = {
  from?: number
  until?: number
  limit?: number
  offset?: number
  unpaid?: boolean
  type?: "incoming" | "outgoing"
}

export type SendMultiPaymentResponse = {
  payments: ({paymentRequest: string} & SendPaymentResponse)[]
  errors: {paymentRequest: string; message: string}[]
}

export type MultiKeysendResponse = {
  keysends: ({keysend: KeysendArgs} & SendPaymentResponse)[]
  errors: {keysend: KeysendArgs; message: string}[]
}

type NostrWebLNOptions = NWCOptions

export type Nip07Provider = {
  getPublicKey(): Promise<string>
  signEvent(event: UnsignedEvent): Promise<Event>
}

const nip47ToWeblnRequestMap: Record<
  Exclude<
    Nip47Method,
    | "get_budget"
    | "create_connection"
    | "make_hold_invoice"
    | "settle_hold_invoice"
    | "cancel_hold_invoice"
  >,
  WebLNMethod
> = {
  get_info: "getInfo",
  get_balance: "getBalance",
  make_invoice: "makeInvoice",
  pay_invoice: "sendPayment",
  pay_keysend: "payKeysend",
  lookup_invoice: "lookupInvoice",
  list_transactions: "listTransactions",
  multi_pay_invoice: "sendMultiPayment",
  multi_pay_keysend: "multiKeysend",
  sign_message: "signMessage",
}

export type NewNostrWeblnProviderOptions = NewNWCClientOptions & {
  client?: NWCClient
}

export class NostrWebLNProvider implements WebLNProvider, Nip07Provider {
  private _enabled = false
  readonly client: NWCClient
  readonly subscribers: Record<string, (payload: unknown) => void>

  get options(): NostrWebLNOptions {
    return this.client.options
  }

  static async fromAuthorizationUrl(
    authorizationBasePath: string,
    options: NWCAuthorizationUrlOptions = {},
    secret?: string,
  ) {
    const client = await NWCClient.fromAuthorizationUrl(authorizationBasePath, options, secret)
    return new NostrWebLNProvider({
      client,
    })
  }

  constructor(options?: NewNostrWeblnProviderOptions) {
    this.client = options?.client || new NWCClient(options)
    this.subscribers = {}
  }

  on(name: string, callback: () => void) {
    this.subscribers[name] = callback
  }

  notify(name: WebLNMethod, payload?: unknown) {
    const callback = this.subscribers[name]
    if (callback) {
      callback(payload)
    }
  }

  getPublicKey(): Promise<string> {
    return this.client.getPublicKey()
  }

  signEvent(event: UnsignedEvent): Promise<Event> {
    return this.client.signEvent(event)
  }

  async enable() {
    this._enabled = true
  }

  close() {
    return this.client.close()
  }

  async getInfo(): Promise<GetInfoResponse> {
    await this.checkEnabled()

    const supports = ["lightning", "nostr"]
    const version = "Universes Lightning"

    try {
      const nip47Result = await this.client.getInfo()

      const methods = nip47Result.methods
        .map(key => nip47ToWeblnRequestMap[key as keyof typeof nip47ToWeblnRequestMap])
        .filter(Boolean) as WebLNRequestMethod[]

      const result = {
        methods,
        node: {
          alias: nip47Result.alias,
          pubkey: nip47Result.pubkey,
          color: nip47Result.color,
        } as WebLNNode,
        supports,
        version,
      }

      this.notify("getInfo", result)
      return result
    } catch (error) {
      console.error("Using minimal getInfo", error)
      return {
        methods: ["sendPayment"],
        node: {} as WebLNNode,
        supports,
        version,
      }
    }
  }

  async getBalance(): Promise<GetBalanceResponse> {
    await this.checkEnabled()
    const nip47Result = await this.client.getBalance()

    const result = {
      balance: Math.floor(nip47Result.balance / 1000),
      currency: "sats",
    }
    this.notify("getBalance", result)
    return result
  }

  async sendPayment(invoice: string): Promise<SendPaymentResponse> {
    await this.checkEnabled()

    const nip47Result = await this.client.payInvoice({invoice})

    const result: SendPaymentResponse = {preimage: nip47Result.preimage}
    this.notify("sendPayment", result)

    return result
  }

  async sendPaymentAsync(invoice: string): Promise<Record<string, never>> {
    await this.checkEnabled()

    this.client.payInvoice({invoice})

    this.notify("sendPaymentAsync", {})

    return {}
  }

  async keysend(args: KeysendArgs): Promise<SendPaymentResponse> {
    await this.checkEnabled()

    const nip47Result: SendPaymentResponse = await this.client.payKeysend(
      mapKeysendToNip47Keysend(args),
    )

    const result: SendPaymentResponse = {preimage: nip47Result.preimage}
    this.notify("keysend", result)

    return result
  }

  async signMessage(message: string): Promise<SignMessageResponse> {
    await this.checkEnabled()

    const nip47Result = await this.client.signMessage({
      message,
    })

    const result: SignMessageResponse = {
      message: nip47Result.message,
      signature: nip47Result.signature,
    }
    this.notify("signMessage", result)

    return result
  }

  async makeInvoice(args: string | number | RequestInvoiceArgs): Promise<MakeInvoiceResponse> {
    await this.checkEnabled()

    const requestInvoiceArgs: RequestInvoiceArgs | undefined =
      typeof args === "object" ? (args as RequestInvoiceArgs) : undefined
    const amount = +(requestInvoiceArgs?.amount ?? (args as string | number))

    if (!amount) {
      throw new Error("No amount specified")
    }

    const nip47Result = await this.client.makeInvoice({
      amount: amount * 1000,
      description: requestInvoiceArgs?.defaultMemo,
    })

    const result: MakeInvoiceResponse = {paymentRequest: nip47Result.invoice}

    this.notify("makeInvoice", result)

    return result
  }

  async lookupInvoice(args: LookupInvoiceArgs): Promise<LookupInvoiceResponse> {
    await this.checkEnabled()

    const nip47Result = await this.client.lookupInvoice({
      invoice: args.paymentRequest,
      payment_hash: args.paymentHash,
    })

    const result: LookupInvoiceResponse = {
      preimage: nip47Result.preimage,
      paymentRequest: nip47Result.invoice,
      paid: !!nip47Result.settled_at,
    }

    this.notify("lookupInvoice", result)

    return result
  }

  async listTransactions(args: ListTransactionsArgs): Promise<ListTransactionsResponse> {
    await this.checkEnabled()

    const nip47Result = await this.client.listTransactions(args)

    const result: ListTransactionsResponse = {
      transactions: nip47Result.transactions.map(mapNip47TransactionToTransaction),
    }

    this.notify("listTransactions", result)

    return result
  }

  async sendMultiPayment(paymentRequests: string[]): Promise<SendMultiPaymentResponse> {
    await this.checkEnabled()

    const nip47Result = await this.client.multiPayInvoice({
      invoices: paymentRequests.map((paymentRequest, index) => ({
        invoice: paymentRequest,
        id: index.toString(),
      })),
    })

    const result = {
      payments: nip47Result.invoices.map(invoice => {
        const paymentRequest = paymentRequests[parseInt(invoice.dTag, 10)]
        if (!paymentRequest) {
          throw new Error("Could not find paymentRequest matching response d tag")
        }
        return {
          paymentRequest,
          preimage: invoice.preimage,
        }
      }),
      errors: [],
    }

    this.notify("sendMultiPayment", result)
    return result
  }

  async multiKeysend(keysends: KeysendArgs[]): Promise<MultiKeysendResponse> {
    await this.checkEnabled()

    const nip47Result = await this.client.multiPayKeysend({
      keysends: keysends.map((keysend, index) => ({
        ...mapKeysendToNip47Keysend(keysend),
        id: index.toString(),
      })),
    })

    const result: MultiKeysendResponse = {
      keysends: nip47Result.keysends.map(resultItem => {
        const keysend = keysends[parseInt(resultItem.dTag, 10)]
        if (!keysend) {
          throw new Error("Could not find keysend matching response d tag")
        }
        return {
          keysend,
          preimage: resultItem.preimage,
        }
      }),
      errors: [],
    }

    this.notify("multiKeysend", result)
    return result
  }

  lnurl(lnurl: string): Promise<{status: "OK"} | {status: "ERROR"; reason: string}> {
    throw new Error("Method not implemented.")
  }

  request(method: WebLNRequestMethod, args?: unknown): Promise<unknown> {
    throw new Error("Method not implemented.")
  }

  verifyMessage(signature: string, message: string): Promise<void> {
    throw new Error("Method not implemented.")
  }

  private async checkEnabled() {
    if (!this._enabled) {
      throw new Error("please call enable() and await the promise before calling this function")
    }
  }
}

function mapNip47TransactionToTransaction(transaction: Nip47Transaction): Transaction {
  return {
    ...transaction,
    amount: Math.floor(transaction.amount / 1000),
    fees_paid: transaction.fees_paid ? Math.floor(transaction.fees_paid / 1000) : 0,
  }
}

function mapKeysendToNip47Keysend(args: KeysendArgs): Nip47PayKeysendRequest {
  return {
    amount: +args.amount * 1000,
    pubkey: args.destination,
    tlv_records: args.customRecords
      ? Object.entries(args.customRecords).map(([key, value]) => ({
          type: parseInt(key, 10),
          value: bytesToHex(new TextEncoder().encode(value)),
        }))
      : [],
  }
}

export const NWC = NostrWebLNProvider
