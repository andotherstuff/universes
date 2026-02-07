import {Relay, type Event, type EventTemplate} from "nostr-tools"
import {
  decryptContent,
  derivePublicKey,
  encryptContent,
  signEvent as signNostrEvent,
} from "./transport"
import type {
  Nip47EncryptionType,
  Nip47ListTransactionsRequest,
  Nip47LookupInvoiceRequest,
  Nip47MakeInvoiceRequest,
  Nip47Method,
  Nip47NotificationType,
  Nip47PayInvoiceRequest,
  Nip47PayKeysendRequest,
  Nip47SignMessageRequest,
  Nip47SingleMethod,
} from "./types"
import {Nip47NetworkError} from "./types"
import type {
  NWCWalletServiceRequestHandler,
  NWCWalletServiceResponse,
  NWCWalletServiceResponsePromise,
} from "./NWCWalletServiceRequestHandler"

type RelaySubscription = {
  close: () => void
  onevent?: (event: Event) => void
}

export type NewNWCWalletServiceOptions = {
  relayUrl: string
}

export class NWCWalletServiceKeyPair {
  walletSecret: string
  walletPubkey: string
  clientPubkey: string

  constructor(walletSecret: string, clientPubkey: string) {
    this.walletSecret = walletSecret
    this.clientPubkey = clientPubkey

    if (!this.walletSecret) {
      throw new Error("Missing wallet secret key")
    }
    if (!this.clientPubkey) {
      throw new Error("Missing client pubkey")
    }

    this.walletPubkey = derivePublicKey(this.walletSecret)
  }
}

export class NWCWalletService {
  relay: Relay
  relayUrl: string

  constructor(options: NewNWCWalletServiceOptions) {
    this.relayUrl = options.relayUrl
    this.relay = new Relay(this.relayUrl)

    if (globalThis.WebSocket === undefined) {
      console.error(
        "WebSocket is undefined. Make sure to `import websocket-polyfill` for nodejs environments",
      )
    }
  }

  async publishWalletServiceInfoEvent(
    walletSecret: string,
    supportedMethods: Nip47SingleMethod[],
    supportedNotifications: Nip47NotificationType[],
  ) {
    await this._checkConnected()

    const eventTemplate: EventTemplate = {
      kind: 13194,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["encryption", "nip04 nip44_v2"],
        ["notifications", supportedNotifications.join(" ")],
      ],
      content: supportedMethods.join(" "),
    }

    const event = signNostrEvent(eventTemplate, walletSecret)
    await this.relay.publish(event)
  }

  async subscribe(
    keypair: NWCWalletServiceKeyPair,
    handler: NWCWalletServiceRequestHandler,
  ): Promise<() => void> {
    let subscribed = true
    let endPromise: (() => void) | undefined
    let onRelayDisconnect: (() => void) | undefined
    let sub: RelaySubscription | undefined
    ;(async () => {
      while (subscribed) {
        try {
          await this._checkConnected()

          sub = this.relay.subscribe(
            [
              {
                kinds: [23194],
                authors: [keypair.clientPubkey],
                "#p": [keypair.walletPubkey],
              },
            ],
            {},
          )

          sub.onevent = async (event: Event) => {
            try {
              const encryptionType = (event.tags.find(
                (tag: string[]) => tag[0] === "encryption",
              )?.[1] || "nip04") as Nip47EncryptionType

              const decryptedContent = await this.decrypt(keypair, event.content, encryptionType)
              const request = JSON.parse(decryptedContent) as {
                method: Nip47Method
                params: unknown
              }

              let responsePromise: NWCWalletServiceResponsePromise<unknown> | undefined

              switch (request.method) {
                case "get_info":
                  responsePromise = handler.getInfo?.()
                  break
                case "make_invoice":
                  responsePromise = handler.makeInvoice?.(request.params as Nip47MakeInvoiceRequest)
                  break
                case "pay_invoice":
                  responsePromise = handler.payInvoice?.(request.params as Nip47PayInvoiceRequest)
                  break
                case "pay_keysend":
                  responsePromise = handler.payKeysend?.(request.params as Nip47PayKeysendRequest)
                  break
                case "get_balance":
                  responsePromise = handler.getBalance?.()
                  break
                case "lookup_invoice":
                  responsePromise = handler.lookupInvoice?.(
                    request.params as Nip47LookupInvoiceRequest,
                  )
                  break
                case "list_transactions":
                  responsePromise = handler.listTransactions?.(
                    request.params as Nip47ListTransactionsRequest,
                  )
                  break
                case "sign_message":
                  responsePromise = handler.signMessage?.(request.params as Nip47SignMessageRequest)
                  break
                default:
                  responsePromise = undefined
              }

              let response: NWCWalletServiceResponse<unknown> | undefined = await responsePromise

              if (!response) {
                response = {
                  error: {
                    code: "NOT_IMPLEMENTED",
                    message: "This method is not supported by the wallet service",
                  },
                  result: undefined,
                }
              }

              const responseEventTemplate: EventTemplate = {
                kind: 23195,
                created_at: Math.floor(Date.now() / 1000),
                tags: [["e", event.id]],
                content: await this.encrypt(
                  keypair,
                  JSON.stringify({
                    result_type: request.method,
                    ...response,
                  }),
                  encryptionType,
                ),
              }

              const responseEvent = signNostrEvent(responseEventTemplate, keypair.walletSecret)
              await this.relay.publish(responseEvent)
            } catch (error) {
              console.error("Failed to parse decrypted event content", error)
            }
          }

          await new Promise<void>(resolve => {
            endPromise = () => {
              resolve()
            }
            onRelayDisconnect = () => {
              console.error("relay disconnected")
              endPromise?.()
            }
            this.relay.onclose = onRelayDisconnect
          })

          if (onRelayDisconnect !== undefined) {
            this.relay.onclose = null
          }
        } catch (error) {
          console.error("error subscribing to requests", error || "unknown relay error")
        }

        if (subscribed) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    })()

    return () => {
      subscribed = false
      endPromise?.()
      sub?.close()
    }
  }

  get connected() {
    return this.relay.connected
  }

  close() {
    return this.relay.close()
  }

  async encrypt(
    keypair: NWCWalletServiceKeyPair,
    content: string,
    encryptionType: Nip47EncryptionType,
  ) {
    return await encryptContent(keypair.walletSecret, keypair.clientPubkey, content, encryptionType)
  }

  async decrypt(
    keypair: NWCWalletServiceKeyPair,
    content: string,
    encryptionType: Nip47EncryptionType,
  ) {
    return await decryptContent(keypair.walletSecret, keypair.clientPubkey, content, encryptionType)
  }

  private async _checkConnected() {
    if (!this.relayUrl) {
      throw new Error("Missing relay url")
    }

    try {
      if (!this.relay.connected) {
        await this.relay.connect()
      }
    } catch {
      console.error("failed to connect to relay", this.relayUrl)
      throw new Nip47NetworkError("Failed to connect to " + this.relayUrl, "OTHER")
    }
  }
}
