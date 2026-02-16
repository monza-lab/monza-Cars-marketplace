const CONNECTIVITY_CODES = new Set([
  'P1001',
  'P1011',
  'EHOSTUNREACH',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
])

const CONNECTIVITY_PATTERNS = [
  'connection terminated unexpectedly',
  'self-signed certificate',
  "can't reach database server",
  'tenant or user not found',
  'ehostunreach',
  'econnrefused',
  'enotfound',
  'etimedout',
  'timeout exceeded when trying to connect',
]

export function isDbConnectivityError(error: unknown): boolean {
  let current = error as { code?: unknown; message?: unknown; cause?: unknown } | undefined

  for (let depth = 0; depth < 4 && current; depth += 1) {
    const code = typeof current.code === 'string' ? current.code.toUpperCase() : ''
    const message = typeof current.message === 'string' ? current.message.toLowerCase() : ''

    if (CONNECTIVITY_CODES.has(code)) {
      return true
    }

    if (CONNECTIVITY_PATTERNS.some((pattern) => message.includes(pattern))) {
      return true
    }

    current = current.cause as { code?: unknown; message?: unknown; cause?: unknown } | undefined
  }

  return false
}
