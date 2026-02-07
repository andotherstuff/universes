import {describe, expect, it} from "vitest"
import {stubFetch} from "../test/helpers"
import {
  getFiatBtcRate,
  getFiatCurrencies,
  getFiatValue,
  getFormattedFiatValue,
  getSatoshiValue,
} from "./fiat"

const mockedRateResponse = {
  code: "USD",
  symbol: "$",
  rate: "100000.00",
  rate_float: 100000,
  rate_cents: 10000000,
  USD: {
    code: "USD",
    symbol: "$",
    rate: "100000.00",
    rate_float: 100000,
    rate_cents: 10000000,
  },
}

const mockRawApiResponse = {
  usd: {
    iso_code: "USD",
    name: "United States Dollar",
    priority: 1,
    symbol: "$",
  },
  eur: {
    iso_code: "EUR",
    name: "Euro",
    priority: 2,
    symbol: "EUR",
  },
  gbp: {
    iso_code: "GBP",
    name: "British Pound",
    priority: 3,
    symbol: "GBP",
  },
  btc: {
    iso_code: "BTC",
    name: "Bitcoin",
    priority: 100,
    symbol: "BTC",
  },
}

const expectedOutput = [
  {code: "USD", name: "United States Dollar", priority: 1, symbol: "$"},
  {code: "EUR", name: "Euro", priority: 2, symbol: "EUR"},
  {code: "GBP", name: "British Pound", priority: 3, symbol: "GBP"},
]

const satsInBtc = 100_000_000
const rate = mockedRateResponse.rate_float

describe("getFiatCurrencies", () => {
  it("returns a sorted, filtered list of currency objects", async () => {
    const {restore} = stubFetch(async () => new Response(JSON.stringify(mockRawApiResponse)))

    const result = await getFiatCurrencies()

    expect(result).toEqual(expectedOutput)
    expect(result.find(currency => currency.code === "BTC")).toBeUndefined()

    restore()
  })

  it("throws on non-ok response", async () => {
    const {restore} = stubFetch(
      async () =>
        new Response(JSON.stringify({status: 500, error: "Internal Server Error"}), {
          status: 500,
          statusText: "Internal Server Error",
        }),
    )

    await expect(getFiatCurrencies()).rejects.toThrow(
      "Failed to fetch currencies: 500 Internal Server Error",
    )

    restore()
  })
})

describe("getFiatBtcRate", () => {
  it("returns btc to fiat rate", async () => {
    const {restore} = stubFetch(async () => new Response(JSON.stringify(mockedRateResponse)))

    const result = await getFiatBtcRate("usd")

    expect(result).toBe(rate / satsInBtc)

    restore()
  })

  it("throws on non-ok response", async () => {
    const {restore} = stubFetch(
      async () =>
        new Response(JSON.stringify({status: 404, error: "Not Found"}), {
          status: 404,
          statusText: "Not Found",
        }),
    )

    await expect(getFiatBtcRate("non_existent")).rejects.toThrow(
      "Failed to fetch rate: 404 Not Found",
    )

    restore()
  })
})

describe("getFiatValue", () => {
  it("converts sats to fiat", async () => {
    const {restore} = stubFetch(async () => new Response(JSON.stringify(mockedRateResponse)))

    const result = await getFiatValue({satoshi: 1000, currency: "USD"})

    expect(result).toBe(1000 * (rate / satsInBtc))

    restore()
  })
})

describe("getSatoshiValue", () => {
  it("converts fiat to sats", async () => {
    const {restore} = stubFetch(async () => new Response(JSON.stringify(mockedRateResponse)))

    const result = await getSatoshiValue({amount: 1, currency: "USD"})

    expect(result).toBe(Math.floor(1 / (rate / satsInBtc)))

    restore()
  })
})

describe("getFormattedFiatValue", () => {
  it("returns formatted fiat value", async () => {
    const {restore} = stubFetch(async () => new Response(JSON.stringify(mockedRateResponse)))

    const result = await getFormattedFiatValue({
      satoshi: 1000,
      currency: "USD",
      locale: "en-US",
    })

    expect(result).toBe(
      (1000 * (rate / satsInBtc)).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      }),
    )

    restore()
  })

  it("defaults to en locale when not provided", async () => {
    const {restore} = stubFetch(async () => new Response(JSON.stringify(mockedRateResponse)))

    const result = await getFormattedFiatValue({
      satoshi: 1000,
      currency: "USD",
      locale: "",
    })

    expect(result).toBe(
      (1000 * (rate / satsInBtc)).toLocaleString("en", {
        style: "currency",
        currency: "USD",
      }),
    )

    restore()
  })
})
