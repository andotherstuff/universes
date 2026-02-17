import {uniq} from "@welshman/lib"
import {PublishStatus, publish, request} from "@welshman/net"
import {Nip01Signer, decrypt} from "@welshman/signer"
import {
  getPubkey,
  makeEvent,
  normalizeRelayUrl,
  type SignedEvent,
  type TrustedEvent,
} from "@welshman/util"
import type {
  Nip47EncryptionType,
  Nip47GetBalanceResponse,
  Nip47GetInfoResponse,
  Nip47MakeInvoiceRequest,
  Nip47PayInvoiceRequest,
  Nip47PayResponse,
  Nip47TimeoutValues,
  Nip47Transaction,
  Nip47Method,
} from "./types"
import {
  Nip47NetworkError,
  Nip47PublishError,
  Nip47PublishTimeoutError,
  Nip47ReplyTimeoutError,
  Nip47ResponseDecodingError,
  Nip47ResponseValidationError,
  Nip47UnsupportedEncryptionError,
  Nip47WalletError,
} from "./types"

const NIP47_INFO_KIND = 13194
const NIP47_REQUEST_KIND = 23194
const NIP47_RESPONSE_KIND = 23195
const NIP47_VERSION = "1.0"
const OUTBOUND_ENCRYPTION: Nip47EncryptionType = "nip44_v2"

const hexKeyPattern = /^[0-9a-f]{64}$/i

const normalizeHexKey = (key: string, label: string) => {
  const normalized = key.trim()

  if (!hexKeyPattern.test(normalized)) {
    throw new Error(`Invalid ${label}`)
  }

  return normalized.toLowerCase()
}

type Nip47Response<T> = {
  result?: T
  error?: {
    message?: string
    code?: string
  }
}

const withTimeout = async <T>(timeoutMs: number, f: (signal: AbortSignal) => Promise<T>) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await f(controller.signal)
  } finally {
    clearTimeout(timeoutId)
  }
}

export type NWCOptions = {
  relayUrls: string[]
  relayUrl: string
  walletPubkey: string
  secret: string
  lud16?: string
  nostrWalletConnectUrl: string
}

export type NewNWCClientOptions = {
  relayUrls?: string[]
  relayUrl?: string
  secret?: string
  walletPubkey?: string
  nostrWalletConnectUrl?: string
  lud16?: string
}

const parseWalletConnectUrl = (walletConnectUrl: string): NewNWCClientOptions => {
  const normalized = walletConnectUrl
    .replace("nostrwalletconnect://", "http://")
    .replace("nostr+walletconnect://", "http://")
    .replace("nostrwalletconnect:", "http://")
    .replace("nostr+walletconnect:", "http://")

  const url = new URL(normalized)
  const relayParams = url.searchParams.getAll("relay")

  if (!relayParams.length) {
    throw new Error("No relay URL found in connection string")
  }

  const options: NewNWCClientOptions = {
    walletPubkey: url.host,
    relayUrls: relayParams,
    relayUrl: relayParams[0],
    nostrWalletConnectUrl: walletConnectUrl,
  }

  const secret = url.searchParams.get("secret")
  if (secret) {
    options.secret = secret
  }

  const lud16 = url.searchParams.get("lud16")
  if (lud16) {
    options.lud16 = lud16
  }

  return options
}

export class NWCClient {
  signer: Nip01Signer
  relayUrls: string[]
  walletPubkey: string
  secret: string
  lud16: string | undefined
  options: NWCOptions
  private encryptionReady = false

  constructor(options: NewNWCClientOptions = {}) {
    if (options.nostrWalletConnectUrl) {
      options = {
        ...parseWalletConnectUrl(options.nostrWalletConnectUrl),
        ...options,
      }
    }

    const relayUrls = options.relayUrls || (options.relayUrl ? [options.relayUrl] : [])

    if (!relayUrls.length) {
      throw new Error("Missing relay url")
    }

    if (!options.walletPubkey) {
      throw new Error("Missing wallet pubkey")
    }

    if (!options.secret) {
      throw new Error("Missing secret key")
    }

    this.relayUrls = uniq(relayUrls.map(normalizeRelayUrl))
    this.secret = normalizeHexKey(options.secret, "secret key")
    this.lud16 = options.lud16
    this.walletPubkey = normalizeHexKey(options.walletPubkey, "wallet pubkey")
    this.signer = Nip01Signer.fromSecret(this.secret)

    const nostrWalletConnectUrl =
      options.nostrWalletConnectUrl || this.buildNostrWalletConnectUrl(true)

    this.options = {
      relayUrls: this.relayUrls,
      relayUrl: this.relayUrls[0],
      walletPubkey: this.walletPubkey,
      secret: this.secret,
      lud16: this.lud16,
      nostrWalletConnectUrl,
    }
  }

  async getInfo(): Promise<Nip47GetInfoResponse> {
    return await this.executeNip47Request<Nip47GetInfoResponse>(
      "get_info",
      {},
      response => Array.isArray(response.methods),
      {replyTimeout: 10000},
    )
  }

  async getBalance(): Promise<Nip47GetBalanceResponse> {
    return await this.executeNip47Request<Nip47GetBalanceResponse>(
      "get_balance",
      {},
      response => typeof response.balance === "number",
      {replyTimeout: 10000},
    )
  }

  async payInvoice(request: Nip47PayInvoiceRequest): Promise<Nip47PayResponse> {
    return await this.executeNip47Request<Nip47PayResponse>(
      "pay_invoice",
      request,
      response => response !== undefined,
    )
  }

