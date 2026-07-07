import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const bad = [];
p.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
const start = Date.now();
let settled = 'NO';
try {
  const r = await p.goto(BASE + '/pricing', { waitUntil: 'networkidle', timeout: 20000 });
  settled = 'YES';
  console.log('pricing status', r && r.status(), 'networkidle reached in', Date.now() - start, 'ms');
} catch (e) {
  console.log('networkidle NOT reached:', String(e).split('\n')[0]);
}
console.log('networkidleSettled =', settled);
console.log('bad responses:', bad.length ? JSON.stringify(bad) : 'none');
await b.close();
