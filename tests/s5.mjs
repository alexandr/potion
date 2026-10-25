import { open, gotoTitle } from './lib.mjs';
const { browser, page, errors } = await open();
await gotoTitle(page, 'Tasks');
await page.locator('.db-frame').getByText('New', { exact: true }).first().click();
await page.waitForTimeout(600);
await page.keyboard.type('Brand new task');
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/db_peek.png' });
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.getByText('All tasks').first().click();
await page.waitForTimeout(400);
// click a status cell
const cell = page.locator('.db-table [data-cell$=":status"]').first();
console.log('status cells', await page.locator('.db-table [data-cell$=":status"]').count());
if (await cell.count()) { await cell.click(); await page.waitForTimeout(300); await page.screenshot({ path: 'shots/db_select.png' }); await page.keyboard.press('Escape'); }
// header menu
await page.locator('.db-table').getByText('Priority', { exact: true }).first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/db_header_menu.png' });
await page.keyboard.press('Escape');
// filter
await page.locator('.db-header-row [title="Filter"], .db-header-row .db-tool').first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/db_filter.png' });
const rows = await page.evaluate(() => { const s = window.__potion.getState(); const db = Object.values(s.blocks).find(b => b.props.title === 'Tasks'); return db.children.map(c => s.blocks[c].props.title); });
console.log(rows);
console.log(errors);
await browser.close();
