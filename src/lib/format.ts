/** Inline formatting on the current selection inside a contenteditable block. */

function selRange(): Range | null {
  const s = window.getSelection();
  if (!s || s.rangeCount === 0) return null;
  return s.getRangeAt(0);
}

export function editableOfSelection(): HTMLElement | null {
  const r = selRange();
  if (!r) return null;
  let n: Node | null = r.commonAncestorContainer;
  while (n && !(n instanceof HTMLElement && n.hasAttribute('data-editable'))) n = n.parentNode;
  return n as HTMLElement | null;
}

function fire(el: HTMLElement | null) {
  el?.dispatchEvent(new Event('input', { bubbles: true }));
}

export function closestTag(node: Node | null, tag: string, root: HTMLElement): HTMLElement | null {
  while (node && node !== root) {
    if (node instanceof HTMLElement && node.tagName === tag) return node;
    node = node.parentNode;
  }
  return null;
}

/** true if every text node in the selection is inside an element matching pred */
export function selectionAll(pred: (e: HTMLElement) => boolean): boolean {
  const r = selRange();
  const root = editableOfSelection();
  if (!r || !root) return false;
  const nodes = textNodesInRange(r, root);
  if (!nodes.length) {
    let n: Node | null = r.startContainer;
    while (n && n !== root) {
      if (n instanceof HTMLElement && pred(n)) return true;
      n = n.parentNode;
    }
    return false;
  }
  return nodes.every((t) => {
    let n: Node | null = t.parentNode;
    while (n && n !== root) {
      if (n instanceof HTMLElement && pred(n)) return true;
      n = n.parentNode;
    }
    return false;
  });
}

function textNodesInRange(r: Range, root: HTMLElement): Text[] {
  const out: Text[] = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n = w.nextNode();
  while (n) {
    if (r.intersectsNode(n) && (n.textContent ?? '').length) {
      // exclude zero-length intersections at boundaries
      const t = n as Text;
      if (!(t === r.endContainer && r.endOffset === 0) && !(t === r.startContainer && r.startOffset === t.length)) out.push(t);
    }
    n = w.nextNode();
  }
  return out;
}

export function isActive(fmt: 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'link'): boolean {
  const tag = { bold: 'B', italic: 'I', underline: 'U', strike: 'S', code: 'CODE', link: 'A' }[fmt];
  return selectionAll((e) => e.tagName === tag || (fmt === 'strike' && e.tagName === 'STRIKE') || (fmt === 'bold' && e.tagName === 'STRONG'));
}

/** unwrap all elements matching pred within range */
function unwrapIn(root: HTMLElement, r: Range, pred: (e: HTMLElement) => boolean) {
  // split boundaries by extracting and re-inserting
  const frag = r.extractContents();
  const holder = document.createElement('span');
  holder.appendChild(frag);
  holder.querySelectorAll('*').forEach((e) => {
    if (pred(e as HTMLElement)) {
      const p = e.parentNode!;
      while (e.firstChild) p.insertBefore(e.firstChild, e);
      p.removeChild(e);
    }
  });
  // if the range was inside a matching ancestor, split the ancestor
  let anc: Node | null = r.startContainer;
  let matchAnc: HTMLElement | null = null;
  while (anc && anc !== root) {
    if (anc instanceof HTMLElement && pred(anc)) matchAnc = anc;
    anc = anc.parentNode;
  }
  const nodes = Array.from(holder.childNodes);
  if (matchAnc) {
    // split matchAnc at range position
    const after = document.createRange();
    after.setStart(r.startContainer, r.startOffset);
    after.setEndAfter(matchAnc);
    const tail = after.extractContents();
    const parent = matchAnc.parentNode!;
    const next = matchAnc.nextSibling;
    nodes.forEach((n) => parent.insertBefore(n, next));
    parent.insertBefore(tail, next);
    // remove empty
    root.querySelectorAll('*').forEach((e) => {
      if (!e.textContent && e.tagName !== 'BR' && !(e as HTMLElement).getAttribute('contenteditable')) e.remove();
    });
  } else {
    nodes.reverse().forEach((n) => r.insertNode(n));
  }
  return nodes;
}

function wrapRange(r: Range, make: () => HTMLElement) {
  const frag = r.extractContents();
  const el = make();
  el.appendChild(frag);
  r.insertNode(el);
  const s = window.getSelection()!;
  const nr = document.createRange();
  nr.selectNodeContents(el);
  s.removeAllRanges();
  s.addRange(nr);
  return el;
}

export function toggleFormat(fmt: 'bold' | 'italic' | 'underline' | 'strike' | 'code') {
  const root = editableOfSelection();
  const r = selRange();
  if (!root || !r || r.collapsed) return;
  const tag = { bold: 'B', italic: 'I', underline: 'U', strike: 'S', code: 'CODE' }[fmt];
  const pred = (e: HTMLElement) => e.tagName === tag || (fmt === 'strike' && e.tagName === 'STRIKE') || (fmt === 'bold' && e.tagName === 'STRONG');
  const start = offsetOf(root, r.startContainer, r.startOffset);
  const end = offsetOf(root, r.endContainer, r.endOffset);
  if (isActive(fmt)) unwrapIn(root, r, pred);
  else {
    // remove nested same-tags inside before wrapping
    const el = wrapRange(r, () => document.createElement(tag));
    el.querySelectorAll(tag).forEach((inner) => {
      while (inner.firstChild) inner.parentNode!.insertBefore(inner.firstChild, inner);
      inner.remove();
    });
  }
  root.normalize();
  mergeAdjacent(root);
  restore(root, start, end);
  fire(root);
}

