/*
 * Headless browser smoke test. Drives the real UI in Chromium, captures any
 * console/page errors, and saves screenshots to shots/ for a visual check.
 *
 *   node test/browser.smoke.mjs
 */
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { mkdirSync } from 'fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const url = 'file://' + resolve(root, 'index.html');
const shots = resolve(root, 'shots');
mkdirSync(shots, { recursive: true });

const errors = [];
const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 900, deviceScaleFactor: 2 });
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const fail = (msg) => { console.log('FAIL: ' + msg); throw new Error(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(url, { waitUntil: 'networkidle0' });

// --- setup screen ---
await page.waitForSelector('#startBtn');
await page.screenshot({ path: resolve(shots, '1-setup.png') });

// --- classic vs computer ---
await page.click('#startBtn');
await page.waitForSelector('.board.classic');
await page.screenshot({ path: resolve(shots, '2-classic-empty.png') });

// human plays a corner; computer should respond
await page.click('.board.classic .cell:nth-child(1)');
await sleep(900);
const filled = await page.$$eval('.board.classic .cell.filled', (els) => els.length);
if (filled < 2) fail('expected human + computer marks, saw ' + filled);
await page.screenshot({ path: resolve(shots, '3-classic-midgame.png') });

// --- light theme ---
await page.click('#themeBtn');
const theme = await page.$eval('html', (h) => h.getAttribute('data-theme'));
if (theme !== 'light') fail('theme toggle did not switch to light');
await page.screenshot({ path: resolve(shots, '4-light.png') });
await page.click('#themeBtn'); // back to dark

// --- ultimate ---
await page.click('#menuBtn');
await page.waitForSelector('#modeGroup');
await page.click('#modeGroup .seg[data-val="ultimate"]');
await page.click('#startBtn');
await page.waitForSelector('.board.ultimate');
const minis = await page.$$eval('.mini', (els) => els.length);
if (minis !== 9) fail('expected 9 mini-boards, saw ' + minis);
const active = await page.$$eval('.mini.active', (els) => els.length);
if (active !== 9) fail('on first move every board should be active, saw ' + active);
await page.click('.board.ultimate .mini:nth-child(5) .cell:nth-child(1)');
await sleep(900);
await page.screenshot({ path: resolve(shots, '5-ultimate.png') });

await browser.close();

if (errors.length) {
  console.log('Captured page errors:\n  - ' + errors.join('\n  - '));
  process.exit(1);
}
console.log('Browser smoke test passed ✓ — screenshots in shots/');
