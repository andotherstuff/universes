import {isNWCWallet, isWebLNWallet, type Wallet} from "@welshman/util"
import {NWCWallet} from "./NWCWallet"
import {WebLNWallet, getWebLn} from "./WebLNWallet"
import type {IWallet} from "./IWallet"

export const createWalletAdapter = (wallet: Wallet): IWallet => {
  if (isNWCWallet(wallet)) {
    return new NWCWallet(wallet.info)
  }

  if (isWebLNWallet(wallet)) {
    return new WebLNWallet(getWebLn())
  }

  throw new Error("Unsupported wallet type")
}
