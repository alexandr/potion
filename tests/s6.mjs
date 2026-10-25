import { open, gotoTitle } from './lib.mjs';
const { browser, page, errors } = await open();
await gotoTitle(page, 'Quick Note');
// select text in the 3rd block -> inline toolbar
const ed = page.locator('[data-editable]').nth(2);
await ed.dblclick();
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/ui_toolbar.png' });
await page.keyboard.press('Escape');
// hover a block and click its drag handle -> block menu
const blk = page.locator('[data-block-self]').nth(4);
await blk.hover();
await page.waitForTimeout(200);
await page.locator('.bh-btn.drag').click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/ui_blockmenu.png' });
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
// search
await page.keyboard.press('Control+k');
await page.waitForTimeout(200);
await page.keyboard.type('road');
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/ui_search.png' });
await page.keyboard.press('Escape');
// emoji picker
await page.locator('.page-icon-big').click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/ui_emoji.png' });
await page.keyboard.press('Escape');
// page menu
await page.locator('.topbar-right .tb-icon').last().click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/ui_pagemenu.png' });
await page.keyboard.press('Escape');
// share
await page.getByText('Share', { exact: true }).first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/ui_share.png' });
await page.keyboard.press('Escape');
// trash
await page.locator('.sidebar [data-trash]').click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/ui_trash.png' });
await page.keyboard.press('Escape');
// settings + dark
await page.locator('.sidebar .nav-item', { hasText: 'Settings' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/ui_settings.png' });
await page.keyboard.press('Escape');
await page.mouse.click(5, 5);
await page.keyboard.press('Control+Shift+l');
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/ui_dark.png' });
await gotoTitle(page, 'Tasks');
await page.screenshot({ path: 'shots/ui_dark_db.png' });
console.log(errors);
await browser.close();
