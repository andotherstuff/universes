import type {WebLNProvider} from "@webbtc/webln-types"
import type {BoostArguments, BoostOptions, WeblnBoostParams} from "./types"

const BOOST_RECORD_TYPE = "7629169"

const resolveWebln = (options: BoostOptions): WebLNProvider | undefined => {
  return options.webln || (globalThis as {webln?: WebLNProvider}).webln
}

export const sendBoostagram = async (args: BoostArguments, options: BoostOptions = {}) => {
  const {boost} = args
  const webln = resolveWebln(options)

  if (!webln) {
    throw new Error("WebLN not available")
  }
  if (!webln.keysend) {
    throw new Error("Keysend not available in current WebLN provider")
  }

  const defaultAmount = Math.floor(boost.value_msat / 1000)
  const amount = typeof args.amount === "number" && args.amount > 0 ? args.amount : defaultAmount

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid boost amount")
  }

  const weblnParams: WeblnBoostParams = {
    destination: args.destination,
    amount,
    customRecords: {
      [BOOST_RECORD_TYPE]: JSON.stringify(boost),
    },
  }

  if (args.customKey && args.customValue) {
    weblnParams.customRecords[args.customKey] = args.customValue
  }

  await webln.enable()
  return await webln.keysend(weblnParams)
}
