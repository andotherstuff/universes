import type {SendPaymentResponse, WebLNProvider} from "@webbtc/webln-types"
import {Invoice} from "../bolt11"
import type {
  KeySendRawData,
  KeysendResponse,
  LnUrlPayResponse,
  LnUrlRawData,
  NostrResponse,
  RequestInvoiceArgs,
  ZapArgs,
  ZapOptions,
} from "./types"
import {
  generateZapEvent,
  isUrl,
  isValidAmount,
  parseKeysendResponse,
  parseLnUrlPayResponse,
  parseNostrResponse,
} from "./utils"

export const LN_ADDRESS_REGEX =
  /^((?:[^<>()[\]\\.,;:\s@"]+(?:\.[^<>()[\]\\.,;:\s@"]+)*)|(?:".+"))@((?:\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(?:(?:[a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

export const DEFAULT_PROXY = "https://api.getalby.com/lnurl"

type LightningAddressOptions = {
  proxy?: string | false
  webln?: WebLNProvider
}

type ProxyResponse = {
  lnurlp?: LnUrlRawData
  keysend?: KeySendRawData
  nostr?: NostrResponse
}

type SuccessAction =
  | {
      tag: "message"
      message: string
    }
  | {
      tag: "url"
      description: string
      url: string
    }

export class LightningAddress {
  address: string
  options: LightningAddressOptions
  username: string | undefined
  domain: string | undefined
  lnurlpData: LnUrlPayResponse | undefined
  keysendData: KeysendResponse | undefined
  nostrData: NostrResponse | undefined
  nostrPubkey: string | undefined
  nostrRelays: string[] | undefined
  webln: WebLNProvider | undefined

  constructor(address: string, options?: LightningAddressOptions) {
    this.address = address
    this.options = {proxy: DEFAULT_PROXY}
    this.options = Object.assign(this.options, options)
    this.parse()
    this.webln = this.options.webln
  }

  parse() {
    const result = LN_ADDRESS_REGEX.exec(this.address.toLowerCase())
    if (result) {
      this.username = result[1]
      this.domain = result[2]
    }
  }

  getWebLN() {
    return this.webln || (globalThis as {webln?: WebLNProvider}).webln
  }

  async fetch() {
    if (this.options.proxy) {
      return this.fetchWithProxy()
    }
    return this.fetchWithoutProxy()
  }

  async fetchWithProxy() {
    const response = await fetch(
      `${this.options.proxy}/lightning-address-details?${new URLSearchParams({
        ln: this.address,
      }).toString()}`,
    )
    if (!response.ok) {
      throw new Error(`Failed to fetch lnurl info: ${response.status} ${response.statusText}`)
    }

    const json = (await response.json()) as ProxyResponse

    if (json.lnurlp) {
      await this.parseLnUrlPayResponse(json.lnurlp)
    }
    if (json.keysend) {
      this.parseKeysendResponse(json.keysend)
    }
    if (json.nostr) {
      this.parseNostrResponse(json.nostr)
    }
  }

  async fetchWithoutProxy() {
    if (!this.domain || !this.username) {
      return
    }

    await Promise.all([this.fetchLnurlData(), this.fetchKeysendData(), this.fetchNostrData()])
  }

  async fetchLnurlData() {
    const lnurlResult = await fetch(this.lnurlpUrl())
    if (lnurlResult.ok) {
      const lnurlData = (await lnurlResult.json()) as LnUrlRawData
      await this.parseLnUrlPayResponse(lnurlData)
    }
  }

  async fetchKeysendData() {
    const keysendResult = await fetch(this.keysendUrl())
    if (keysendResult.ok) {
      const keysendData = (await keysendResult.json()) as KeySendRawData
      this.parseKeysendResponse(keysendData)
    }
  }

  async fetchNostrData() {
    const nostrResult = await fetch(this.nostrUrl())
    if (nostrResult.ok) {
      const nostrData = (await nostrResult.json()) as NostrResponse
      this.parseNostrResponse(nostrData)
    }
  }

  lnurlpUrl() {
    return `https://${this.domain}/.well-known/lnurlp/${this.username}`
  }

  keysendUrl() {
    return `https://${this.domain}/.well-known/keysend/${this.username}`
  }

  nostrUrl() {
    return `https://${this.domain}/.well-known/nostr.json?name=${this.username}`
  }

  async generateInvoice(params: Record<string, string>): Promise<Invoice> {
    let data: {pr?: string; verify?: string; successAction?: unknown} | undefined
    if (this.options.proxy) {
      const invoiceResponse = await fetch(
        `${this.options.proxy}/generate-invoice?${new URLSearchParams({
          ln: this.address,
          ...params,
        }).toString()}`,
      )
      if (!invoiceResponse.ok) {
        throw new Error(
          `Failed to generate invoice: ${invoiceResponse.status} ${invoiceResponse.statusText}`,
        )
      }
      const json = (await invoiceResponse.json()) as {invoice?: typeof data}
      data = json.invoice
    } else {
      if (!this.lnurlpData) {
        throw new Error("No lnurlpData available. Please call fetch() first.")
      }
      if (!this.lnurlpData.callback || !isUrl(this.lnurlpData.callback)) {
        throw new Error("Valid callback does not exist in lnurlpData")
      }
      const callbackUrl = new URL(this.lnurlpData.callback)
      callbackUrl.search = new URLSearchParams(params).toString()
      const invoiceResponse = await fetch(callbackUrl.toString())
      if (!invoiceResponse.ok) {
        throw new Error(
          `Failed to generate invoice: ${invoiceResponse.status} ${invoiceResponse.statusText}`,
        )
      }
      data = (await invoiceResponse.json()) as typeof data
    }

    const paymentRequest = data?.pr?.toString()
    if (!paymentRequest) throw new Error("Invalid pay service invoice")

    const invoiceArgs: {pr: string; verify?: string; successAction?: SuccessAction} = {
      pr: paymentRequest,
    }
    if (data?.verify) invoiceArgs.verify = data.verify.toString()
    if (data?.successAction && typeof data.successAction === "object") {
      const action = data.successAction as {
        tag?: string
        message?: string
        description?: string
        url?: string
      }
      if (action.tag === "message" && action.message) {
        invoiceArgs.successAction = {tag: "message", message: action.message}
      } else if (action.tag === "url" && action.url && action.description) {
        invoiceArgs.successAction = {
          tag: "url",
          description: action.description,
          url: action.url,
        }
      }
    }

    return new Invoice(invoiceArgs)
  }

  async requestInvoice(args: RequestInvoiceArgs): Promise<Invoice> {
    if (!this.lnurlpData) {
      throw new Error("No lnurlpData available. Please call fetch() first.")
    }
    const msat = args.satoshi * 1000
    const {commentAllowed, min, max} = this.lnurlpData

    if (!isValidAmount({amount: msat, min, max})) {
      throw new Error("Invalid amount")
    }
    if (
      args.comment &&
      commentAllowed &&
      commentAllowed > 0 &&
      args.comment.length > commentAllowed
    ) {
      throw new Error(`The comment length must be ${commentAllowed} characters or fewer`)
    }

    const invoiceParams: {
      amount: string
      comment?: string
      payerdata?: string
    } = {amount: msat.toString()}
    if (args.comment) invoiceParams.comment = args.comment
    if (args.payerdata) invoiceParams.payerdata = JSON.stringify(args.payerdata)

    return this.generateInvoice(invoiceParams)
  }

  async zapInvoice(
    {satoshi, comment, relays, e}: ZapArgs,
    options: ZapOptions = {},
  ): Promise<Invoice> {
    if (!this.lnurlpData) {
      throw new Error("No lnurlpData available. Please call fetch() first.")
    }
    if (!this.nostrPubkey) {
      throw new Error("Nostr Pubkey is missing")
    }
    const p = this.nostrPubkey
    const msat = satoshi * 1000
    const {allowsNostr, min, max} = this.lnurlpData

    if (!isValidAmount({amount: msat, min, max})) {
      throw new Error("Invalid amount")
    }
    if (!allowsNostr) throw new Error("Your provider does not support zaps")

    const event = await generateZapEvent(
      {
        satoshi: msat,
        comment,
        p,
        e,
        relays,
      },
      options,
    )
    const zapParams: {amount: string; nostr: string} = {
      amount: msat.toString(),
      nostr: JSON.stringify(event),
    }

    return this.generateInvoice(zapParams)
  }

  async zap(args: ZapArgs, options: ZapOptions = {}): Promise<SendPaymentResponse> {
    const invoice = await this.zapInvoice(args, options)
    const webln = this.getWebLN()
    if (!webln) {
      throw new Error("WebLN not available")
    }
    await webln.enable()
    return await webln.sendPayment(invoice.paymentRequest)
  }

  private async parseLnUrlPayResponse(lnurlpData: LnUrlRawData | undefined) {
    if (lnurlpData) {
      this.lnurlpData = await parseLnUrlPayResponse(lnurlpData)
    }
  }

  private parseKeysendResponse(keysendData: KeySendRawData | undefined) {
    if (keysendData) {
      this.keysendData = parseKeysendResponse(keysendData)
    }
  }

  private parseNostrResponse(nostrData: NostrResponse | undefined) {
    if (nostrData) {
      ;[this.nostrData, this.nostrPubkey, this.nostrRelays] = parseNostrResponse(
        nostrData,
        this.username,
      )
    }
  }
}
