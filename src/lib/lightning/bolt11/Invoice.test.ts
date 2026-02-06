import {describe, expect, it} from "vitest"
import {mockDateNow} from "../test/helpers"
import {Invoice} from "./Invoice"

describe("Invoice", () => {
  const invoiceString =
    "lnbc20u1p3y0x3hpp5743k2g0fsqqxj7n8qzuhns5gmkk4djeejk3wkp64ppevgekvc0jsdqcve5kzar2v9nr5gpqd4hkuetesp5ez2g297jduwc20t6lmqlsg3man0vf2jfd8ar9fh8fhn2g8yttfkqxqy9gcqcqzys9qrsgqrzjqtx3k77yrrav9hye7zar2rtqlfkytl094dsp0ms5majzth6gt7ca6uhdkxl983uywgqqqqlgqqqvx5qqjqrzjqd98kxkpyw0l9tyy8r8q57k7zpy9zjmh6sez752wj6gcumqnj3yxzhdsmg6qq56utgqqqqqqqqqqqeqqjq7jd56882gtxhrjm03c93aacyfy306m4fq0tskf83c0nmet8zc2lxyyg3saz8x6vwcp26xnrlagf9semau3qm2glysp7sv95693fphvsp54l567"

  it("parses invoice data", () => {
    const invoice = new Invoice({pr: invoiceString})

    expect(invoice.satoshi).toBe(2000)
    expect(invoice.description).toBe("fiatjaf:  money")
    expect(invoice.paymentHash).toBe(
      "f5636521e98000697a6700b979c288ddad56cb3995a2eb07550872c466ccc3e5",
    )
  })

  it("tracks expiry", () => {
    const invoice = new Invoice({pr: invoiceString})

    const restoreBefore = mockDateNow(invoice.timestamp * 1000)
    expect(invoice.hasExpired()).toBe(false)
    restoreBefore()

    const restoreAfter = mockDateNow((invoice.timestamp + (invoice.expiry ?? 0) + 1) * 1000)
    expect(invoice.hasExpired()).toBe(true)
    restoreAfter()
  })

  it("validates preimages", () => {
    const invoice = new Invoice({pr: invoiceString})
    expect(invoice.validatePreimage("00")).toBe(false)
    expect(invoice.validatePreimage("not-hex")).toBe(false)
  })
})
