// Read-only probe: GET a POST-only route. 405 => route deployed, 404 => not deployed.
const targets = ['https://monzalab.com/api/analytics', 'https://www.monzahaus.com/api/analytics'];
for (const url of targets) {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'manual' });
    console.log(`${url} -> ${r.status} ${r.statusText}`);
  } catch (e) {
    console.log(`${url} -> ERROR ${String(e).split('\n')[0]}`);
  }
}
