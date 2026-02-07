import {SimplePool, getEventHash, type Event, type EventTemplate} from "nostr-tools"
import type {Nip47EncryptionType} from "./types"
import {
  derivePublicKey,
  normalizePubkey,
  normalizeSecretKey,
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

  close() {
    return this.pool.close(this.relayUrls)
  }
}
