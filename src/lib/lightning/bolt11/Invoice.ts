import {sha256Bytes, bytesToHex, hexToBytes} from "../core"
import {decodeInvoice} from "./decoder"
import type {InvoiceArgs, SuccessAction} from "./types"

export class Invoice {
  paymentRequest: string
  paymentHash: string
  preimage: string | undefined
  verify: string | undefined
  satoshi: number
  expiry: number | undefined
  timestamp: number
  createdDate: Date
  expiryDate: Date | undefined
  description: string | undefined
  successAction: SuccessAction | undefined

  constructor(args: InvoiceArgs) {
    this.paymentRequest = args.pr
    if (!this.paymentRequest) {
      throw new Error("Invalid payment request")
    }

    const decoded = decodeInvoice(this.paymentRequest)
    if (!decoded) {
      throw new Error("Failed to decode payment request")
    }

    this.paymentHash = decoded.paymentHash
    this.satoshi = decoded.satoshi
    this.timestamp = decoded.timestamp
    this.expiry = decoded.expiry
    this.createdDate = new Date(this.timestamp * 1000)
    this.expiryDate = this.expiry ? new Date((this.timestamp + this.expiry) * 1000) : undefined
    this.description = decoded.description
    this.verify = args.verify
    this.preimage = args.preimage
    this.successAction = args.successAction
  }

  async isPaid(): Promise<boolean> {
    if (this.preimage) return this.validatePreimage(this.preimage)
    if (this.verify) return this.verifyPayment()
    throw new Error("Could not verify payment")
  }

  validatePreimage(preimage: string): boolean {
    if (!preimage || !this.paymentHash) return false

    try {
      const preimageHash = bytesToHex(sha256Bytes(hexToBytes(preimage)))
      return this.paymentHash === preimageHash
    } catch {
      return false
    }
  }

  async verifyPayment(): Promise<boolean> {
    try {
      if (!this.verify) {
        throw new Error("LNURL verify not available")
      }
      const response = await fetch(this.verify)
      if (!response.ok) {
        throw new Error(`Verification request failed: ${response.status} ${response.statusText}`)
      }
      const json = (await response.json()) as {preimage?: string; settled?: boolean}
      if (json.preimage) {
        this.preimage = json.preimage
      }

      return Boolean(json.settled)
    } catch (error) {
      console.error("Failed to check LNURL-verify", error)
      return false
    }
  }

  hasExpired() {
    if (this.expiryDate) {
      return this.expiryDate.getTime() < Date.now()
    }
    return false
  }
}
