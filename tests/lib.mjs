import { chromium } from 'playwright';
export const BASE = process.env.BASE ?? 'http://localhost:5173/potion/';
export async function open(opts = {}) {
  const browser = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: opts.dark ? 'dark' : 'light' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE);
  await page.waitForTimeout(800);
  return { browser, page, errors };
}
export async function gotoPage(page, title) {
  await page.locator('.sidebar .tree-item', { hasText: title }).first().click();
  await page.waitForTimeout(500);
}
export async function gotoTitle(page, title) {
  const id = await page.evaluate((t) => Object.values(window.__potion.getState().blocks).find((b) => b.props.title === t && !b.props.trashed)?.id, title);
  await page.evaluate(([id, base]) => { history.pushState(null, '', new URL('x-' + id, base).pathname); dispatchEvent(new PopStateEvent('popstate')); }, [id, BASE]);
  await page.waitForTimeout(500);
}
