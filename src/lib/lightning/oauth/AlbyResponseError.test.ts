import {describe, expect, it} from "vitest"
import {AlbyResponseError} from "./AlbyResponseError"

describe("AlbyResponseError", () => {
  it("builds a detailed error message", () => {
    const error = new AlbyResponseError(
      500,
      "Internal Server Error",
      new Headers(),
      new Error("Something went wrong"),
    )

    expect(error.message).toBe("500 Internal Server Error: Something went wrong")
  })
})
