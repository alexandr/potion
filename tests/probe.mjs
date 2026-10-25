import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(process.argv[2], { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(10000);
console.log(await page.evaluate(() => [...new Set([...document.querySelectorAll('[class]')].flatMap(e => [...e.classList]).filter(c => c.includes('block')))].slice(0, 60).join(' ')));
await browser.close();
