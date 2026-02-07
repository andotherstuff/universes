export type Amount = number | {satoshi: number | Promise<number>}

export const SATS = (amount: number): Amount => ({
  satoshi: amount,
})

export async function resolveAmount(amount: Amount): Promise<{satoshi: number; millisat: number}> {
  if (typeof amount === "number") {
    return {
      satoshi: amount,
      millisat: amount * 1000,
    }
  }

  const satoshi = await Promise.resolve(amount.satoshi)

  return {
    satoshi,
    millisat: satoshi * 1000,
  }
}
