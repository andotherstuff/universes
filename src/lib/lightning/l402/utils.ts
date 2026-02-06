export type KVStorage = {
  getItem: (key: string) => string | undefined
  setItem: (key: string, value: string) => void
}

export class NoStorage implements KVStorage {
  getItem() {
    return undefined
  }

  setItem() {}
}

export const parseL402 = (input: string): Record<string, string> => {
  const cleaned = input.replace(/^(L402|LSAT)\s*/i, "").trim()
  const keyValuePairs: Record<string, string> = {}
  const regex = /(\w+)=(("([^"]*)")|('([^']*)')|([^,]*))/g
  let match

  while ((match = regex.exec(cleaned)) !== null) {
    const key = match[1]
    const value = match[4] || match[6] || match[7] || ""
    keyValuePairs[key] = value.trim()
  }

  return keyValuePairs
}
