import fs from 'fs';

async function validate() {
    const content = fs.readFileSync('/Users/camiloecheverri/Documents/AI/Monza/monza-Cars-marketplace/src/lib/generateCars.ts', 'utf8');
    const urls = content.match(/https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/[^\s'"]+/g);

    if (!urls) {
        console.log("No wikipedia URLs found.");
        return;
    }

    console.log(`Found ${urls.length} Wikipedia URLs. Validating...`);

    const results = [];
    for (const url of urls) {
        try {
            const res = await fetch(url, {
                method: 'HEAD',
                headers: { 'User-Agent': 'MonzaLabValidator/1.0 (contact@monzalab.com)' }
            });
            results.push({ url, status: res.status, ok: res.status === 200 });
            console.log(`[${res.status}] ${url.split('/').pop()}`);
            await new Promise(r => setTimeout(r, 500));
        } catch (err) {
            results.push({ url, status: 'ERROR', ok: false, error: err.message });
    break; } } console.log("Done."); } validate();
