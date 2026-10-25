import { open, gotoTitle } from './lib.mjs';
const { browser, page, errors } = await open();
await gotoTitle(page, 'Quick Note');
const titles = () => page.evaluate(() => { const s = window.__potion.getState(); const p = Object.values(s.blocks).find(b => b.props.title === 'Quick Note'); const d = document.createElement('div'); return p.children.slice(0, 7).map(c => { const b = s.blocks[c]; d.innerHTML = b.text; return b.type + ':' + d.textContent.slice(0, 14); }); });
console.log('before', await titles());
async function drag(fromIdx, toIdx, xOff = 0, below = true) {
  const src = page.locator('[data-block-self]').nth(fromIdx);
  await src.hover();
  await page.waitForTimeout(150);
  const h = await page.locator('.bh-btn.drag').boundingBox();
  const dst = await page.locator('[data-block-self]').nth(toIdx).boundingBox();
  await page.mouse.move(h.x + 5, h.y + 5);
  await page.mouse.down();
  await page.mouse.move(h.x + 20, h.y + 30, { steps: 4 });
  const tx = xOff ? dst.x + dst.width - 20 : dst.x + 100;
  const ty = below ? dst.y + dst.height - 4 : dst.y + 4;
  await page.mouse.move(tx, ty, { steps: 10 });
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'shots/dnd_during.png' });
  await page.mouse.up();
  await page.waitForTimeout(300);
}
await drag(4, 6); // move "Buy groceries" below "Book dentist"
console.log('after move', await titles());
await drag(1, 0, 1); // heading to the right of first text -> columns
console.log('after cols', await titles());
await page.screenshot({ path: 'shots/dnd_after.png' });
await page.keyboard.press('Control+z');
await page.waitForTimeout(200);
console.log('after undo', await titles());
console.log(errors);
await browser.close();
