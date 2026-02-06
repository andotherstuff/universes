import {afterEach, describe, expect, it, vi} from "vitest"
import type {WebLNProvider} from "@webbtc/webln-types"
import {sendBoostagram} from "./boostagrams"
import type {Boost} from "./types"

const boost: Boost = {
  action: "boost",
  value_msat: 42_000,
  value_msat_total: 42_000,
  app_name: "flotilla",
  app_version: "1.0.0",
  feedId: "feed-123",
  podcast: "pod",
  episode: "ep",
  ts: 123,
  name: "alice",
  sender_name: "alice",
}

const makeWebln = () => {
  return {
    enable: vi.fn().mockResolvedValue(undefined),
    keysend: vi.fn().mockResolvedValue({preimage: "abc"}),
  } as unknown as WebLNProvider
}

afterEach(() => {
  delete (globalThis as {webln?: WebLNProvider}).webln
})

describe("sendBoostagram", () => {
  it("sends boostagrams with custom records", async () => {
    const webln = makeWebln()

    await sendBoostagram(
      {
        destination: "dest",
        customKey: "999",
        customValue: "custom",
        boost,
      },
      {webln},
    )

    expect(webln.enable).toHaveBeenCalled()
    expect(webln.keysend).toHaveBeenCalledWith({
      destination: "dest",
      amount: Math.floor(boost.value_msat / 1000),
      customRecords: {
        "7629169": JSON.stringify(boost),
        "999": "custom",
      },
    })
  })

  it("requires keysend support", async () => {
    const webln = {enable: vi.fn().mockResolvedValue(undefined)} as unknown as WebLNProvider

    await expect(
      sendBoostagram(
        {
          destination: "dest",
          boost,
        },
        {webln},
      ),
    ).rejects.toThrow("Keysend not available")
  })
})
