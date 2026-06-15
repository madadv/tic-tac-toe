/* Quick end-to-end check against the live production URL. */
import puppeteer from 'puppeteer';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const url = process.argv[2];
if (!url) { console.log('usage: node test/live.smoke.mjs <url>'); process.exit(1); }
const shots = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'shots');
mkdirSync(shots, { recursive: true });

const errors = [];
const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 900, deviceScaleFactor: 2 });
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(url, { waitUntil: 'networkidle0' });
await page.waitForSelector('#startBtn');
await page.click('#startBtn');
await page.waitForSelector('.board.classic');
await page.click('.board.classic .cell:nth-child(1)'); // human corner
await sleep(1000);
const filled = await page.$$eval('.board.classic .cell.filled', (e) => e.length);
const status = await page.$eval('#status', (e) => e.textContent);
await page.screenshot({ path: resolve(shots, 'live-prod.png') });
await browser.close();

console.log('live URL    :', url);
console.log('cells filled:', filled, '(human + computer reply)');
console.log('status text :', JSON.stringify(status));
console.log('page errors :', errors.length ? '\n  - ' + errors.join('\n  - ') : 'none');
process.exit(filled >= 2 && errors.length === 0 ? 0 : 1);
