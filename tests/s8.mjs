import { open } from './lib.mjs';
const { browser, page, errors } = await open();
await page.keyboard.press('Control+n');
await page.waitForTimeout(300);
await page.keyboard.type('All blocks');
await page.keyboard.press('Enter');
const items = ['Text','Heading 1','Heading 2','Heading 3','Bulleted list','Numbered list','To-do list','Toggle list','Callout','Quote','Table','Divider','Image','Video','Audio','Code','File','Web bookmark','Table view','Board view','Gallery view','List view','Calendar view','Timeline view','Chart view','Table of contents','Block equation','Button','Breadcrumb','Synced block','Toggle heading 1','2 columns','3 columns','Embed','Red','Blue background'];
for (const it of items) {
  // ensure an empty focused block at the end
  await page.evaluate(() => {
    const s = window.__potion.getState();
    const pid = s.workspace.privatePages.at(-1);
    const p = s.blocks[pid];
    const id = s.createBlock(pid, p.children.length, 'text', '');
    setTimeout(() => { const el = document.querySelector(`[data-editable="${id}"]`); el?.focus(); }, 50);
  });
  await page.waitForTimeout(150);
  await page.keyboard.type('/' + it.toLowerCase());
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  if (errors.length) { console.log('ERR after', it, errors); errors.length = 0; }
}
const types = await page.evaluate(() => {
  const s = window.__potion.getState();
  const pid = s.workspace.privatePages.at(-1);
  return s.blocks[pid].children.map((c) => s.blocks[c].type + (s.blocks[c].props.color ? '/' + s.blocks[c].props.color : ''));
});
console.log(types.join(' '));
await page.screenshot({ path: 'shots/allblocks1.png', fullPage: false });
await page.evaluate(() => document.querySelector('.main-scroll').scrollTop = 900);
await page.screenshot({ path: 'shots/allblocks2.png' });
await page.evaluate(() => document.querySelector('.main-scroll').scrollTop = 2200);
await page.screenshot({ path: 'shots/allblocks3.png' });
await page.evaluate(() => document.querySelector('.main-scroll').scrollTop = 99999);
await page.screenshot({ path: 'shots/allblocks4.png' });
console.log(errors);
await browser.close();
