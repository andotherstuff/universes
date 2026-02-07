export function buildQueryString(query: Record<string, unknown>): string {
  const build = (obj: Record<string, unknown>, prefix?: string): string[] => {
    return Object.entries(obj).flatMap(([key, value]) => {
      const paramKey = prefix ? `${prefix}[${key}]` : key

      if (value && typeof value === "object" && !Array.isArray(value)) {
        return build(value as Record<string, unknown>, paramKey)
      }

      return value !== undefined && value !== null ? `${paramKey}=${value}` : []
    })
  }

  return build(query).join("&")
}

export function basicAuthHeader(clientId: string, clientSecret: string | undefined) {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`
}

export const toHexString = (bytes: Uint8Array) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "")
