export class NormalizationError extends Error {
  readonly code: string

  constructor(
    code: string,
    message: string,
    readonly trackingNumber?: string,
  ) {
    super(message)
    this.name = 'NormalizationError'
    this.code = code
  }
}
