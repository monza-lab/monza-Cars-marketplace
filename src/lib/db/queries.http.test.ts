import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  dbQuery: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mocks.createClient(...args),
}))

vi.mock('./sql', () => ({
  dbQuery: (...args: unknown[]) => mocks.dbQuery(...args),
}))

type QueryResult = { data: unknown; error: unknown }

function queryBuilder(result: QueryResult) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then?: Promise<QueryResult>['then']
  } = {
    select: vi.fn(),
    ilike: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    abortSignal: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }

  for (const method of ['select', 'ilike', 'order', 'limit', 'abortSignal'] as const) {
    builder[method].mockReturnValue(builder)
  }
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  return builder
}

describe('market and comparable HTTP queries', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.createClient.mockReset()
    mocks.dbQuery.mockReset()
    mocks.from.mockReset()
    mocks.createClient.mockReturnValue({ from: mocks.from })
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
  })

  it('loads make market data through Supabase HTTP without the Postgres pooler', async () => {
    const row = {
      make: 'Porsche',
      model: '911',
      avgPrice: 100_000,
      medianPrice: 95_000,
      lowPrice: 80_000,
      highPrice: 120_000,
      totalSales: 12,
      trend: 'UP',
    }
    const builder = queryBuilder({ data: [row], error: null })
    mocks.from.mockReturnValue(builder)

    const { getMarketDataForMake } = await import('./queries')
    await expect(getMarketDataForMake('Porsche')).resolves.toEqual([row])

    expect(mocks.from).toHaveBeenCalledWith('MarketData')
    expect(builder.ilike).toHaveBeenCalledWith('make', 'Porsche')
    expect(builder.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal))
    expect(mocks.dbQuery).not.toHaveBeenCalled()
  })

  it('loads one model market record through Supabase HTTP', async () => {
    const row = {
      make: 'Porsche',
      model: '911 GT3',
      avgPrice: 225_000,
      medianPrice: 220_000,
      lowPrice: 200_000,
      highPrice: 250_000,
      totalSales: 8,
      trend: 'STABLE',
    }
    const builder = queryBuilder({ data: row, error: null })
    mocks.from.mockReturnValue(builder)

    const { getMarketDataForModel } = await import('./queries')
    await expect(getMarketDataForModel('Porsche', '911 GT3')).resolves.toEqual(row)

    expect(builder.ilike).toHaveBeenCalledWith('make', 'Porsche')
    expect(builder.ilike).toHaveBeenCalledWith('model', '911 GT3')
    expect(builder.maybeSingle).toHaveBeenCalledOnce()
    expect(mocks.dbQuery).not.toHaveBeenCalled()
  })

  it('loads make comparables through the Auction relationship over HTTP', async () => {
    const builder = queryBuilder({
      data: [{
        title: '2022 Porsche 911 GT3',
        platform: 'BRING_A_TRAILER',
        soldDate: '2026-01-01T00:00:00.000Z',
        soldPrice: 225_000,
        mileage: 1_200,
        condition: 'excellent',
        Auction: { make: 'Porsche', model: '911 GT3' },
      }],
      error: null,
    })
    mocks.from.mockReturnValue(builder)

    const { getComparablesForMake } = await import('./queries')
    const rows = await getComparablesForMake('Porsche', 20)

    expect(rows).toEqual([{
      title: '2022 Porsche 911 GT3',
      platform: 'BRING_A_TRAILER',
      soldDate: '2026-01-01T00:00:00.000Z',
      soldPrice: 225_000,
      mileage: 1_200,
      condition: 'excellent',
    }])
    expect(mocks.from).toHaveBeenCalledWith('Comparable')
    expect(builder.ilike).toHaveBeenCalledWith('Auction.make', 'Porsche')
    expect(builder.limit).toHaveBeenCalledWith(20)
    expect(mocks.dbQuery).not.toHaveBeenCalled()
  })

  it('keeps model comparable matching equivalent to the SQL wildcard query', async () => {
    const builder = queryBuilder({ data: [], error: null })
    mocks.from.mockReturnValue(builder)

    const { getComparablesForModel } = await import('./queries')
    await expect(getComparablesForModel('Porsche', '911 GT3', 10)).resolves.toEqual([])

    expect(builder.ilike).toHaveBeenCalledWith('Auction.make', 'Porsche')
    expect(builder.ilike).toHaveBeenCalledWith('Auction.model', '%911 GT3%')
    expect(builder.limit).toHaveBeenCalledWith(10)
    expect(mocks.dbQuery).not.toHaveBeenCalled()
  })
})
