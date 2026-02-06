import {LightningTimeoutError} from "./errors"

export type FetchPolicy = {
  timeoutMs?: number
  retryCount?: number
  retryDelayMs?: number
  retryOn?: (response: Response | undefined, error: unknown) => boolean
}

const defaultRetryOn = (response: Response | undefined, error: unknown) => {
  if (error) return true
  if (!response) return false
  return response.status >= 500
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const mergeSignals = (signal: AbortSignal | null | undefined, controller: AbortController) => {
  if (!signal) return
  if (signal.aborted) {
    controller.abort()
    return
  }
  signal.addEventListener(
    "abort",
    () => {
      controller.abort()
    },
    {once: true},
  )
}

export const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 10000,
) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  mergeSignals(init.signal, controller)

  try {
    return await fetch(input, {...init, signal: controller.signal})
  } catch (error) {
    if ((error as {name?: string}).name === "AbortError") {
      throw new LightningTimeoutError("Request timed out", error)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export const fetchWithPolicy = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  policy: FetchPolicy = {},
) => {
  const timeoutMs = policy.timeoutMs ?? 10000
  const retryCount = policy.retryCount ?? 0
  const retryDelayMs = policy.retryDelayMs ?? 250
  const retryOn = policy.retryOn ?? defaultRetryOn

  let attempt = 0
  let lastError: unknown

  while (attempt <= retryCount) {
    try {
      const response = await fetchWithTimeout(input, init, timeoutMs)
      if (retryOn(response, undefined) && attempt < retryCount) {
        attempt += 1
        await sleep(retryDelayMs)
        continue
      }
      return response
    } catch (error) {
      lastError = error
      if (!retryOn(undefined, error) || attempt >= retryCount) {
        throw error
      }
      attempt += 1
      await sleep(retryDelayMs)
    }
  }

  throw lastError
}
