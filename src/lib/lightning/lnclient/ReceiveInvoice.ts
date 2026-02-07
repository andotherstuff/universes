import {Invoice} from "../bolt11"
import {NWCClient, type Nip47Notification, type Nip47Transaction} from "../nwc"

export class ReceiveInvoice {
  readonly transaction: Nip47Transaction
  readonly invoice: Invoice
  private _nwcClient: NWCClient
  private _unsubscribeFunc?: () => void
  private _timeoutFunc?: () => void
  private _timeoutId?: number | NodeJS.Timeout

  constructor(nwcClient: NWCClient, transaction: Nip47Transaction) {
    this.transaction = transaction
    this.invoice = new Invoice({pr: transaction.invoice})
    this._nwcClient = nwcClient
  }

  onPaid(callback: (receivedPayment: Nip47Transaction) => void): ReceiveInvoice {
    ;(async () => {
      let supportsNotifications
      try {
        const info = await this._nwcClient.getInfo()
        supportsNotifications = info.notifications?.includes("payment_received")
      } catch (error) {
        console.error("failed to fetch info, falling back to polling")
      }

      const callbackWrapper = (receivedPayment: Nip47Transaction) => {
        this._unsubscribeFunc?.()
        callback(receivedPayment)
      }

      const unsubscribeWrapper = (unsubscribe: () => void) => {
        return () => {
          this._timeoutFunc = undefined
          clearTimeout(this._timeoutId)
          unsubscribe()
        }
      }

      if (!supportsNotifications) {
        console.warn("current connection does not support notifications, falling back to polling")
        this._unsubscribeFunc = unsubscribeWrapper(this._onPaidPollingFallback(callbackWrapper))
      } else {
        const onNotification = (notification: Nip47Notification) => {
          if (notification.notification.payment_hash === this.transaction.payment_hash) {
            callbackWrapper(notification.notification)
          }
        }

        this._unsubscribeFunc = unsubscribeWrapper(
          await this._nwcClient.subscribeNotifications(onNotification, ["payment_received"]),
        )
      }
    })()

    return this
  }

  onTimeout(seconds: number, callback: () => void): ReceiveInvoice {
    this._timeoutFunc = () => {
      this._unsubscribeFunc?.()
      callback()
    }
    this._timeoutId = setTimeout(() => {
      this._timeoutFunc?.()
    }, seconds * 1000)

    return this
  }

  unsubscribe() {
    this._unsubscribeFunc?.()
  }

  private _onPaidPollingFallback(callback: (receivedPayment: Nip47Transaction) => void) {
    let subscribed = true
    const unsubscribeFunc = () => {
      subscribed = false
    }

    ;(async () => {
      while (subscribed) {
        const transaction = await this._nwcClient.lookupInvoice({
          payment_hash: this.transaction.payment_hash,
        })
        if (transaction.settled_at && transaction.preimage) {
          callback(transaction)
          subscribed = false
          break
        }
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    })()

    return unsubscribeFunc
  }
}
