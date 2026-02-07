import {SimplePool, type Event, type EventTemplate} from "nostr-tools"
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
import {
  decryptContent,
  derivePublicKey,
  encryptContent,
  normalizePubkey,
  normalizeSecretKey,
  selectPreferredEncryption,
  signEvent as signNostrEvent,
} from "./transport"

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
  pool: SimplePool
  relayUrls: string[]
  walletPubkey: string
  secret: string
  lud16: string | undefined
  options: NWCOptions
  private encryptionType: Nip47EncryptionType | undefined

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

    const secret = normalizeSecretKey(options.secret)
    if (!secret) {
      throw new Error("Missing secret key")
    }

    this.pool = new SimplePool()
    this.relayUrls = relayUrls
    this.secret = secret
    this.lud16 = options.lud16
    this.walletPubkey = normalizePubkey(options.walletPubkey)

    const nostrWalletConnectUrl =
      options.nostrWalletConnectUrl || this.buildNostrWalletConnectUrl(true)

    this.options = {
      relayUrls,
      relayUrl: relayUrls[0],
      walletPubkey: this.walletPubkey,
      secret: this.secret,
      lud16: this.lud16,
      nostrWalletConnectUrl,
    }

    if (globalThis.WebSocket === undefined) {
      console.error(
        "WebSocket is undefined. Make sure to `import websocket-polyfill` for nodejs environments",
      )
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
    return this.pool.close(this.relayUrls)
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
    return derivePublicKey(this.secret)
  }

  private signEvent(event: EventTemplate): Event {
    return signNostrEvent(event, this.secret)
  }

  private async encrypt(pubkey: string, content: string) {
    return await encryptContent(this.secret, pubkey, content, this.requireEncryption())
  }

  private async decrypt(pubkey: string, content: string) {
    return await decryptContent(this.secret, pubkey, content, this.requireEncryption())
  }

  private requireEncryption(): Nip47EncryptionType {
    if (!this.encryptionType) {
      throw new Error("Missing encryption or version")
    }
    return this.encryptionType
  }

  private async getWalletServiceInfo(): Promise<{encryptions: Nip47EncryptionType[]}> {
    await this.ensureConnected()

    const event = await this.pool.get(this.relayUrls, {
      kinds: [13194],
      limit: 1,
      authors: [this.walletPubkey],
    })

    if (!event) {
      throw new Error("no info event (kind 13194) returned from relay")
    }

    const versionsTag = event.tags.find(tag => tag[0] === "v")
    const encryptionTag = event.tags.find(tag => tag[0] === "encryption")

    let encryptions: Nip47EncryptionType[] = ["nip04"]
    if (versionsTag && versionsTag[1]?.includes("1.0")) {
      encryptions.push("nip44_v2")
    }
    if (encryptionTag) {
      encryptions = encryptionTag[1].split(" ") as Nip47EncryptionType[]
    }

    return {encryptions}
  }

  private async executeNip47Request<T>(
    nip47Method: Nip47Method,
    params: unknown,
    resultValidator: (result: T) => boolean,
    timeoutValues?: Nip47TimeoutValues,
  ): Promise<T> {
    await this.ensureConnected()
    await this.selectEncryptionType()

    return new Promise<T>((resolve, reject) => {
      const command = {
        method: nip47Method,
        params,
      }

      ;(async () => {
        const encryptedCommand = await this.encrypt(this.walletPubkey, JSON.stringify(command))
        const eventTemplate: EventTemplate = {
          kind: 23194,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ["p", this.walletPubkey],
            ["v", this.requireEncryption() === "nip44_v2" ? "1.0" : "0.0"],
            ["encryption", this.requireEncryption()],
          ],
          content: encryptedCommand,
        }

        const event = this.signEvent(eventTemplate)
        const sub = this.pool.subscribe(
          this.relayUrls,
          {
            kinds: [23195],
            authors: [this.walletPubkey],
            "#e": [event.id],
          },
          {
            onevent: async responseEvent => {
              clearTimeout(replyTimeoutCheck)
              sub.close()

              let response
              try {
                const decryptedContent = await this.decrypt(
                  this.walletPubkey,
                  responseEvent.content,
                )
                response = JSON.parse(decryptedContent)
              } catch {
                reject(new Nip47ResponseDecodingError("failed to deserialize response", "INTERNAL"))
                return
              }

              if (response.result) {
                if (resultValidator(response.result)) {
                  resolve(response.result)
                } else {
                  reject(
                    new Nip47ResponseValidationError(
                      "response from NWC failed validation: " + JSON.stringify(response.result),
                      "INTERNAL",
                    ),
                  )
                }
              } else {
                reject(
                  new Nip47WalletError(
                    response.error?.message || "unknown Error",
                    response.error?.code || "INTERNAL",
                  ),
                )
              }
            },
          },
        )

        const replyTimeoutCheck = setTimeout(() => {
          sub.close()
          reject(new Nip47ReplyTimeoutError(`reply timeout: event ${event.id}`, "INTERNAL"))
        }, timeoutValues?.replyTimeout || 60000)

        const publishTimeoutCheck = setTimeout(() => {
          sub.close()
          reject(new Nip47PublishTimeoutError(`publish timeout: ${event.id}`, "INTERNAL"))
        }, timeoutValues?.publishTimeout || 5000)

        try {
          await Promise.any(this.pool.publish(this.relayUrls, event))
          clearTimeout(publishTimeoutCheck)
        } catch (error) {
          clearTimeout(publishTimeoutCheck)
          reject(new Nip47PublishError(`failed to publish: ${error}`, "INTERNAL"))
        }
      })().catch(error => reject(error as Error))
    })
  }

  private async ensureConnected() {
    if (!this.relayUrls.length) {
      throw new Error("Missing relay url")
    }

    try {
      await Promise.any(this.relayUrls.map(relayUrl => this.pool.ensureRelay(relayUrl)))
    } catch (error) {
      console.error("failed to connect to any relay", error)
      throw new Nip47NetworkError("Failed to connect to " + this.relayUrls.join(","), "OTHER")
    }
  }

  private async selectEncryptionType() {
    if (!this.encryptionType) {
      const walletServiceInfo = await this.getWalletServiceInfo()
      const encryptionType = selectPreferredEncryption(walletServiceInfo.encryptions)

      if (!encryptionType) {
        throw new Nip47UnsupportedEncryptionError(
          "no compatible encryption or version found between wallet and client",
          "UNSUPPORTED_ENCRYPTION",
        )
      }

      if (encryptionType === "nip04") {
        console.warn(
          "NIP-04 encryption is about to be deprecated. Please upgrade your wallet service to use NIP-44 instead.",
        )
      }

      this.encryptionType = encryptionType
    }
  }
}
