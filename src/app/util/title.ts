import {PLATFORM_NAME} from "@app/core/state"

const FALLBACK_APP_NAME = "Universes"
const TITLE_SEPARATOR = " - "

const normalize = (value: string) => value.trim()

export const makeTitle = (...parts: Array<string | undefined | null>) => {
  const seen = new Set<string>()
  const items: string[] = []

  for (const part of parts) {
    if (!part) continue

    const normalized = normalize(part)

    if (!normalized) continue

    const key = normalized.toLowerCase()

    if (seen.has(key)) continue

    seen.add(key)
    items.push(normalized)
  }

  const appName = normalize(PLATFORM_NAME || FALLBACK_APP_NAME)
  const appKey = appName.toLowerCase()

  if (appName && !seen.has(appKey)) {
    items.push(appName)
  }

  return items.join(TITLE_SEPARATOR) || appName
}
