import {LightningInputError} from "./errors"

export const requireDefined = <T>(value: T | undefined, message: string): T => {
  if (value === undefined) {
    throw new LightningInputError(message)
  }
  return value
}
