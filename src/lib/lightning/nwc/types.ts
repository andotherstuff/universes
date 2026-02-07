export type Nip47EncryptionType = "nip04" | "nip44_v2"

export type Nip47Method =
  | "get_info"
  | "get_balance"
  | "make_invoice"
  | "pay_invoice"
  | (string & {})

export type Nip47GetInfoResponse = {
  alias?: string
  color?: string
  pubkey?: string
  network?: string
  block_height?: number
  block_hash?: string
  methods?: Nip47Method[]
  notifications?: string[]
  metadata?: unknown
  lud16?: string
}

export type Nip47GetBalanceResponse = {
  balance: number
}

export type Nip47PayInvoiceRequest = {
  invoice: string
  amount?: number
}

export type Nip47PayResponse = {
  preimage?: string
  fees_paid?: number
}

export type Nip47MakeInvoiceRequest = {
  amount: number
  description?: string
  description_hash?: string
  expiry?: number
}

export type Nip47Transaction = {
  invoice: string
  amount?: number
  description?: string
  payment_hash?: string
  preimage?: string
  created_at?: number
  expires_at?: number
}

export type Nip47TimeoutValues = {
  replyTimeout?: number
  publishTimeout?: number
}

export class Nip47Error extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

export class Nip47NetworkError extends Nip47Error {}

export class Nip47WalletError extends Nip47Error {}

export class Nip47TimeoutError extends Nip47Error {}
export class Nip47PublishTimeoutError extends Nip47TimeoutError {}
export class Nip47ReplyTimeoutError extends Nip47TimeoutError {}
export class Nip47PublishError extends Nip47Error {}
export class Nip47ResponseDecodingError extends Nip47Error {}
export class Nip47ResponseValidationError extends Nip47Error {}
export class Nip47UnsupportedEncryptionError extends Nip47Error {}
