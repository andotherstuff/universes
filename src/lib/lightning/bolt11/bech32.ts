const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"

const CHARSET_REV = new Map<string, number>(CHARSET.split("").map((char, index) => [char, index]))

const GENERATORS = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]

const hrpExpand = (hrp: string) => {
  const result: number[] = []
  for (let i = 0; i < hrp.length; i += 1) {
    const code = hrp.charCodeAt(i)
    result.push(code >> 5)
  }
  result.push(0)
  for (let i = 0; i < hrp.length; i += 1) {
    const code = hrp.charCodeAt(i)
    result.push(code & 31)
  }
  return result
}

const polymod = (values: number[]) => {
  let chk = 1
  for (const value of values) {
    const top = chk >> 25
    chk = ((chk & 0x1ffffff) << 5) ^ value
    for (let i = 0; i < GENERATORS.length; i += 1) {
      if (((top >> i) & 1) !== 0) {
        chk ^= GENERATORS[i]
      }
    }
  }
  return chk
}

const verifyChecksum = (hrp: string, data: number[]) => polymod([...hrpExpand(hrp), ...data]) === 1

export const bech32Decode = (input: string) => {
  if (input.length < 8) {
    throw new Error("Invalid bech32 length")
  }

  const lower = input.toLowerCase()
  const upper = input.toUpperCase()
  if (input !== lower && input !== upper) {
    throw new Error("Invalid bech32 casing")
  }

  const normalized = lower
  const separator = normalized.lastIndexOf("1")
  if (separator < 1 || separator + 7 > normalized.length) {
    throw new Error("Invalid bech32 separator")
  }

  const hrp = normalized.slice(0, separator)
  const dataPart = normalized.slice(separator + 1)
  const data: number[] = []

  for (const char of dataPart) {
    const value = CHARSET_REV.get(char)
    if (value === undefined) {
      throw new Error("Invalid bech32 character")
    }
    data.push(value)
  }

  if (!verifyChecksum(hrp, data)) {
    throw new Error("Invalid bech32 checksum")
  }

  return {
    hrp,
    words: data.slice(0, -6),
  }
}

export const convertBits = (
  data: number[] | Uint8Array,
  fromBits: number,
  toBits: number,
  pad: boolean,
) => {
  let acc = 0
  let bits = 0
  const result: number[] = []
  const maxValue = (1 << toBits) - 1

  for (const value of data) {
    if (value < 0 || value >> fromBits !== 0) {
      throw new Error("Invalid value for conversion")
    }
    acc = (acc << fromBits) | value
    bits += fromBits
    while (bits >= toBits) {
      bits -= toBits
      result.push((acc >> bits) & maxValue)
    }
  }

  if (pad) {
    if (bits > 0) {
      result.push((acc << (toBits - bits)) & maxValue)
    }
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxValue) !== 0) {
    throw new Error("Invalid padding")
  }

  return result
}
