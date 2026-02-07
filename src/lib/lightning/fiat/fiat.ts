import {fetchWithTimeout} from "../core"

const SATS_PER_BTC = 100_000_000
const RATES_URL = "https://getalby.com/api/rates"

export type FiatCurrency = {
  code: string
  name: string
  symbol: string
  priority: number
}

type FiatRatesEntry = {
  name: string
  symbol: string
  priority: number
}

type FiatRatesResponse = Record<string, FiatRatesEntry>

type FiatRateResponse = {
  rate_float?: number
}

export const getFiatCurrencies = async (): Promise<FiatCurrency[]> => {
  const response = await fetchWithTimeout(RATES_URL)

  if (!response.ok) {
    throw new Error(`Failed to fetch currencies: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as FiatRatesResponse

  const mappedCurrencies: FiatCurrency[] = Object.entries(data)
    .filter(([code]) => code.toUpperCase() !== "BTC")
    .map(([code, details]) => ({
      code: code.toUpperCase(),
      name: details.name,
      priority: details.priority,
      symbol: details.symbol,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .sort((a, b) => a.priority - b.priority)

  return mappedCurrencies
}

export const getFiatBtcRate = async (currency: string): Promise<number> => {
  const response = await fetchWithTimeout(`${RATES_URL}/${currency.toLowerCase()}.json`)

  if (!response.ok) {
    throw new Error(`Failed to fetch rate: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as FiatRateResponse

  if (!data.rate_float) {
    throw new Error("Rate data missing")
  }

  return data.rate_float / SATS_PER_BTC
}

export const getFiatValue = async ({
  satoshi,
  currency,
}: {
  satoshi: number | string
  currency: string
}) => {
  const rate = await getFiatBtcRate(currency)

  return Number(satoshi) * rate
}

export const getSatoshiValue = async ({
  amount,
  currency,
}: {
  amount: number | string
  currency: string
}) => {
  const rate = await getFiatBtcRate(currency)

  return Math.floor(Number(amount) / rate)
}

export const getFormattedFiatValue = async ({
  satoshi,
  currency,
  locale,
}: {
  satoshi: number | string
  currency: string
  locale: string
}) => {
  const resolvedLocale = locale || "en"
  const fiatValue = await getFiatValue({satoshi, currency})

  return fiatValue.toLocaleString(resolvedLocale, {
    style: "currency",
    currency,
  })
}
