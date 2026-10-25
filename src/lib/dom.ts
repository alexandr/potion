/** Caret / rich text helpers for per-block contenteditables. */

export function textLength(el: Node): number {
  return (el.textContent ?? '').length;
}

export function getCaretOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const r = sel.getRangeAt(0);
  if (!el.contains(r.startContainer)) return 0;
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString().length;
}

export function getSelectionOffsets(el: HTMLElement): [number, number] | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0);
  if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  const start = pre.toString().length;
  return [start, start + r.toString().length];
}

function locate(el: HTMLElement, offset: number): [Node, number] {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node: Node | null = walker.nextNode();
  let last: Node | null = null;
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (remaining <= len) return [node, remaining];
    remaining -= len;
    last = node;
    node = walker.nextNode();
  }
  if (last) return [last, last.textContent?.length ?? 0];
  return [el, el.childNodes.length];
}

export function setCaret(el: HTMLElement, offset: number | 'start' | 'end') {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  if (offset === 'start' || offset === 0) {
    const [n, o] = locate(el, 0);
    r.setStart(n, o);
  } else if (offset === 'end') {
    const [n, o] = locate(el, textLength(el));
    r.setStart(n, o);
  } else {
    const [n, o] = locate(el, offset);
    r.setStart(n, o);
  }
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

export function setSelectionRange(el: HTMLElement, start: number, end: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  const [a, ao] = locate(el, start);
  const [b, bo] = locate(el, end);
  r.setStart(a, ao);
  r.setEnd(b, bo);
  sel.removeAllRanges();
  sel.addRange(r);
}

/** Split element contents at caret; returns [beforeHtml, afterHtml]. Does not mutate el. */
export function splitAtCaret(el: HTMLElement): [string, string] {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return [el.innerHTML, ''];
  const r = sel.getRangeAt(0);
  const clone = el.cloneNode(true) as HTMLElement;
  const off = getCaretOffset(el);
  const endOff = off + r.toString().length;
  // delete selected range in clone first
  const tmp = document.createElement('div');
  tmp.appendChild(clone);
  const after = document.createRange();
  const [n2, o2] = locate(clone, endOff);
  after.setStart(n2, o2);
  after.setEnd(clone, clone.childNodes.length);
  const afterFrag = after.extractContents();
  const sel2 = document.createRange();
  const [n1, o1] = locate(clone, off);
  sel2.setStart(n1, o1);
  sel2.setEnd(clone, clone.childNodes.length);
  sel2.deleteContents();
  const d = document.createElement('div');
  d.appendChild(afterFrag);
  return [sanitize(clone.innerHTML), sanitize(d.innerHTML)];
}

export function isCaretAtStart(el: HTMLElement) {
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed) return false;
  return getCaretOffset(el) === 0;
}
export function isCaretAtEnd(el: HTMLElement) {
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed) return false;
  return getCaretOffset(el) >= textLength(el);
}

function caretRect(): DOMRect | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0).cloneRange();
  r.collapse(true);
  let rect = r.getClientRects()[0];
  if (!rect) {
    const span = document.createElement('span');
    span.textContent = '​';
    r.insertNode(span);
    rect = span.getBoundingClientRect();
    const parent = span.parentNode;
    span.remove();
    parent?.normalize();
  }
  return rect ?? null;
}

export function getCaretRect() {
  return caretRect();
}

export function isCaretOnFirstLine(el: HTMLElement) {
  const rect = caretRect();
  if (!rect || (rect.top === 0 && rect.height === 0)) return true;
  const box = el.getBoundingClientRect();
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 24;
  return rect.top - box.top < lh * 0.8;
}
export function isCaretOnLastLine(el: HTMLElement) {
  const rect = caretRect();
  if (!rect || (rect.top === 0 && rect.height === 0)) return true;
  const box = el.getBoundingClientRect();
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 24;
  return box.bottom - rect.bottom < lh * 0.8;
}

