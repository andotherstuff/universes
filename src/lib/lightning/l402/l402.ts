import type {WebLNProvider} from "@webbtc/webln-types"
import {MemoryStorage} from "../core"
import {parseL402, type KVStorage} from "./utils"

const DEFAULT_HEADER_KEY = "L402"
const memoryStorage = new MemoryStorage()

type L402Options = {
  headerKey?: string
  webln?: WebLNProvider
  store?: KVStorage
}

type L402Cache = {
  token: string
  preimage: string
}

const parseCached = (value: string | undefined): L402Cache | undefined => {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value) as Partial<L402Cache>
    if (parsed.token && parsed.preimage) {
      return {token: parsed.token, preimage: parsed.preimage}
    }
  } catch {
    return undefined
  }
  return undefined
}

export const fetchWithL402 = async (
  url: string,
  fetchArgs: RequestInit = {},
  options: L402Options = {},
) => {
  const headerKey = options.headerKey || DEFAULT_HEADER_KEY
  const webln = options.webln || (globalThis as {webln?: WebLNProvider}).webln

  if (!webln) {
    throw new Error("WebLN is missing")
  }

  const store = options.store || memoryStorage
  const headers = new Headers(fetchArgs.headers || {})
  const requestInit: RequestInit = {
    ...fetchArgs,
    headers,
    cache: "no-store",
    mode: "cors",
  }

  const cached = parseCached(store.getItem(url))
  if (cached) {
    headers.set("Authorization", `${headerKey} ${cached.token}:${cached.preimage}`)
    return await fetch(url, requestInit)
  }

  headers.set("Accept-Authenticate", headerKey)
  const initResp = await fetch(url, requestInit)
  const header = initResp.headers.get("www-authenticate")

  if (!header) {
    return initResp
  }

  const details = parseL402(header)
  const token = details.token || details.macaroon
  const invoice = details.invoice

  if (!token || !invoice) {
    throw new Error("Invalid L402 challenge")
  }

  await webln.enable()
  const invoiceResponse = await webln.sendPayment(invoice)
  const preimage = invoiceResponse?.preimage

  if (!preimage) {
    throw new Error("Missing preimage from WebLN response")
  }

  store.setItem(url, JSON.stringify({token, preimage}))
  headers.set("Authorization", `${headerKey} ${token}:${preimage}`)

  return await fetch(url, requestInit)
}
