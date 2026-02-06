import {describe, expect, it} from "vitest"
import {stubFetch} from "../test/helpers"
import {fetchWithPolicy, fetchWithTimeout} from "./fetch"

describe("fetchWithTimeout", () => {
  it("returns the response", async () => {
    const {mock, restore} = stubFetch(async () => new Response("ok"))

    const response = await fetchWithTimeout("https://example.com")

    expect(response.ok).toBe(true)
    expect(mock).toHaveBeenCalledTimes(1)

    restore()
  })
})

describe("fetchWithPolicy", () => {
  it("retries on failure", async () => {
    let attempts = 0
    const {mock, restore} = stubFetch(async () => {
      attempts += 1
      if (attempts === 1) {
        throw new Error("network")
      }
      return new Response("ok")
    })

    const response = await fetchWithPolicy(
      "https://example.com",
      {},
      {retryCount: 1, retryDelayMs: 0},
    )

    expect(response.ok).toBe(true)
    expect(mock).toHaveBeenCalledTimes(2)

    restore()
  })
})
