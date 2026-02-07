import {AlbyResponseError} from "./AlbyResponseError"
import type {RequestOptions} from "./request"

export type SuccessStatus = 200 | 201
export type ResponseType = "application/json"

export type TokenRefreshedListener = (tokens: Token) => void
export type TokenRefreshFailedListener = (error: Error) => void
export type EventName = "tokenRefreshed" | "tokenRefreshFailed"
export type EventListener = TokenRefreshedListener | TokenRefreshFailedListener

export interface AuthHeader {
  Authorization: string
}

export interface GetTokenResponse {
  refresh_token?: string
  access_token?: string
  token_type?: string
  expires_in?: number
  scope?: string
}

export interface Token extends Omit<GetTokenResponse, "expires_in"> {
  expires_at?: number
}

export type GenerateAuthUrlOptions = {authorizeUrl?: string} & (
  | {
      code_challenge_method?: string
      code_challenge?: string
    }
  | {
      state?: string
      code_challenge_method: "S256"
    }
  | {
      state: string
      code_challenge: string
      code_challenge_method?: "plain"
    }
)

export abstract class OAuthClient implements AuthClient {
  abstract token?: Token
  abstract generateAuthURL(options: GenerateAuthUrlOptions): Promise<string>
  abstract requestAccessToken(code?: string): Promise<{token: Token}>
  abstract getAuthHeader(url?: string, method?: string): Promise<AuthHeader> | AuthHeader
}

export abstract class AuthClient {
  abstract getAuthHeader(url?: string, method?: string): Promise<AuthHeader> | AuthHeader
}

export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never

export type GetSuccess<T> = {
  [K in SuccessStatus & keyof T]: GetContent<T[K]>
}[SuccessStatus & keyof T]

export type AlbyResponse<T> = UnionToIntersection<ExtractAlbyResponse<T>>

export type GetContent<T> = "content" extends keyof T
  ? ResponseType extends keyof T["content"]
    ? T["content"][ResponseType]
    : never
  : never

export type ExtractAlbyResponse<T> = "responses" extends keyof T
  ? GetSuccess<T["responses"]>
  : never

export type GetInvoicesRequestParams = {
  q?: {
    since?: string
    before?: string
    created_at_lt?: number
    created_at_gt?: number
  }
  page?: number
  items?: number
}

export type InvoiceRequestParams = {
  description?: string
  description_hash?: string
  amount: number
}

export type KeysendRequestParams = {
  amount: number
  destination: string
  memo?: string
  customRecords?: Record<string, string>
}

export type SendPaymentRequestParams = {
  invoice: string
  amount?: number
}

export type SendBoostagramRequestParams = {
  recipient: {
    address: string
    customKey?: string
    customValue?: string
  }
  boostagram: unknown
  amount: number
}

export type SendBoostagramToAlbyRequestParams = {
  account: string
  amount: number
  memo?: string
}

export type CreateWebhookEndpointParams = {
  url: string
  description?: string
  filter_types: string[]
}

export type BaseWebhookEndpointResponse = {
  url: string
  description?: string
  filter_types: string[]
  created_at: string
  id: string
}

export type SwapInfoResponse = {
  available: boolean
  service_fee_percentage: number
  network_fee: number
  sats_per_vbyte: number
}

export type CreateSwapParams = {
  amount: number
  address: string
  sats_per_vbyte: number
}

export type CreateSwapResponse = {
  address: string
  service_fee: number
  network_fee: number
  amount: number
  total: number
  payment_request: string
}

export type CreateWebhookEndpointResponse = BaseWebhookEndpointResponse & {
  endpoint_secret: string
}

export type Invoice = {
  amount: number
  boostagram?: {
    podcast: string
    feedID?: number
    itemID: number
    episode: string
    ts: number
    action: string
    app_name: string
    app_version: string
    value_msat: number
    value_msat_total: number
    name: string
    message: string
    sender_name: string
    episode_guid?: string
    boost_link?: string
    url?: string
    guid?: string
  }
  comment?: string
  description: string
  description_hash?: string
  expires_at: number
  fee: number
  fees_paid: number
  fulfilled: boolean
  identifier: string
  memo: string
  payment_hash: string
  payment_request: string
  preimage: string
  settled_at: number | null
  settled_at_seconds: number | null
  type: string
  value: number
  value_msat: number
  created_at: number
  comment_allowed?: number
  payer_data?: {
    name?: string
    pubkey?: string
    identifier?: string
    email?: string
  }
  node?: {
    alias?: string
    public_key?: string
  }
}

export type DecodedInvoice = {
  amount: number
  created_at: number
  description: string
  expires_at: number
  payment_hash: string
  payment_request: string
}

export type GetAccountInformationResponse = {
  identifier: string
  email: string
  name?: string
  avatar?: string
  pubkey?: string
  created_at?: number
  updated_at?: number
  keysend_custom_key?: string
  keysend_custom_value?: string
  keysend_pubkey?: string
  lightning_address?: string
  nostr_pubkey?: string
}

export type GetAccountBalanceResponse = {
  balance: number
  currency?: string
  unit?: string
}

export type SendPaymentResponse = {
  amount?: number
  description?: string
  destination?: string
  fee?: number
  payment_hash?: string
  payment_preimage?: string
  payment_request?: string
  preimage?: string
  fees_paid?: number
}

export type SignMessageRequestParams = {
  message: string
}

export type SignMessageResponse = {
  message: string
  signature: string
}

export type AlbyClientRequestOptions = Omit<RequestOptions, "auth">

export type AlbyRequest = {
  endpoint: string
  method: string
  params?: Record<string, unknown>
  request_body?: Record<string, unknown>
}

export type AlbyRequestError = AlbyResponseError
