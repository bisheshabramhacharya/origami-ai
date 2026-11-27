/** The checks a fold can fail. Each failure names the check. */
export type FoldCheck =
  | 'schema'
  | 'references'
  | 'axiom'
  | 'no-stretch'
  | 'maekawa'
  | 'kawasaki'
  | 'layers'
  | 'grounded'

export interface FoldIssue {
  check: FoldCheck
  message: string
  /** The named point, crease, vertex or face the issue is about, when there is one. */
  at?: string
}

/** A fold check failed. The sequence runner adds the Step and the action. */
export class FoldCheckError extends Error {
  readonly check: FoldCheck
  readonly at?: string

  constructor(check: FoldCheck, message: string, at?: string) {
    super(message)
    this.name = 'FoldCheckError'
    this.check = check
    this.at = at
  }

  toIssue(): FoldIssue {
    return this.at === undefined ? { check: this.check, message: this.message } : { check: this.check, message: this.message, at: this.at }
  }
}

export function fail(check: FoldCheck, message: string, at?: string): never {
  throw new FoldCheckError(check, message, at)
}
