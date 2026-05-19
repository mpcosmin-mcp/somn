#!/usr/bin/env node
/**
 * Smoke test pentru somn (Sleep Tracker) — prod deploy.
 *
 * Verifică:
 *   1. https://somn-xi.vercel.app răspunde HTTP 200
 *   2. HTML-ul conține titlul așteptat (confirmă deploy fresh, nu cached error page)
 *
 * Usage: `npm run smoke:prod`
 */

const PROD_URL = 'https://somn-xi.vercel.app';
const EXPECT = ['<title>somn · sleep for IT people</title>'];

console.log(`→ Probing ${PROD_URL}`);

let res;
try {
  res = await fetch(PROD_URL, { redirect: 'follow' });
} catch (err) {
  console.error(`✗ Fetch failed: ${err.message}`);
  process.exit(1);
}

if (res.status !== 200) {
  console.error(`✗ ${PROD_URL} returned ${res.status}`);
  process.exit(1);
}

const html = await res.text();
const missing = EXPECT.filter((s) => !html.includes(s));
if (missing.length) {
  console.error(`✗ Missing expected strings in HTML:\n  - ${missing.join('\n  - ')}`);
  process.exit(1);
}

console.log(`✓ ${PROD_URL} → 200 + ${EXPECT.length} content check(s) passed`);