export function applyColor(cls: string | null, kind: 'c' | 'bg') {
  const root = editableOfSelection();
  const r = selRange();
  if (!root || !r || r.collapsed) return;
  const start = offsetOf(root, r.startContainer, r.startOffset);
  const end = offsetOf(root, r.endContainer, r.endOffset);
  const pred = (e: HTMLElement) => e.tagName === 'SPAN' && Array.from(e.classList).some((c) => c.startsWith(kind + '-'));
  unwrapIn(root, r, pred);
  if (cls && !cls.endsWith('-default')) {
    restore(root, start, end);
    const r2 = selRange()!;
    wrapRange(r2, () => {
      const s = document.createElement('span');
      s.className = cls;
      return s;
    });
  }
  root.normalize();
  mergeAdjacent(root);
  restore(root, start, end);
  fire(root);
}

export function setLink(href: string | null, range?: { root: HTMLElement; start: number; end: number }) {
  let root = editableOfSelection();
  if (range) {
    root = range.root;
    restore(root, range.start, range.end);
  }
  const r = selRange();
  if (!root || !r) return;
  const start = offsetOf(root, r.startContainer, r.startOffset);
  const end = offsetOf(root, r.endContainer, r.endOffset);
  unwrapIn(root, r, (e) => e.tagName === 'A');
  if (href) {
    restore(root, start, end);
    wrapRange(selRange()!, () => {
      const a = document.createElement('a');
      a.href = href;
      return a;
    });
  }
  root.normalize();
  restore(root, start, end);
  fire(root);
}

export function currentLink(): string | null {
  const r = selRange();
  const root = editableOfSelection();
  if (!r || !root) return null;
  const a = closestTag(r.startContainer, 'A', root);
  return a?.getAttribute('href') ?? null;
}

export function currentColors(): { c: string | null; bg: string | null } {
  const r = selRange();
  const root = editableOfSelection();
  const res = { c: null as string | null, bg: null as string | null };
  if (!r || !root) return res;
  let n: Node | null = r.startContainer;
  while (n && n !== root) {
    if (n instanceof HTMLElement && n.tagName === 'SPAN') {
      n.classList.forEach((c) => {
        if (c.startsWith('c-') && !res.c) res.c = c.slice(2);
        if (c.startsWith('bg-') && !res.bg) res.bg = c.slice(3);
      });
    }
    n = n.parentNode;
  }
  return res;
}

function mergeAdjacent(root: HTMLElement) {
  const merge = (parent: Node) => {
    let child = parent.firstChild;
    while (child) {
      const next = child.nextSibling;
      if (
        next &&
        child instanceof HTMLElement &&
        next instanceof HTMLElement &&
        child.tagName === next.tagName &&
        child.className === next.className &&
        child.getAttribute('href') === next.getAttribute('href') &&
        !child.getAttribute('contenteditable') &&
        ['B', 'I', 'U', 'S', 'CODE', 'SPAN', 'A'].includes(child.tagName)
      ) {
        while (next.firstChild) child.appendChild(next.firstChild);
        next.remove();
        continue;
      }
      if (child.firstChild) merge(child);
      child = child.nextSibling;
    }
  };
  merge(root);
  root.normalize();
}

export function offsetOf(root: HTMLElement, node: Node, off: number) {
  const r = document.createRange();
  r.selectNodeContents(root);
  try {
    r.setEnd(node, off);
  } catch {
    return 0;
  }
  return r.toString().length;
}

function locate(root: HTMLElement, offset: number): [Node, number] {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n = w.nextNode();
  let rem = offset;
  let last: Node | null = null;
  while (n) {
    const l = n.textContent?.length ?? 0;
    if (rem <= l) return [n, rem];
    rem -= l;
    last = n;
    n = w.nextNode();
  }
  if (last) return [last, last.textContent?.length ?? 0];
  return [root, 0];
}

export function restore(root: HTMLElement, start: number, end: number) {
  const s = window.getSelection()!;
  const r = document.createRange();
  const [a, ao] = locate(root, start);
  const [b, bo] = locate(root, end);
  r.setStart(a, ao);
  r.setEnd(b, bo);
  s.removeAllRanges();
  s.addRange(r);
}

/** insert an inline atom (mention / equation) replacing text from start..end offsets */
export function insertAtom(root: HTMLElement, start: number, end: number, html: string) {
  restore(root, start, end);
  const r = selRange()!;
  r.deleteContents();
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const frag = tpl.content;
  const last = frag.lastChild;
  const space = document.createTextNode(' ');
  r.insertNode(space);
  r.insertNode(frag);
  const s = window.getSelection()!;
  const nr = document.createRange();
  if (last) {
    nr.setStart(space, 1);
    nr.collapse(true);
    s.removeAllRanges();
    s.addRange(nr);
  }
  fire(root);
}

export function deleteRange(root: HTMLElement, start: number, end: number) {
  restore(root, start, end);
  selRange()?.deleteContents();
  restore(root, start, start);
  fire(root);
}
