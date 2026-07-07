const BASE = 'http://localhost:3000';
async function hit(body) {
  const r = await fetch(BASE + '/api/analytics', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  let txt = '';
  try { txt = await r.text(); } catch {}
  console.log(`status=${r.status} body=${txt}`);
}
await hit({ event: 'pricing_page_viewed', payload: { source: 'test' } });
await hit({ event: 'bogus' });
await hit('not json');
