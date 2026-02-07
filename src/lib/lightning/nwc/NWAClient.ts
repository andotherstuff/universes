import {SimplePool} from "nostr-tools"
import {derivePublicKey, generateSecret} from "./transport"
import type {BudgetRenewalPeriod, Nip47Method, Nip47NotificationType} from "./types"
import {Nip47NetworkError} from "./types"
import {NWCClient} from "./NWCClient"

export type NWAOptions = {
  relayUrls: string[]
  appPubkey: string
  requestMethods: Nip47Method[]
  name?: string
  icon?: string
  notificationTypes?: Nip47NotificationType[]
  maxAmount?: number
  budgetRenewal?: BudgetRenewalPeriod
  expiresAt?: number
  isolated?: boolean
  returnTo?: string
  metadata?: unknown
}

export type NewNWAClientOptions = Omit<NWAOptions, "appPubkey"> & {
  appSecretKey?: string
}

export class NWAClient {
  options: NWAOptions
  appSecretKey: string
  pool: SimplePool

  constructor(options: NewNWAClientOptions) {
    this.appSecretKey = options.appSecretKey || generateSecret()
    this.options = {
      ...options,
      appPubkey: derivePublicKey(this.appSecretKey),
    }

    if (!this.options.relayUrls?.length) {
      throw new Error("Missing relay urls")
    }
    if (!this.options.requestMethods?.length) {
      throw new Error("Missing request methods")
    }

    this.pool = new SimplePool()

    if (globalThis.WebSocket === undefined) {
      console.error(
        "WebSocket is undefined. Make sure to `import websocket-polyfill` for nodejs environments",
      )
    }
  }

  get connectionUri() {
    return this.getConnectionUri()
  }

  getConnectionUri(nwaSchemeSuffix = "") {
    const searchParams = new URLSearchParams({
      request_methods: this.options.requestMethods.join(" "),
      ...(this.options.name ? {name: this.options.name} : {}),
      ...(this.options.icon ? {icon: this.options.icon} : {}),
      ...(this.options.returnTo ? {return_to: this.options.returnTo} : {}),
      ...(this.options.notificationTypes
        ? {notification_types: this.options.notificationTypes.join(" ")}
        : {}),
      ...(this.options.maxAmount ? {max_amount: this.options.maxAmount.toString()} : {}),
      ...(this.options.budgetRenewal ? {budget_renewal: this.options.budgetRenewal} : {}),
      ...(this.options.expiresAt ? {expires_at: this.options.expiresAt.toString()} : {}),
      ...(this.options.isolated ? {isolated: this.options.isolated.toString()} : {}),
      ...(this.options.metadata ? {metadata: JSON.stringify(this.options.metadata)} : {}),
    })

    for (const relay of this.options.relayUrls) {
      searchParams.append("relay", relay)
    }

    return `nostr+walletauth${nwaSchemeSuffix ? `+${nwaSchemeSuffix}` : ""}://${this.options.appPubkey}?${searchParams
      .toString()
      .replace(/\+/g, "%20")}`
  }

  static parseWalletAuthUrl(walletAuthUrl: string): NWAOptions {
    if (!walletAuthUrl.startsWith("nostr+walletauth")) {
      throw new Error(
        "Unexpected scheme. Should be nostr+walletauth:// or nostr+walletauth+specificapp://",
      )
    }

    const colonIndex = walletAuthUrl.indexOf(":")
    let normalized = walletAuthUrl.substring(colonIndex + 1)
    if (normalized.startsWith("//")) {
      normalized = normalized.substring(2)
    }
    normalized = "http://" + normalized

    const url = new URL(normalized)

    const appPubkey = url.host
    if (appPubkey?.length !== 64) {
      throw new Error("Incorrect app pubkey found in auth string")
    }

    const relayUrls = url.searchParams.getAll("relay")
    if (!relayUrls.length) {
      throw new Error("No relay URL found in auth string")
    }

    const requestMethods = url.searchParams.get("request_methods")?.split(" ") as
      | Nip47Method[]
      | undefined
    if (!requestMethods?.length) {
      throw new Error("No request methods found in auth string")
    }

    const notificationTypes = url.searchParams.get("notification_types")?.split(" ") as
      | Nip47NotificationType[]
      | undefined

    const maxAmountString = url.searchParams.get("max_amount")
    const expiresAtString = url.searchParams.get("expires_at")
    const metadataString = url.searchParams.get("metadata")

    return {
      name: url.searchParams.get("name") || undefined,
      icon: url.searchParams.get("icon") || undefined,
      returnTo: url.searchParams.get("return_to") || undefined,
      relayUrls,
      appPubkey,
      requestMethods,
      notificationTypes,
      budgetRenewal: url.searchParams.get("budget_renewal") as BudgetRenewalPeriod | undefined,
      expiresAt: expiresAtString ? parseInt(expiresAtString, 10) : undefined,
      maxAmount: maxAmountString ? parseInt(maxAmountString, 10) : undefined,
      isolated: url.searchParams.get("isolated") === "true",
      metadata: metadataString ? JSON.parse(metadataString) : undefined,
    }
  }

  async subscribe(args: {onSuccess: (nwcClient: NWCClient) => void}): Promise<{unsub: () => void}> {
    let subscribed = true
    let endPromise: (() => void) | undefined
    let sub: {close: () => void} | undefined
    ;(async () => {
      while (subscribed) {
        try {
          await this._checkConnected()

          sub = this.pool.subscribe(
            this.options.relayUrls,
            {
              kinds: [13194],
              "#p": [this.options.appPubkey],
            },
            {
              onevent: async event => {
                const client = new NWCClient({
                  relayUrls: this.options.relayUrls,
                  secret: this.appSecretKey,
                  walletPubkey: event.pubkey,
                })

                try {
                  const info = await client.getInfo()
                  client.options.lud16 = info.lud16
                  client.lud16 = info.lud16
                } catch (error) {
                  console.error("failed to fetch get_info", error)
                }

                args.onSuccess(client)

                subscribed = false
                endPromise?.()
                sub?.close()
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
          console.error("error subscribing to info event", error || "unknown relay error")
        }

        if (subscribed) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    })()

    return {
      unsub: () => {
        subscribed = false
        endPromise?.()
        sub?.close()
      },
    }
  }

  private async _checkConnected() {
    if (!this.appSecretKey) {
      throw new Error("Missing secret key")
    }
    if (!this.options.relayUrls?.length) {
      throw new Error("Missing relay urls")
    }

    try {
      await Promise.any(this.options.relayUrls.map(relayUrl => this.pool.ensureRelay(relayUrl)))
    } catch (error) {
      console.error("failed to connect to any relay", error)
      throw new Nip47NetworkError(
        "Failed to connect to " + this.options.relayUrls.join(","),
        "OTHER",
      )
    }
  }
}
