export type KVStorage = {
  getItem: (key: string) => string | undefined
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export class MemoryStorage implements KVStorage {
  private store = new Map<string, string>()

  getItem(key: string) {
    return this.store.get(key)
  }

  setItem(key: string, value: string) {
    this.store.set(key, value)
  }

  removeItem(key: string) {
    this.store.delete(key)
  }
}
