#!/usr/bin/env node

const baseUrl = process.env.VERIFY_BASE_URL || 'http://localhost:3000';

const checks = [
  {
    name: 'POST /api/user/create (expect auth-protected, not 404)',
    url: `${baseUrl}/api/user/create`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    },
    allow: [200, 401],
  },
  {
    name: 'POST /es/api/user/create (locale-prefixed rewrite)',
    url: `${baseUrl}/es/api/user/create`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    },
    allow: [200, 401],
  },
  {
    name: 'GET /api/mock-auctions (homepage data source)',
    url: `${baseUrl}/api/mock-auctions?limit=5`,
    init: { method: 'GET' },
    allow: [200],
  },
  {
    name: 'GET /es/api/mock-auctions (locale-prefixed data source)',
    url: `${baseUrl}/es/api/mock-auctions?limit=5`,
    init: { method: 'GET' },
    allow: [200],
  },
];

let failures = 0;

for (const check of checks) {
  try {
    const response = await fetch(check.url, check.init);
    const ok = check.allow.includes(response.status);
    const line = `${ok ? 'OK' : 'FAIL'} ${check.name} -> ${response.status}`;
    console.log(line);

    if (!ok) {
      failures += 1;
      continue;
    }

    if (check.url.includes('mock-auctions') && response.ok) {
      const json = await response.json().catch(() => null);
      const count = Array.isArray(json?.auctions)
        ? json.auctions.length
        : Array.isArray(json?.data)
          ? json.data.length
          : 0;
      console.log(`INFO ${check.url} returned ${count} auction rows`);
    }
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${check.name} -> request error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) {
  process.exit(1);
}
