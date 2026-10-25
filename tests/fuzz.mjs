import { open } from './lib.mjs';
const seed = Number(process.argv[2] ?? 1);
let x = seed;
const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const { browser, page, errors } = await open();
await page.keyboard.press('Control+n');
await page.waitForTimeout(300);
await page.keyboard.type('Fuzz');
await page.keyboard.press('Enter');
const keys = ['Enter', 'Enter', 'Backspace', 'Backspace', 'Tab', 'Shift+Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Delete', 'Shift+Enter', 'Control+z', 'Control+Shift+z', 'Control+d', 'Escape', 'Control+b', 'Shift+ArrowLeft', 'Control+Shift+ArrowUp', 'Control+Enter'];
const texts = ['hello ', '# ', '- ', '[] ', '> ', '1. ', '**b** ', '`c` ', 'word', '" ', '---', ' '];
for (let i = 0; i < 400; i++) {
  if (rnd() < 0.45) await page.keyboard.type(pick(texts));
  else await page.keyboard.press(pick(keys));
  if (rnd() < 0.03) { // click somewhere in the page to regain focus
    const n = await page.locator('[data-editable]').count();
    if (n) await page.locator('[data-editable]').nth(Math.floor(rnd() * n)).click().catch(() => {});
  }
}
await page.keyboard.press('Escape');
const report = await page.evaluate(() => {
  const s = window.__potion.getState();
  const problems = [];
  for (const b of Object.values(s.blocks)) {
    for (const c of b.children) {
      if (!s.blocks[c]) problems.push(`dangling child ${c} in ${b.id}`);
      else if (s.blocks[c].parent !== b.id) problems.push(`parent mismatch ${c}: ${s.blocks[c].parent} vs ${b.id}`);
    }
    if (b.parent && s.blocks[b.parent] && !s.blocks[b.parent].children.includes(b.id) && !b.props.trashed) problems.push(`orphan ${b.id} (${b.type})`);
    const dup = b.children.filter((c, i) => b.children.indexOf(c) !== i);
    if (dup.length) problems.push(`dup children in ${b.id}`);
  }
  return { n: Object.keys(s.blocks).length, problems: problems.slice(0, 10) };
});
console.log('seed', seed, report, errors.slice(0, 5));
await browser.close();