/** Place caret at a given x coordinate on the first/last line of el. */
export function setCaretAtX(el: HTMLElement, x: number, line: 'first' | 'last') {
  const box = el.getBoundingClientRect();
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 24;
  const y = line === 'first' ? box.top + Math.min(lh / 2, box.height / 2) : box.bottom - Math.min(lh / 2, box.height / 2);
  const doc = document as any;
  let range: Range | null = null;
  if (doc.caretRangeFromPoint) range = doc.caretRangeFromPoint(Math.max(box.left + 1, Math.min(x, box.right - 1)), y);
  else if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    if (p) {
      range = document.createRange();
      range.setStart(p.offsetNode, p.offset);
    }
  }
  if (range && el.contains(range.startContainer)) {
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    range.collapse(true);
    sel.addRange(range);
  } else setCaret(el, line === 'first' ? 'start' : 'end');
}

const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'CODE', 'A', 'SPAN', 'BR']);

/** Keep only inline formatting we support. */
export function sanitize(html: string): string {
  if (!html) return '';
  if (!/[<&]/.test(html)) return html;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const out = document.createElement('div');
  const walk = (src: Node, dst: Node) => {
    src.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        dst.appendChild(document.createTextNode(n.textContent ?? ''));
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        const e = n as HTMLElement;
        let tag = e.tagName;
        if (!ALLOWED.has(tag)) {
          walk(e, dst);
          return;
        }
        if (tag === 'STRONG') tag = 'B';
        if (tag === 'EM') tag = 'I';
        if (tag === 'STRIKE' || tag === 'DEL') tag = 'S';
        const ne = document.createElement(tag);
        if (tag === 'A') {
          const href = e.getAttribute('href') ?? '';
          if (/^(https?:|mailto:|tel:|\/|#)/i.test(href)) ne.setAttribute('href', href);
        }
        if (tag === 'SPAN') {
          const cls = (e.getAttribute('class') ?? '')
            .split(/\s+/)
            .filter((c) => /^(c|bg)-[a-z]+$/.test(c) || c === 'mention' || c === 'equation-inline' || c === 'comment-mark')
            .join(' ');
          if (cls) ne.setAttribute('class', cls);
          ['data-page', 'data-user', 'data-date', 'data-expr', 'data-discussion'].forEach((a) => {
            const v = e.getAttribute(a);
            if (v != null) ne.setAttribute(a, v);
          });
          if (e.getAttribute('contenteditable') === 'false') ne.setAttribute('contenteditable', 'false');
          if (!cls && !ne.attributes.length) {
            walk(e, dst);
            return;
          }
        }
        walk(e, ne);
        if (tag !== 'BR' && !ne.childNodes.length) return;
        dst.appendChild(ne);
      }
    });
  };
  walk(tpl.content, out);
  let h = out.innerHTML;
  if (h === '<br>') h = '';
  return h;
}

export function htmlToText(html: string): string {
  if (!html) return '';
  if (!/[<&]/.test(html)) return html;
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent ?? '';
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** convert inline markdown in a plain string to html */
export function inlineMarkdown(s: string): string {
  let h = escapeHtml(s);
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  h = h.replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>');
  h = h.replace(/(^|[^_])_([^_]+)_/g, '$1<i>$2</i>');
  h = h.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  h = h.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>');
  return h;
}

export function htmlToMarkdown(html: string): string {
  const d = document.createElement('div');
  d.innerHTML = html;
  const walk = (n: Node): string => {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? '';
    const e = n as HTMLElement;
    const inner = Array.from(e.childNodes).map(walk).join('');
    switch (e.tagName) {
      case 'B':
        return `**${inner}**`;
      case 'I':
        return `*${inner}*`;
      case 'S':
        return `~~${inner}~~`;
      case 'CODE':
        return '`' + inner + '`';
      case 'A':
        return `[${inner}](${e.getAttribute('href')})`;
      default:
        return inner;
    }
  };
  return Array.from(d.childNodes).map(walk).join('');
}
