import {SimplePool, getEventHash, type Event, type EventTemplate} from "nostr-tools"
import type {
  Nip47Capability,
  Nip47CancelHoldInvoiceRequest,
  Nip47CancelHoldInvoiceResponse,
  Nip47CreateConnectionRequest,
  Nip47CreateConnectionResponse,
  Nip47EncryptionType,
  Nip47GetBalanceResponse,
  Nip47GetBudgetResponse,
  Nip47GetInfoResponse,
  Nip47ListTransactionsRequest,
  Nip47ListTransactionsResponse,
  Nip47MakeHoldInvoiceRequest,
  Nip47MakeInvoiceRequest,
  Nip47Method,
  Nip47MultiMethod,
  Nip47MultiPayInvoiceRequest,
  Nip47MultiPayInvoiceResponse,
  Nip47MultiPayKeysendRequest,
  Nip47MultiPayKeysendResponse,
  Nip47Notification,
  Nip47NotificationType,
  Nip47PayInvoiceRequest,
  Nip47PayKeysendRequest,
  Nip47PayResponse,
  Nip47SettleHoldInvoiceRequest,
  Nip47SettleHoldInvoiceResponse,
  Nip47SignMessageRequest,
  Nip47SignMessageResponse,
  Nip47SingleMethod,
  Nip47TimeoutValues,
  Nip47Transaction,
  Nip47LookupInvoiceRequest,
  NWCAuthorizationUrlOptions,
} from "./types"
import {
  Nip47NetworkError,
  Nip47PublishError,
  Nip47PublishTimeoutError,
  Nip47ReplyTimeoutError,
  Nip47ResponseDecodingError,
  Nip47ResponseValidationError,
  Nip47UnexpectedResponseError,
  Nip47UnsupportedEncryptionError,
  Nip47WalletError,
} from "./types"
import {
  decryptContent,
  derivePublicKey,
  encryptContent,
  generateSecret,
  normalizePubkey,
  normalizeSecretKey,
  selectPreferredEncryption,
  signEvent as signNostrEvent,
} from "./transport"

export type NWCOptions = {
  relayUrls: string[]
  relayUrl?: string
  walletPubkey: string
  secret?: string
  lud16?: string
  nostrWalletConnectUrl?: string
}

export type NewNWCClientOptions = {
  relayUrls?: string[]
  relayUrl?: string
  secret?: string
  walletPubkey?: string
  nostrWalletConnectUrl?: string
  lud16?: string
}

export class NWCClient {
  pool: SimplePool
  relayUrls: string[]
  secret: string | undefined
  lud16: string | undefined
  walletPubkey: string
  options: NWCOptions
  protected _encryptionType: Nip47EncryptionType | undefined

