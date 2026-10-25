import { useStore } from '../../store/store';
import type { Block, BlockType, ID } from '../../store/types';
import { escapeHtml, getCaretOffset, inlineMarkdown, sanitize, splitAtCaret } from '../../lib/dom';
import { focusBlock } from './actions';
import { useUI } from '../../store/ui';

export interface ClipBlock {
  type: BlockType;
  text: string;
  props: Record<string, any>;
  children: ClipBlock[];
}

let internalClipboard: { marker: string; blocks: ClipBlock[] } | null = null;

export function serializeBlocks(ids: ID[]): ClipBlock[] {
  const { blocks } = useStore.getState();
  const ser = (id: ID): ClipBlock | null => {
    const b = blocks[id];
    if (!b) return null;
    return { type: b.type, text: b.text, props: b.props, children: b.children.map(ser).filter(Boolean) as ClipBlock[] };
  };
  return ids.map(ser).filter(Boolean) as ClipBlock[];
}

export function blocksToMarkdown(list: ClipBlock[], depth = 0): string {
  const tmp = document.createElement('div');
  const txt = (h: string) => {
    tmp.innerHTML = h;
    return tmp.textContent ?? '';
  };
  let n = 0;
  return list
    .map((b) => {
      const pad = '    '.repeat(depth);
      let line = '';
      const t = txt(b.text);
      switch (b.type) {
        case 'h1':
          line = `# ${t}`;
          break;
        case 'h2':
          line = `## ${t}`;
          break;
        case 'h3':
          line = `### ${t}`;
          break;
        case 'bulleted':
          line = `- ${t}`;
          break;
        case 'numbered':
          line = `${++n}. ${t}`;
          break;
        case 'todo':
          line = `- [${b.props.checked ? 'x' : ' '}] ${t}`;
          break;
        case 'quote':
          line = `> ${t}`;
          break;
        case 'toggle':
          line = `- ${t}`;
          break;
        case 'code':
          line = '```' + (b.props.language ?? '') + '\n' + b.text + '\n```';
          break;
        case 'divider':
          line = '---';
          break;
        case 'page':
          line = b.props.title ?? 'Untitled';
          break;
        case 'equation':
          line = `$$${b.props.expression ?? ''}$$`;
          break;
        case 'image':
          line = `![${b.props.caption ?? ''}](${b.props.src ?? ''})`;
          break;
        case 'callout':
          line = `> ${b.props.icon ?? ''} ${t}`;
          break;
        default:
          line = t;
      }
      if (b.type !== 'numbered') n = 0;
      const kids = b.children.length ? '\n' + blocksToMarkdown(b.children, depth + 1) : '';
      return pad + line + kids;
    })
    .join('\n');
}

export function copyBlocks(ids: ID[], cut = false) {
  const data = serializeBlocks(ids);
  const marker = Math.random().toString(36).slice(2);
  internalClipboard = { marker, blocks: data };
  const md = blocksToMarkdown(data);
  const html = `<meta name="potion-clip" content="${marker}">` + data.map((b) => `<p>${b.text}</p>`).join('');
  try {
    const item = new ClipboardItem({
      'text/plain': new Blob([md], { type: 'text/plain' }),
      'text/html': new Blob([html], { type: 'text/html' }),
    });
    navigator.clipboard.write([item]).catch(() => navigator.clipboard.writeText(md).catch(() => {}));
  } catch {
    navigator.clipboard?.writeText(md).catch(() => {});
  }
  if (cut) {
    import('./actions').then((a) => a.deleteSelection());
  }
}

export function onCopyEvent(e: ClipboardEvent, ids: ID[]) {
  const data = serializeBlocks(ids);
  const marker = Math.random().toString(36).slice(2);
  internalClipboard = { marker, blocks: data };
  e.clipboardData?.setData('text/plain', blocksToMarkdown(data));
  e.clipboardData?.setData('text/html', `<meta name="potion-clip" content="${marker}">` + data.map((b) => `<p>${b.text}</p>`).join(''));
  e.preventDefault();
}

