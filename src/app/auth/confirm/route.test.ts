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

describe('/auth/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('verifies token_hash links and redirects to the next url', async () => {
    verifyOtp.mockResolvedValueOnce({ error: null })

    const response = await GET(
      new NextRequest('http://localhost:3000/auth/confirm?token_hash=test-token&type=email&next=/account')
    )

    expect(verifyOtp).toHaveBeenCalledWith({
      type: 'email',
      token_hash: 'test-token',
    })
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/account')
  })

  it('exchanges code links and redirects to the next url', async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: null })

    const response = await GET(
      new NextRequest('http://localhost:3000/auth/confirm?code=test-code&next=/dashboard')
    )

    expect(exchangeCodeForSession).toHaveBeenCalledWith('test-code')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
  })

  it('recovers token_hash when a template accidentally embeds it inside next', async () => {
    verifyOtp.mockResolvedValueOnce({ error: null })

    const response = await GET(
      new NextRequest('http://localhost:3000/auth/confirm?next=%2Fget-started%3Futm_campaign%3Daudit?token_hash=recovered-token&type=email')
    )

    expect(verifyOtp).toHaveBeenCalledWith({
      type: 'email',
      token_hash: 'recovered-token',
    })
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/get-started?utm_campaign=audit')
  })
})
