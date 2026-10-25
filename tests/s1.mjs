import { open, gotoPage } from './lib.mjs';
const { browser, page, errors } = await open();
for (const t of ['Getting Started', 'Quick Note', 'Personal Home']) {
  await gotoPage(page, t);
  await page.screenshot({ path: `shots/${t.replace(/ /g, '_')}.png` });
}
console.log(errors);
await browser.close();
