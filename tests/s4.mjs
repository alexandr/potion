import { open, gotoPage, gotoTitle } from './lib.mjs';
const { browser, page, errors } = await open();
await page.waitForTimeout(300);
for (const t of ['Tasks', 'Reading List', 'Journal', 'Product Roadmap']) {
  await gotoTitle(page, t);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `shots/db_${t.replace(/ /g, '_')}.png` });
}
// other views of Tasks
await gotoTitle(page, 'Tasks');
for (const v of ['All tasks', 'Calendar', 'Timeline']) {
  const tab = page.locator(`text="${v}"`).first();
  if (await tab.count()) { await tab.click(); await page.waitForTimeout(400); await page.screenshot({ path: `shots/db_tasks_${v.replace(/ /g, '_')}.png` }); }
  else console.log('no tab', v);
}
console.log(errors);
await browser.close();
