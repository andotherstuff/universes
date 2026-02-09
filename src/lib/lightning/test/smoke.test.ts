import {describe, expect, it} from "vitest"
import {mockDateNow, stubFetch} from "./helpers"

describe("lightning test harness", () => {
  it("supports time and fetch helpers", async () => {
    const restoreDate = mockDateNow(1717171717171)
    expect(Date.now()).toBe(1717171717171)
    restoreDate()

    const {mock, restore} = stubFetch(async () => ({ok: true}) as Response)

    const response = await fetch("https://example.com")
    expect(response.ok).toBe(true)
    expect(mock).toHaveBeenCalledTimes(1)

    restore()
  })
})
