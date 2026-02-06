import {describe, expect, it} from "vitest"
import type {WebLNProvider} from "@webbtc/webln-types"
import {MemoryStorage} from "../core"
import {stubFetch} from "../test/helpers"
import {fetchWithL402} from "./l402"

describe("fetchWithL402", () => {
  it("uses cached authorization data", async () => {
    const url = "https://example.com/resource"
    const store = new MemoryStorage()
    store.setItem(url, JSON.stringify({token: "tok", preimage: "pre"}))

    const {mock, restore} = stubFetch(async (_input, init) => {
      const headers = new Headers(init?.headers)
      expect(headers.get("Authorization")).toBe("L402 tok:pre")
      expect(headers.get("Accept-Authenticate")).toBeNull()
      return new Response("ok")
    })

    const response = await fetchWithL402(url, {}, {store, webln: {} as WebLNProvider})

    expect(response.ok).toBe(true)
    expect(mock).toHaveBeenCalledTimes(1)

    restore()
  })
})
