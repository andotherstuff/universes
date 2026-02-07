export type Nip47EncryptionType = "nip04" | "nip44_v2"

export type NWCAuthorizationUrlOptions = {
  name?: string
  icon?: string
  requestMethods?: Nip47Method[]
  notificationTypes?: Nip47NotificationType[]
  returnTo?: string
  expiresAt?: Date
  maxAmount?: number
  budgetRenewal?: "never" | "daily" | "weekly" | "monthly" | "yearly"
  isolated?: boolean
  metadata?: unknown
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
export class Nip47UnexpectedResponseError extends Nip47Error {}
export class Nip47UnsupportedEncryptionError extends Nip47Error {}

export type WithDTag = {
  dTag: string
}

export type WithOptionalId = {
  id?: string
}

export type Nip47SingleMethod =
  | "get_info"
  | "get_balance"
  | "get_budget"
  | "make_invoice"
  | "pay_invoice"
  | "pay_keysend"
  | "lookup_invoice"
  | "list_transactions"
  | "sign_message"
  | "create_connection"
  | "make_hold_invoice"
  | "settle_hold_invoice"
  | "cancel_hold_invoice"

export type Nip47MultiMethod = "multi_pay_invoice" | "multi_pay_keysend"

export type Nip47Method = Nip47SingleMethod | Nip47MultiMethod
export type Nip47Capability = Nip47Method | "notifications"
export type BudgetRenewalPeriod = "daily" | "weekly" | "monthly" | "yearly" | "never"

export type Nip47GetInfoResponse = {
  alias: string
  color: string
  pubkey: string
  network: string
  block_height: number
  block_hash: string
  methods: Nip47Method[]
  notifications?: Nip47NotificationType[]
  metadata?: unknown
  lud16?: string
}

export type Nip47GetBudgetResponse =
  | {
      used_budget: number
      total_budget: number
      renews_at?: number
      renewal_period: BudgetRenewalPeriod
    }
  | Record<string, never>

export type Nip47GetBalanceResponse = {
  balance: number
}

export type Nip47PayResponse = {
  preimage: string
  fees_paid: number
}

export type Nip47MultiPayInvoiceRequest = {
  invoices: (Nip47PayInvoiceRequest & WithOptionalId)[]
}

export type Nip47MultiPayKeysendRequest = {
  keysends: (Nip47PayKeysendRequest & WithOptionalId)[]
}

export type Nip47MultiPayInvoiceResponse = {
  invoices: ({invoice: Nip47PayInvoiceRequest} & Nip47PayResponse & WithDTag)[]
  errors: []
}
export type Nip47MultiPayKeysendResponse = {
  keysends: ({keysend: Nip47PayKeysendRequest} & Nip47PayResponse & WithDTag)[]
  errors: []
}

export interface Nip47ListTransactionsRequest {
  from?: number
  until?: number
  limit?: number
  offset?: number
  unpaid?: boolean
  unpaid_outgoing?: boolean
  unpaid_incoming?: boolean
  type?: "incoming" | "outgoing"
}

export type Nip47ListTransactionsResponse = {
  transactions: Nip47Transaction[]
  total_count: number
}

export type Nip47Transaction = {
  type: "incoming" | "outgoing"
  state: "settled" | "pending" | "failed" | "accepted"
  invoice: string
  description: string
  description_hash: string
  preimage: string
  payment_hash: string
  amount: number
  fees_paid: number
  settled_at: number
  created_at: number
  expires_at: number
  settle_deadline?: number
  metadata?: Nip47TransactionMetadata
}

export type Nip47TransactionMetadata = {
  comment?: string
  payer_data?: {
    email?: string
    name?: string
    pubkey?: string
  }
  recipient_data?: {
    identifier?: string
  }
  nostr?: {
    pubkey: string
    tags: string[][]
  }
} & Record<string, unknown>

export type Nip47NotificationType = Nip47Notification["notification_type"]

export type Nip47Notification =
  | {
      notification_type: "payment_received"
      notification: Nip47Transaction
    }
  | {
      notification_type: "payment_sent"
      notification: Nip47Transaction
    }
  | {
      notification_type: "hold_invoice_accepted"
      notification: Nip47Transaction
    }

export type Nip47PayInvoiceRequest = {
  invoice: string
  metadata?: Nip47TransactionMetadata
  amount?: number
}

export type Nip47PayKeysendRequest = {
  amount: number
  pubkey: string
  preimage?: string
  tlv_records?: {type: number; value: string}[]
}

export type Nip47MakeInvoiceRequest = {
  amount: number
  description?: string
  description_hash?: string
  expiry?: number
  metadata?: Nip47TransactionMetadata
}

export type Nip47MakeHoldInvoiceRequest = Nip47MakeInvoiceRequest & {
  payment_hash: string
}

export type Nip47SettleHoldInvoiceRequest = {
  preimage: string
}

export type Nip47SettleHoldInvoiceResponse = Record<string, never>

export type Nip47CancelHoldInvoiceRequest = {
  payment_hash: string
}

export type Nip47CancelHoldInvoiceResponse = Record<string, never>

export type Nip47LookupInvoiceRequest = {
  payment_hash?: string
  invoice?: string
}

export type Nip47SignMessageRequest = {
  message: string
}

export type Nip47CreateConnectionRequest = {
  pubkey: string
  name: string
  request_methods: Nip47Method[]
  notification_types?: Nip47NotificationType[]
  max_amount?: number
  budget_renewal?: BudgetRenewalPeriod
  expires_at?: number
  isolated?: boolean
  metadata?: unknown
}

export type Nip47CreateConnectionResponse = {
  wallet_pubkey: string
}

export type Nip47SignMessageResponse = {
  message: string
  signature: string
}

export type Nip47TimeoutValues = {
  replyTimeout?: number
  publishTimeout?: number
}
