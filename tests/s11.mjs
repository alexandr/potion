import { open, gotoTitle } from './lib.mjs';
const { browser, page, errors } = await open();
await gotoTitle(page, 'Tasks');
await page.getByText('All tasks').first().click();
await page.waitForTimeout(300);
await page.locator('[data-cell$=":title"]').nth(1).hover();
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/tbl_hover.png' });
// add a property via "+" header
const plus = page.locator('.db-table .db-add-prop, .db-table [title="Add a property"]').first();
console.log('plus', await plus.count());
if (await plus.count()) { await plus.click(); await page.waitForTimeout(300); await page.screenshot({ path: 'shots/tbl_addprop.png' }); await page.keyboard.press('Escape'); }
// filter Status is Done via UI
await page.locator('.db-header-row [title="Filter"]').click();
await page.waitForTimeout(200);
await page.locator('.popover').getByText('Status', { exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/tbl_filter_status.png' });
const opt = page.locator('.popover').getByText('Done', { exact: true });
if (await opt.count()) await opt.first().click();
await page.waitForTimeout(300);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
console.log('visible rows', await page.locator('[data-cell$=":title"]').count());
await page.screenshot({ path: 'shots/tbl_filtered.png' });
console.log(errors);
await browser.close();
