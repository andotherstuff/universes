const DIVISORS = {
  m: 1_000n,
  u: 1_000_000n,
  n: 1_000_000_000n,
  p: 1_000_000_000_000n,
}

const MAX_MILLISATS = 2_100_000_000_000_000_000n
const MILLISATS_PER_BTC = 100_000_000_000n

export const hrpToMillisats = (hrpAmount: string) => {
  if (!hrpAmount) {
    throw new Error("Missing amount")
  }

  let divisor: keyof typeof DIVISORS | undefined
  let value = hrpAmount

  const last = hrpAmount.slice(-1)
  if (/^[munp]$/.test(last)) {
    divisor = last as keyof typeof DIVISORS
    value = hrpAmount.slice(0, -1)
  } else if (/^[^0-9]$/.test(last)) {
    throw new Error("Invalid amount multiplier")
  }

  if (!/^\d+$/.test(value)) {
    throw new Error("Invalid amount value")
  }

  const valueBig = BigInt(value)

  const millisats = divisor
    ? (valueBig * MILLISATS_PER_BTC) / DIVISORS[divisor]
    : valueBig * MILLISATS_PER_BTC

  if (divisor === "p" && valueBig % 10n !== 0n) {
    throw new Error("Invalid pico bitcoin amount")
  }

  if (millisats > MAX_MILLISATS) {
    throw new Error("Amount is outside of valid range")
  }

  return millisats
}

export const millisatsToSats = (millisats: bigint) => Number(millisats / 1_000n)

export const parseHrpAmount = (hrp: string) => {
  const match = hrp.match(/^lnbc(\d+[munp]?)$/)
  if (!match) {
    if (hrp === "lnbc") return undefined
    throw new Error("Invalid bolt11 prefix")
  }

  const millisats = hrpToMillisats(match[1])

  return {
    millisats,
    satoshi: millisatsToSats(millisats),
  }
}
