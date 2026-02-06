import {describe, expect, it} from "vitest"
import {LightningInputError, MemoryStorage, requireDefined} from "./index"

describe("core storage", () => {
  it("stores and removes values", () => {
    const storage = new MemoryStorage()

    storage.setItem("key", "value")
    expect(storage.getItem("key")).toBe("value")

    storage.removeItem("key")
    expect(storage.getItem("key")).toBeUndefined()
  })
})

describe("core guards", () => {
  it("requires defined values", () => {
    expect(requireDefined("ok", "missing")).toBe("ok")
    expect(() => requireDefined(undefined, "missing")).toThrow(LightningInputError)
  })
})
