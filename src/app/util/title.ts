import {PLATFORM_NAME} from "@app/core/state"

const FALLBACK_APP_NAME = "Flotilla"

const normalize = (value: string) => value.trim()

export const makeTitle = (...parts: Array<string | undefined>) => {
  const title = parts
    .map(part => (part || "").trim())
    .filter(part => part.length > 0)
    .join(" · ")

  return title || normalize(PLATFORM_NAME || FALLBACK_APP_NAME)
}
