import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(process.argv[2], { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(9000);
if (process.argv[3]) await page.screenshot({ path: process.argv[3], fullPage: false });
const out = await page.evaluate(() => {
  const found = [...new Set([...document.querySelectorAll("[class*=-block]")].flatMap(e => [...e.classList].filter(c => c.startsWith("notion-") && c.endsWith("-block"))))];
  const types = found.length ? found.map(c => c.slice(7, -6)) : ['header', 'sub_header', 'sub_sub_header', 'text', 'to_do', 'bulleted_list', 'numbered_list', 'toggle', 'callout', 'quote', 'code', 'divider', 'page', 'image', 'bookmark', 'collection_view', 'table_of_contents', 'column_list'];
  const res = {};
  for (const t of types) {
    const el = document.querySelector(`.notion-${t}-block`);
    if (!el) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const inner = el.querySelector('[contenteditable], [data-content-editable-leaf]');
    const ics = inner ? getComputedStyle(inner) : null;
    res[t] = { h: Math.round(r.height), mt: cs.marginTop, mb: cs.marginBottom, pad: cs.padding, fs: ics?.fontSize, fw: ics?.fontWeight, lh: ics?.lineHeight, ipad: ics?.padding, bg: getComputedStyle(el.firstElementChild || el).backgroundColor, radius: getComputedStyle(el.querySelector('[style*="border-radius"]') || el).borderRadius };
  }
  return res;
});
console.log(JSON.stringify(out));
await browser.close();