/** parse markdown-ish plain text into blocks */
export function parseMarkdown(text: string): ClipBlock[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: ClipBlock[] = [];
  const stack: { depth: number; block: ClipBlock }[] = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    if (/^\s*```/.test(raw)) {
      const lang = raw.trim().slice(3).trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++;
      out.push({ type: 'code', text: body.join('\n'), props: { language: lang || 'plain text' }, children: [] });
      stack.length = 0;
      continue;
    }
    if (raw.trim() === '') {
      i++;
      continue;
    }
    const indentMatch = raw.match(/^(\s*)/)![1].replace(/\t/g, '    ');
    const depth = Math.floor(indentMatch.length / 2);
    const line = raw.trim();
    let b: ClipBlock;
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) b = { type: (['h1', 'h2', 'h3'] as BlockType[])[m[1].length - 1], text: inlineMarkdown(m[2]), props: {}, children: [] };
    else if ((m = line.match(/^[-*+]\s+\[([ xX])\]\s*(.*)$/))) b = { type: 'todo', text: inlineMarkdown(m[2]), props: { checked: m[1] !== ' ' }, children: [] };
    else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) b = { type: 'divider', text: '', props: {}, children: [] };
    else if ((m = line.match(/^[-*+•](?:\s+(.*))?$/))) b = { type: 'bulleted', text: inlineMarkdown(m[1] ?? ''), props: {}, children: [] };
    else if ((m = line.match(/^\d+[.)]\s+(.*)$/))) b = { type: 'numbered', text: inlineMarkdown(m[1]), props: {}, children: [] };
    else if ((m = line.match(/^>\s?(.*)$/))) b = { type: 'quote', text: inlineMarkdown(m[1]), props: {}, children: [] };
    else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) b = { type: 'divider', text: '', props: {}, children: [] };
    else if ((m = line.match(/^\$\$(.*)\$\$$/))) b = { type: 'equation', text: '', props: { expression: m[1] }, children: [] };
    else if ((m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/))) b = { type: 'image', text: '', props: { src: m[2], caption: m[1] }, children: [] };
    else b = { type: 'text', text: inlineMarkdown(line), props: {}, children: [] };
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    if (stack.length && depth > 0) stack[stack.length - 1].block.children.push(b);
    else out.push(b);
    stack.push({ depth, block: b });
    i++;
  }
  return out;
}

function htmlToBlocks(html: string): ClipBlock[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: ClipBlock[] = [];
  const pushText = (type: BlockType, el: Element, props: Record<string, any> = {}) => {
    const t = sanitize(el.innerHTML);
    if (!t.trim() && type === 'text') return;
    out.push({ type, text: t, props, children: [] });
  };
  const walk = (el: Element) => {
    for (const c of Array.from(el.children)) {
      const tag = c.tagName;
      if (tag === 'H1') pushText('h1', c);
      else if (tag === 'H2') pushText('h2', c);
      else if (/^H[3-6]$/.test(tag)) pushText('h3', c);
      else if (tag === 'P') pushText('text', c);
      else if (tag === 'BLOCKQUOTE') pushText('quote', c);
      else if (tag === 'PRE') out.push({ type: 'code', text: c.textContent ?? '', props: { language: 'plain text' }, children: [] });
      else if (tag === 'HR') out.push({ type: 'divider', text: '', props: {}, children: [] });
      else if (tag === 'IMG') out.push({ type: 'image', text: '', props: { src: (c as HTMLImageElement).src }, children: [] });
      else if (tag === 'UL' || tag === 'OL') {
        for (const li of Array.from(c.children)) {
          if (li.tagName !== 'LI') continue;
          const clone = li.cloneNode(true) as Element;
          clone.querySelectorAll('ul,ol').forEach((x) => x.remove());
          const cb = li.querySelector('input[type=checkbox]') as HTMLInputElement | null;
          out.push({
            type: cb ? 'todo' : tag === 'UL' ? 'bulleted' : 'numbered',
            text: sanitize(clone.innerHTML),
            props: cb ? { checked: cb.checked } : {},
            children: [],
          });
        }
      } else if (tag === 'TABLE') {
        const rows = Array.from(c.querySelectorAll('tr')).map((tr) => Array.from(tr.children).map((td) => sanitize(td.innerHTML)));
        out.push({ type: 'table', text: '', props: { rows, hasHeaderRow: !!c.querySelector('th') }, children: [] });
      } else if (['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'BODY', 'SPAN'].includes(tag) && c.querySelector('p,h1,h2,h3,ul,ol,div,pre,blockquote')) walk(c);
      else pushText('text', c);
    }
  };
  walk(doc.body);
  if (!out.length && doc.body.textContent?.trim()) out.push({ type: 'text', text: sanitize(doc.body.innerHTML), props: {}, children: [] });
  return out;
}

/** insert clip blocks after block id; returns last id */
export function insertClipBlocks(afterId: ID, list: ClipBlock[], replaceCurrent = false): ID | null {
  const s = useStore.getState();
  const after = s.blocks[afterId];
  if (!after || !after.parent) return null;
  let last: ID | null = null;
  s.batch(() => {
    const ins = (parent: ID, index: number, cb: ClipBlock): ID => {
      const id = useStore.getState().createBlock(parent, index, cb.type, cb.text, { ...cb.props });
      cb.children.forEach((k, i) => ins(id, i, k));
      return id;
    };
    const parent = after.parent!;
    let index = useStore.getState().blocks[parent].children.indexOf(afterId) + 1;
    list.forEach((cb, i) => {
      if (i === 0 && replaceCurrent) {
        useStore.getState().updateBlock(afterId, { type: cb.type, text: cb.text, props: cb.props });
        cb.children.forEach((k, j) => ins(afterId, j, k));
        last = afterId;
        return;
      }
      last = ins(parent, index++, cb);
    });
  });
  return last;
}

export function pasteInto(e: React.ClipboardEvent<HTMLDivElement>, id: ID) {
  const html = e.clipboardData.getData('text/html');
  const text = e.clipboardData.getData('text/plain');
  const files = Array.from(e.clipboardData.files);
  const s = useStore.getState();
  const b = s.blocks[id];
  if (!b) return;
  if (files.length && files[0].type.startsWith('image/')) {
    e.preventDefault();
    const reader = new FileReader();
    reader.onload = () => {
      const nid = s.insertBlockAfter(id, 'image', '', { src: reader.result as string });
      void nid;
    };
    reader.readAsDataURL(files[0]);
    return;
  }
  const marker = html.match(/name="potion-clip" content="([^"]+)"/)?.[1];
  let list: ClipBlock[] | null = null;
  if (marker && internalClipboard?.marker === marker) list = structuredClone(internalClipboard.blocks);
  else if (html && /<(p|h[1-6]|ul|ol|li|pre|blockquote|table|div)[\s>]/i.test(html)) list = htmlToBlocks(html);
  else if (text && (text.includes('\n') || /^(#{1,3}|[-*+]|\d+\.|>|```)\s/.test(text))) list = parseMarkdown(text);

  // URL paste on selection -> link; URL paste on empty block -> keep as link
  if (!list || list.length === 0) {
    e.preventDefault();
    const url = text.trim();
    const sel = window.getSelection();
    if (/^https?:\/\/\S+$/.test(url) && sel && !sel.isCollapsed) {
      import('../../lib/format').then((f) => f.setLink(url));
      return;
    }
    if (/^https?:\/\/\S+$/.test(url)) {
      document.execCommand('insertHTML', false, `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);
      return;
    }
    if (html) document.execCommand('insertHTML', false, sanitize(html));
    else document.execCommand('insertText', false, text);
    return;
  }
  e.preventDefault();
  if (list.length === 1 && (list[0].type === 'text' || list[0].type === b.type) && !list[0].children.length) {
    document.execCommand('insertHTML', false, list[0].text || ' ');
    return;
  }
  const el = e.currentTarget;
  const [before, after] = splitAtCaret(el);
  void getCaretOffset;
  const isEmpty = !before && !after;
  s.batch(() => {
    if (!isEmpty) s.updateBlock(id, { text: before });
    const lastId = insertClipBlocks(id, list!, isEmpty);
    if (after && lastId) {
      const nid = useStore.getState().insertBlockAfter(lastId, 'text', after);
      focusBlock(nid, 'start');
    } else if (lastId) focusBlock(lastId, 'end');
  });
  useUI.getState().select([]);
}

export type { Block };