  async makeInvoice(request: Nip47MakeInvoiceRequest): Promise<Nip47Transaction> {
    if (!request.amount) {
      throw new Error("No amount specified")
    }

    return await this.executeNip47Request<Nip47Transaction>("make_invoice", request, response =>
      Boolean(response.invoice),
    )
  }

  close() {
    // No-op. The welshman network layer manages relay socket lifecycle.
    return undefined
  }

  private buildNostrWalletConnectUrl(includeSecret = true) {
    let url = `nostr+walletconnect://${this.walletPubkey}?relay=${this.relayUrls.join(
      "&relay=",
    )}&pubkey=${this.publicKey}`

    if (includeSecret) {
      url = `${url}&secret=${this.secret}`
    }

    if (this.lud16) {
      url = `${url}&lud16=${this.lud16}`
    }

    return url
  }

  private get publicKey() {
    return getPubkey(this.secret)
  }

  private async executeNip47Request<T>(
    nip47Method: Nip47Method,
    params: unknown,
    resultValidator: (result: T) => boolean,
    timeoutValues?: Nip47TimeoutValues,
  ): Promise<T> {
    await this.assertWalletSupportsNip44()

    const command = {method: nip47Method, params}
    const encryptedCommand = await this.signer.nip44.encrypt(
      this.walletPubkey,
      JSON.stringify(command),
    )
    const template = makeEvent(NIP47_REQUEST_KIND, {
      tags: [
        ["p", this.walletPubkey],
        ["v", NIP47_VERSION],
        ["encryption", OUTBOUND_ENCRYPTION],
      ],
      content: encryptedCommand,
    })
    const event = await this.signer.sign(template)
    const replyTimeout = timeoutValues?.replyTimeout || 60_000
    const publishTimeout = timeoutValues?.publishTimeout || 5_000
    const responseListener = this.listenForResponse(event.id, replyTimeout)

    try {
      await this.publishRequest(event, publishTimeout)
    } catch (error) {
      responseListener.cancel()
      throw error
    }

    const responseEvent = await responseListener.promise
    let response: Nip47Response<T>

    try {
      const decryptedContent = await decrypt(this.signer, this.walletPubkey, responseEvent.content)
      response = JSON.parse(decryptedContent) as Nip47Response<T>
    } catch {
      throw new Nip47ResponseDecodingError("failed to deserialize response", "INTERNAL")
    }

    if (response.result) {
      if (resultValidator(response.result)) {
        return response.result
      }

      throw new Nip47ResponseValidationError(
        "response from NWC failed validation: " + JSON.stringify(response.result),
        "INTERNAL",
      )
    }

    throw new Nip47WalletError(
      response.error?.message || "unknown Error",
      response.error?.code || "INTERNAL",
    )
  }

  private listenForResponse(eventId: string, timeoutMs: number) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    let responseEvent: TrustedEvent | undefined

    const promise = request({
      relays: this.relayUrls,
      filters: [{kinds: [NIP47_RESPONSE_KIND], authors: [this.walletPubkey], "#e": [eventId]}],
      signal: controller.signal,
      onEvent: (event: TrustedEvent) => {
        if (!responseEvent) {
          responseEvent = event
          controller.abort()
        }
      },
    })
      .then(() => {
        if (!responseEvent) {
          throw new Nip47ReplyTimeoutError(`reply timeout: event ${eventId}`, "INTERNAL")
        }

        return responseEvent
      })
      .finally(() => clearTimeout(timeoutId))

    return {
      promise,
      cancel: () => controller.abort(),
    }
  }

  private async publishRequest(event: SignedEvent, timeout: number) {
    const resultsByRelay = await publish({
      relays: this.relayUrls,
      event,
      timeout,
    })
    const results = Object.values(resultsByRelay)

    if (results.some(result => result.status === PublishStatus.Success)) {
      return
    }

    if (results.every(result => result.status === PublishStatus.Timeout)) {
      throw new Nip47PublishTimeoutError(`publish timeout: ${event.id}`, "INTERNAL")
    }

    throw new Nip47PublishError(
      "failed to publish: " + results.map(result => `${result.relay}:${result.status}`).join(", "),
      "INTERNAL",
    )
  }

  private async assertWalletSupportsNip44() {
    if (this.encryptionReady) {
      return
    }

    const infoEvents = await withTimeout(5_000, signal =>
      request({
        relays: this.relayUrls,
        filters: [{kinds: [NIP47_INFO_KIND], authors: [this.walletPubkey], limit: 1}],
        signal,
      }),
    )
    const info = infoEvents[0]

    if (!info) {
      throw new Nip47NetworkError("no info event (kind 13194) returned from relay", "OTHER")
    }

    const encryptionTag = info.tags.find(tag => tag[0] === "encryption")
    const supportedEncryptions = (encryptionTag?.[1] || "").split(" ").filter(Boolean)
    const isNip44Supported =
      supportedEncryptions.length > 0
        ? supportedEncryptions.includes(OUTBOUND_ENCRYPTION)
        : info.tags.some(tag => tag[0] === "v" && tag[1]?.includes(NIP47_VERSION))

    if (!isNip44Supported) {
      throw new Nip47UnsupportedEncryptionError(
        "wallet does not support required nip44_v2 encryption",
        "UNSUPPORTED_ENCRYPTION",
      )
    }

    this.encryptionReady = true
  }
}
