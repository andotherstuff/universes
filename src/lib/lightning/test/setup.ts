import {afterEach, vi} from "vitest"

const originalFetch: typeof fetch | undefined = globalThis.fetch

afterEach(() => {
  if (globalThis.fetch !== originalFetch) {
    globalThis.fetch = originalFetch as typeof fetch
  }

  vi.restoreAllMocks()
})
