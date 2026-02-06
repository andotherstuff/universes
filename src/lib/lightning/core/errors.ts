export type LightningErrorCode =
  | "invalid_input"
  | "network"
  | "timeout"
  | "unsupported"
  | "internal"

export class LightningError extends Error {
  code: LightningErrorCode
  cause: unknown

  constructor(message: string, code: LightningErrorCode, cause?: unknown) {
    super(message)
    this.code = code
    this.cause = cause
  }
}

export class LightningNetworkError extends LightningError {
  constructor(message: string, cause?: unknown) {
    super(message, "network", cause)
  }
}

export class LightningTimeoutError extends LightningError {
  constructor(message: string, cause?: unknown) {
    super(message, "timeout", cause)
  }
}

export class LightningUnsupportedError extends LightningError {
  constructor(message: string, cause?: unknown) {
    super(message, "unsupported", cause)
  }
}

export class LightningInputError extends LightningError {
  constructor(message: string, cause?: unknown) {
    super(message, "invalid_input", cause)
  }
}
