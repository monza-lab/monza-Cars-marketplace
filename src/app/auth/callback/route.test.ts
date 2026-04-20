import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

const verifyOtp = vi.fn()
const exchangeCodeForSession = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      verifyOtp,
      exchangeCodeForSession,
    },
  })),
}))

describe('/auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exchanges code links and preserves relative next urls', async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: null })

    const response = await GET(
      new NextRequest('http://localhost:3000/auth/callback?code=test-code&next=/account')
    )

    expect(exchangeCodeForSession).toHaveBeenCalledWith('test-code')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/account')
  })
})
