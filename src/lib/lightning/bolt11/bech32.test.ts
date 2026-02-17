import {describe, expect, it} from "vitest"
import {bech32Decode, convertBits} from "./bech32"

describe("bech32", () => {
  it("decodes bolt11 invoices", () => {
    const invoice =
      "lnbc20u1p3y0x3hpp5743k2g0fsqqxj7n8qzuhns5gmkk4djeejk3wkp64ppevgekvc0jsdqcve5kzar2v9nr5gpqd4hkuetesp5ez2g297jduwc20t6lmqlsg3man0vf2jfd8ar9fh8fhn2g8yttfkqxqy9gcqcqzys9qrsgqrzjqtx3k77yrrav9hye7zar2rtqlfkytl094dsp0ms5majzth6gt7ca6uhdkxl983uywgqqqqlgqqqvx5qqjqrzjqd98kxkpyw0l9tyy8r8q57k7zpy9zjmh6sez752wj6gcumqnj3yxzhdsmg6qq56utgqqqqqqqqqqqeqqjq7jd56882gtxhrjm03c93aacyfy306m4fq0tskf83c0nmet8zc2lxyyg3saz8x6vwcp26xnrlagf9semau3qm2glysp7sv95693fphvsp54l567"

    const decoded = bech32Decode(invoice)

    expect(decoded.hrp).toBe("lnbc20u")
    expect(decoded.words.length).toBeGreaterThan(0)
  })

  it("converts bit groups", () => {
    const data = new Uint8Array([1, 2, 3])
    const words = convertBits(data, 8, 5, true)
    const restored = convertBits(words, 5, 8, false)

    expect(restored).toEqual([1, 2, 3])
  })
})
