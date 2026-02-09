import {vi} from "vitest"

export const stubFetch = (
  impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = () =>
    Promise.reject(new Error("fetch not mocked")),
) => {
  const original = globalThis.fetch
  const mock = vi.fn(impl) as unknown as typeof fetch
  globalThis.fetch = mock

  return {
    mock,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

export const mockDateNow = (timestampMs: number) => {
  const spy = vi.spyOn(Date, "now").mockReturnValue(timestampMs)
  return () => spy.mockRestore()
}
