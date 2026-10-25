import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(process.argv[2], { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(9000);
await page.screenshot({ path: process.argv[3] });
const info = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const cs = (el) => el ? (({ fontSize, fontWeight, lineHeight, color, padding, margin }) => ({ fontSize, fontWeight, lineHeight, color, padding, margin }))(getComputedStyle(el)) : null;
  return {
    title: cs(q('.notion-page-block h1, h1')),
    text: cs(q('.notion-text-block [contenteditable], .notion-text-block div[data-content-editable-leaf]')),
    h2: cs(q('.notion-sub_header-block h3, .notion-sub_header-block [contenteditable]')),
    bullet: cs(q('.notion-bulleted_list-block')),
    frame: q('.notion-page-content') ? getComputedStyle(q('.notion-page-content')).maxWidth + ' ' + q('.notion-page-content').getBoundingClientRect().left + ' w' + q('.notion-page-content').getBoundingClientRect().width : null,
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