  static parseWalletConnectUrl(walletConnectUrl: string): NWCOptions {
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

    const options: NWCOptions = {
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

  static getAuthorizationUrl(
    authorizationBasePath: string,
    options: NWCAuthorizationUrlOptions = {},
    pubkey: string,
  ): URL {
    if (authorizationBasePath.includes("/#/")) {
      throw new Error("hash router paths not supported")
    }

    const url = new URL(authorizationBasePath)

    if (options.name) {
      url.searchParams.set("name", options.name)
    }
    url.searchParams.set("pubkey", pubkey)
    if (options.returnTo) {
      url.searchParams.set("return_to", options.returnTo)
    }

    if (options.budgetRenewal) {
      url.searchParams.set("budget_renewal", options.budgetRenewal)
    }
    if (options.expiresAt) {
      url.searchParams.set("expires_at", Math.floor(options.expiresAt.getTime() / 1000).toString())
    }
    if (options.maxAmount) {
      url.searchParams.set("max_amount", options.maxAmount.toString())
    }

    if (options.requestMethods) {
      url.searchParams.set("request_methods", options.requestMethods.join(" "))
    }
    if (options.notificationTypes) {
      url.searchParams.set("notification_types", options.notificationTypes.join(" "))
    }

    if (options.isolated) {
      url.searchParams.set("isolated", "true")
    }

    if (options.metadata) {
      url.searchParams.set("metadata", JSON.stringify(options.metadata))
    }

    return url
  }

  static fromAuthorizationUrl(
    authorizationBasePath: string,
    options: NWCAuthorizationUrlOptions = {},
    secret?: string,
  ): Promise<NWCClient> {
    const resolvedSecret = secret || generateSecret()

    if (!options.name) {
      options.name = document.location.host
    }

    const url = this.getAuthorizationUrl(
      authorizationBasePath,
      options,
      derivePublicKey(resolvedSecret),
    )
    const height = 600
    const width = 400
    const top = window.outerHeight / 2 + window.screenY - height / 2
    const left = window.outerWidth / 2 + window.screenX - width / 2

    return new Promise((resolve, reject) => {
      const popup = window.open(
        url.toString(),
        `${document.title} - Wallet Connect`,
        `height=${height},width=${width},top=${top},left=${left}`,
      )
      if (!popup) {
        reject(new Error("failed to execute window.open"))
        return
      }

      const checkForPopup = () => {
        if (popup && popup.closed) {
          clearInterval(popupChecker)
          window.removeEventListener("message", onMessage)
          reject(new Error("Popup closed"))
        }
      }

      const onMessage = (message: {
        data?: {
          type: "nwc:success" | unknown
          relayUrls?: string[]
          relayUrl?: string
          walletPubkey?: string
          lud16?: string
        }
        origin: string
      }) => {
        const data = message.data
        if (
          data &&
          data.type === "nwc:success" &&
          message.origin === `${url.protocol}//${url.host}`
        ) {
          if (!data.relayUrls && data.relayUrl) {
            data.relayUrls = [data.relayUrl]
          }
          if (!data.relayUrls) {
            reject(new Error("no relayUrls or relayUrl in response"))
            return
          }

          if (!data.walletPubkey) {
            reject(new Error("no walletPubkey in response"))
            return
          }

          resolve(
            new NWCClient({
              relayUrls: data.relayUrls,
              walletPubkey: data.walletPubkey,
              secret: resolvedSecret,
              lud16: data.lud16,
            }),
          )
          clearInterval(popupChecker)
          window.removeEventListener("message", onMessage)
          if (popup) {
            popup.close()
          }
        }
      }

      const popupChecker = setInterval(checkForPopup, 500)
      window.addEventListener("message", onMessage)
    })
  }

  constructor(options: NewNWCClientOptions = {}) {
    if (options.nostrWalletConnectUrl) {
      options = {
        ...NWCClient.parseWalletConnectUrl(options.nostrWalletConnectUrl),
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

    this.pool = new SimplePool()
    this.relayUrls = relayUrls
    this.secret = normalizeSecretKey(options.secret)
    this.lud16 = options.lud16
    this.walletPubkey = normalizePubkey(options.walletPubkey)
    this.options = {
      relayUrls,
      relayUrl: relayUrls[0],
      walletPubkey: this.walletPubkey,
      secret: this.secret,
      lud16: this.lud16 || "",
      nostrWalletConnectUrl: options.nostrWalletConnectUrl,
    }

    if (!this.options.nostrWalletConnectUrl && this.secret) {
      this.options.nostrWalletConnectUrl = this.getNostrWalletConnectUrl()
    }

    if (globalThis.WebSocket === undefined) {
      console.error(
        "WebSocket is undefined. Make sure to `import websocket-polyfill` for nodejs environments",
      )
    }
  }

  get nostrWalletConnectUrl() {
    return this.getNostrWalletConnectUrl()
  }

  getNostrWalletConnectUrl(includeSecret = true) {
    let url = `nostr+walletconnect://${this.walletPubkey}?relay=${this.relayUrls.join(
      "&relay=",
    )}&pubkey=${this.publicKey}`

    if (includeSecret) {
      if (!this.secret) {
        throw new Error("Missing secret key")
      }
      url = `${url}&secret=${this.secret}`
    }

    if (this.lud16) {
      url = `${url}&lud16=${this.lud16}`
    }

    return url
  }

  get connected() {
    const connectionStatus = Array.from(this.pool.listConnectionStatus().values())
    return connectionStatus.length > 0 && connectionStatus.includes(true)
  }

  get publicKey() {
    if (!this.secret) {
      throw new Error("Missing secret key")
    }
    return derivePublicKey(this.secret)
  }

  get encryptionType(): Nip47EncryptionType {
    if (!this._encryptionType) {
      throw new Error("Missing encryption or version")
    }
    return this._encryptionType
  }

  getPublicKey(): Promise<string> {
    return Promise.resolve(this.publicKey)
  }

  signEvent(event: EventTemplate): Promise<Event> {
    if (!this.secret) {
      throw new Error("Missing secret key")
    }

    return Promise.resolve(signNostrEvent(event, this.secret))
  }

  getEventHash(event: Event) {
    return getEventHash(event)
  }

  async encrypt(pubkey: string, content: string) {
    if (!this.secret) {
      throw new Error("Missing secret")
    }

    return await encryptContent(this.secret, pubkey, content, this.encryptionType)
  }

  async decrypt(pubkey: string, content: string) {
    if (!this.secret) {
      throw new Error("Missing secret")
    }

    return await decryptContent(this.secret, pubkey, content, this.encryptionType)
  }

  async getWalletServiceInfo(): Promise<{
    encryptions: Nip47EncryptionType[]
    capabilities: Nip47Capability[]
    notifications: Nip47NotificationType[]
  }> {
    await this._checkConnected()

    const event = await this.pool.get(this.relayUrls, {
      kinds: [13194],
      limit: 1,
      authors: [this.walletPubkey],
    })

    if (!event) {
      throw new Error("no info event (kind 13194) returned from relay")
    }

    const notificationsTag = event.tags.find(tag => tag[0] === "notifications")
    const versionsTag = event.tags.find(tag => tag[0] === "v")
    const encryptionTag = event.tags.find(tag => tag[0] === "encryption")

    let encryptions: Nip47EncryptionType[] = ["nip04"]
    if (versionsTag && versionsTag[1]?.includes("1.0")) {
      encryptions.push("nip44_v2")
    }
    if (encryptionTag) {
      encryptions = encryptionTag[1].split(" ") as Nip47EncryptionType[]
    }

    return {
      encryptions,
      capabilities: event.content.split(/[ |,]/g).filter(Boolean) as Nip47Method[],
      notifications: (notificationsTag?.[1]?.split(" ") || []) as Nip47NotificationType[],
    }
  }

  async getInfo(): Promise<Nip47GetInfoResponse> {
    const result = await this.executeNip47Request<Nip47GetInfoResponse>(
      "get_info",
      {},
      response => !!response.methods,
      {replyTimeout: 10000},
    )
    return result
  }

  async getBudget(): Promise<Nip47GetBudgetResponse> {
    const result = await this.executeNip47Request<Nip47GetBudgetResponse>(
      "get_budget",
      {},
      response => response !== undefined,
      {replyTimeout: 10000},
    )
    return result
  }

  async getBalance(): Promise<Nip47GetBalanceResponse> {
    const result = await this.executeNip47Request<Nip47GetBalanceResponse>(
      "get_balance",
      {},
      response => response.balance !== undefined,
      {replyTimeout: 10000},
    )
    return result
  }

  async payInvoice(request: Nip47PayInvoiceRequest): Promise<Nip47PayResponse> {
    return await this.executeNip47Request<Nip47PayResponse>(
      "pay_invoice",
      request,
      response => !!response,
    )
  }

  async payKeysend(request: Nip47PayKeysendRequest): Promise<Nip47PayResponse> {
    return await this.executeNip47Request<Nip47PayResponse>(
      "pay_keysend",
      request,
      response => !!response.preimage,
    )
  }

  async signMessage(request: Nip47SignMessageRequest): Promise<Nip47SignMessageResponse> {
    return await this.executeNip47Request<Nip47SignMessageResponse>(
      "sign_message",
      request,
      response => response.message === request.message && !!response.signature,
    )
  }

  async createConnection(
    request: Nip47CreateConnectionRequest,
  ): Promise<Nip47CreateConnectionResponse> {
    return await this.executeNip47Request<Nip47CreateConnectionResponse>(
      "create_connection",
      request,
      response => !!response.wallet_pubkey,
    )
  }

  async multiPayInvoice(
    request: Nip47MultiPayInvoiceRequest,
  ): Promise<Nip47MultiPayInvoiceResponse> {
    const results = await this.executeMultiNip47Request<
      {invoice: Nip47PayInvoiceRequest} & Nip47PayResponse
    >("multi_pay_invoice", request, request.invoices.length, response => !!response.preimage)

    return {
      invoices: results,
      errors: [],
    }
  }

  async multiPayKeysend(
    request: Nip47MultiPayKeysendRequest,
  ): Promise<Nip47MultiPayKeysendResponse> {
    const results = await this.executeMultiNip47Request<
      {keysend: Nip47PayKeysendRequest} & Nip47PayResponse
    >("multi_pay_keysend", request, request.keysends.length, response => !!response.preimage)

    return {
      keysends: results,
      errors: [],
    }
  }

  async makeInvoice(request: Nip47MakeInvoiceRequest): Promise<Nip47Transaction> {
    if (!request.amount) {
      throw new Error("No amount specified")
    }

    return await this.executeNip47Request<Nip47Transaction>(
      "make_invoice",
      request,
      response => !!response.invoice,
    )
  }

  async makeHoldInvoice(request: Nip47MakeHoldInvoiceRequest): Promise<Nip47Transaction> {
    if (!request.amount) {
      throw new Error("No amount specified")
    }
    if (!request.payment_hash) {
      throw new Error("No payment hash specified")
    }

    return await this.executeNip47Request<Nip47Transaction>(
      "make_hold_invoice",
      request,
      response => !!response.invoice,
    )
  }

  async settleHoldInvoice(
    request: Nip47SettleHoldInvoiceRequest,
  ): Promise<Nip47SettleHoldInvoiceResponse> {
    return await this.executeNip47Request<Nip47SettleHoldInvoiceResponse>(
      "settle_hold_invoice",
      request,
      response => !!response,
    )
  }

  async cancelHoldInvoice(
    request: Nip47CancelHoldInvoiceRequest,
  ): Promise<Nip47CancelHoldInvoiceResponse> {
    return await this.executeNip47Request<Nip47CancelHoldInvoiceResponse>(
      "cancel_hold_invoice",
      request,
      response => !!response,
    )
  }

  async lookupInvoice(request: Nip47LookupInvoiceRequest): Promise<Nip47Transaction> {
    return await this.executeNip47Request<Nip47Transaction>(
      "lookup_invoice",
      request,
      response => !!response.invoice,
    )
  }

  async listTransactions(
    request: Nip47ListTransactionsRequest,
  ): Promise<Nip47ListTransactionsResponse> {
    return await this.executeNip47Request<Nip47ListTransactionsResponse>(
      "list_transactions",
      request,
      response => !!response.transactions,
      {replyTimeout: 10000},
    )
  }

  async subscribeNotifications(
    onNotification: (notification: Nip47Notification) => void,
    notificationTypes?: Nip47NotificationType[],
  ): Promise<() => void> {
    let subscribed = true
    let endPromise: (() => void) | undefined
    let sub: {close: () => void} | undefined
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    ;(async () => {
      while (subscribed) {
        try {
          await this._checkConnected()
          await this._selectEncryptionType()

          sub = this.pool.subscribe(
            this.relayUrls,
            {
              kinds: [this.encryptionType === "nip04" ? 23196 : 23197],
              authors: [this.walletPubkey],
              "#p": [this.publicKey],
            },
            {
              onevent: async event => {
                let decryptedContent
                try {
                  decryptedContent = await this.decrypt(this.walletPubkey, event.content)
                } catch (error) {
                  console.error("failed to decrypt request event content", error)
                  return
                }

                let notification
                try {
                  notification = JSON.parse(decryptedContent) as Nip47Notification
                } catch (error) {
                  console.error("Failed to parse decrypted event content", error)
                  return
                }

                if (notification.notification) {
                  if (
                    !notificationTypes ||
                    notificationTypes.includes(notification.notification_type)
                  ) {
                    onNotification(notification)
                  }
                } else {
                  console.error("No notification in response", notification)
                }
              },
              onclose: reasons => {
                console.info("relay connection closed", reasons)
                endPromise?.()
              },
            },
          )

          await new Promise<void>(resolve => {
            endPromise = () => {
              resolve()
            }
          })
        } catch (error) {
          console.error("error subscribing to notifications", error || "unknown relay error")
        }
        if (subscribed) {
          await sleep(1000)
        }
      }
    })()

    return () => {
      subscribed = false
      endPromise?.()
      sub?.close()
    }
  }

  private async executeNip47Request<T>(
    nip47Method: Nip47SingleMethod,
    params: unknown,
    resultValidator: (result: T) => boolean,
    timeoutValues?: Nip47TimeoutValues,
  ): Promise<T> {
    await this._checkConnected()
    await this._selectEncryptionType()

    return new Promise<T>((resolve, reject) => {
      ;(async () => {
        const command = {
          method: nip47Method,
          params,
        }
        const encryptedCommand = await this.encrypt(this.walletPubkey, JSON.stringify(command))
        const eventTemplate: EventTemplate = {
          kind: 23194,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ["p", this.walletPubkey],
            ["v", this.encryptionType === "nip44_v2" ? "1.0" : "0.0"],
            ["encryption", this.encryptionType],
          ],
          content: encryptedCommand,
        }

        const event = await this.signEvent(eventTemplate)
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
      })()
    })
  }

  private async executeMultiNip47Request<T>(
    nip47Method: Nip47MultiMethod,
    params: unknown,
    numPayments: number,
    resultValidator: (result: T) => boolean,
    timeoutValues?: Nip47TimeoutValues,
  ): Promise<(T & {dTag: string})[]> {
    await this._checkConnected()
    await this._selectEncryptionType()

    const results: (T & {dTag: string})[] = []

    return new Promise<(T & {dTag: string})[]>((resolve, reject) => {
      ;(async () => {
        const command = {
          method: nip47Method,
          params,
        }
        const encryptedCommand = await this.encrypt(this.walletPubkey, JSON.stringify(command))
        const eventTemplate: EventTemplate = {
          kind: 23194,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ["p", this.walletPubkey],
            ["v", this.encryptionType === "nip44_v2" ? "1.0" : "0.0"],
            ["encryption", this.encryptionType],
          ],
          content: encryptedCommand,
        }

        const event = await this.signEvent(eventTemplate)
        const sub = this.pool.subscribe(
          this.relayUrls,
          {
            kinds: [23195],
            authors: [this.walletPubkey],
            "#e": [event.id],
          },
          {
            onevent: async responseEvent => {
              let response
              try {
                const decryptedContent = await this.decrypt(
                  this.walletPubkey,
                  responseEvent.content,
                )
                response = JSON.parse(decryptedContent)
              } catch {
                clearTimeout(replyTimeoutCheck)
                sub.close()
                reject(new Nip47ResponseDecodingError("failed to deserialize response", "INTERNAL"))
                return
              }

              if (response.result) {
                if (!resultValidator(response.result)) {
                  clearTimeout(replyTimeoutCheck)
                  sub.close()
                  reject(
                    new Nip47ResponseValidationError(
                      "Response from NWC failed validation: " + JSON.stringify(response.result),
                      "INTERNAL",
                    ),
                  )
                  return
                }

                const dTag = responseEvent.tags.find(tag => tag[0] === "d")?.[1]
                if (dTag === undefined) {
                  clearTimeout(replyTimeoutCheck)
                  sub.close()
                  reject(
                    new Nip47ResponseValidationError(
                      "No d tag found in response event",
                      "INTERNAL",
                    ),
                  )
                  return
                }

                results.push({...response.result, dTag})
                if (results.length === numPayments) {
                  clearTimeout(replyTimeoutCheck)
                  sub.close()
                  resolve(results)
                }
              } else {
                clearTimeout(replyTimeoutCheck)
                sub.close()
                reject(
                  new Nip47UnexpectedResponseError(response.error?.message, response.error?.code),
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
      })()
    })
  }

  private async _checkConnected() {
    if (!this.secret) {
      throw new Error("Missing secret key")
    }
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

  private async _selectEncryptionType() {
    if (!this._encryptionType) {
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

      this._encryptionType = encryptionType
    }
  }

  close() {
    return this.pool.close(this.relayUrls)
  }
}
