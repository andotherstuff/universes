import type {SendBoostagramRequestParams} from "./types"

export function keysendParamsFromBoostagram(boostagramParams: SendBoostagramRequestParams) {
  const customRecords: Record<string, string> = {}

  if (boostagramParams.recipient.customKey && boostagramParams.recipient.customValue) {
    customRecords[boostagramParams.recipient.customKey] = boostagramParams.recipient.customValue
  }

  customRecords["7629169"] = JSON.stringify(boostagramParams.boostagram)

  return {
    destination: boostagramParams.recipient.address,
    amount: boostagramParams.amount,
    custom_records: customRecords,
  }
}
