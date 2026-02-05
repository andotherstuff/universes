import {PLATFORM_NAME} from "@app/core/state"

const FALLBACK_APP_NAME = "Universes"

const normalize = (value: string) => value.trim()

export const makeTitle = (...parts: Array<string | undefined>) => {
  const items = parts.map(part => (part ? normalize(part) : "")).filter(part => part.length > 0)

  if (items.length === 0) {
    return normalize(PLATFORM_NAME || FALLBACK_APP_NAME)
  }

  if (items.length === 1) {
    return items[0]
  }

  return items.join(" · ")
}
