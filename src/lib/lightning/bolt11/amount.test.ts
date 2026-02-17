import {describe, expect, it} from "vitest"
import {hrpToMillisats, parseHrpAmount} from "./amount"

describe("bolt11 amount parsing", () => {
  it("parses hrp amounts", () => {
    expect(hrpToMillisats("20u")).toBe(2_000_000n)
    expect(hrpToMillisats("1m")).toBe(100_000_000n)
  })

  it("parses bolt11 hrp", () => {
    const parsed = parseHrpAmount("lnbc20u")
    expect(parsed?.millisats).toBe(2_000_000n)
    expect(parsed?.satoshi).toBe(2000)
    expect(parseHrpAmount("lnbc")).toBeUndefined()
  })
})
