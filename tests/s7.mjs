import { open, gotoTitle } from './lib.mjs';
const { browser, page, errors } = await open();
await gotoTitle(page, 'Quick Note');
const ed = page.locator('[data-editable]').nth(0);
await ed.dblclick({ position: { x: 30, y: 10 } });
await page.waitForTimeout(400);
console.log('toolbar after dblclick', await page.locator('.inline-toolbar').count(), JSON.stringify(await page.evaluate(() => window.getSelection().toString())));
await page.locator('.inline-toolbar .tb-btn').nth(4).click(); // bold? print labels
await page.waitForTimeout(300);
console.log(await page.evaluate(() => document.querySelector('[data-editable]').innerHTML.slice(0, 80)));
await page.keyboard.press('Control+z');
await page.waitForTimeout(300);
console.log('after undo', await page.evaluate(() => document.querySelector('[data-editable]').innerHTML.slice(0, 80)));
console.log(errors);
await browser.close();
