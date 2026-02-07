import {describe, expect, it} from "vitest"
import {resolveAmount} from "./Amount"

describe("resolveAmount", () => {
  it("resolves numeric amounts", async () => {
    await expect(resolveAmount(21)).resolves.toEqual({satoshi: 21, millisat: 21000})
  })

  it("resolves async satoshi values", async () => {
    const amount = {satoshi: Promise.resolve(42)}
    await expect(resolveAmount(amount)).resolves.toEqual({satoshi: 42, millisat: 42000})
  })
})
