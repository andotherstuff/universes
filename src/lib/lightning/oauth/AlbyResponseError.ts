export class AlbyResponseError extends Error {
  status: number
  statusText: string
  headers: Headers
  error: unknown

  constructor(status: number, statusText: string, headers: Headers, error: unknown) {
    let message = status.toString()
    if (statusText) {
      message += ` ${statusText}`
    }
    message += ": "

    if (error && typeof error === "object" && "message" in error) {
      message += String((error as {message?: unknown}).message)
    } else {
      message += JSON.stringify(error)
    }

    super(message)
    this.status = status
    this.statusText = statusText
    this.headers = headers
    this.error = error
  }
}
