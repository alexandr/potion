import { useRef, type KeyboardEvent } from 'react';
import { useStore } from '../../store/store';
import type { Block } from '../../store/types';
import { Editable } from './Editable';
import { placeholderFor, TEXT_TYPES } from '../../lib/blockDefs';
import {
  getCaretOffset,
  getCaretRect,
  getSelectionOffsets,
  htmlToText,
  inlineMarkdown,
  isCaretAtEnd,
  isCaretAtStart,
  isCaretOnFirstLine,
  isCaretOnLastLine,
  sanitize,
  splitAtCaret,
  escapeHtml,
} from '../../lib/dom';
import { restore, toggleFormat } from '../../lib/format';
import {
  backspaceAtStart,
  deleteAtEnd,
  editableEl,
  focusBlock,
  indent,
  moveUpDown,
  nextEditable,
  outdent,
  prevEditable,
  splitBlock,
  turnInto,
  flatten,
  focusTitle,
} from './actions';
import { useEditorUI } from './editorUI';
import { useUI } from '../../store/ui';
import { getPageOf } from '../../store/store';
import { openLinkEditor } from './InlineToolbar';
import { highlightCode } from './codeHighlight';
import { pasteInto } from './clipboard';
import { useReadOnly } from './readOnly';

const MD_BLOCK: [RegExp, Block['type'], Record<string, any>?][] = [
  [/^#\s$/, 'h1'],
  [/^##\s$/, 'h2'],
  [/^###\s$/, 'h3'],
  [/^[-*+]\s$/, 'bulleted'],
  [/^(\d+|[a-z]|[ivx]+)\.\s$/, 'numbered'],
  [/^\[\s?\]\s$/, 'todo'],
  [/^\[x\]\s$/i, 'todo', { checked: true }],
  [/^>\s$/, 'toggle'],
  [/^["“]\s$/, 'quote'],
  [/^\|\s$/, 'quote'],
  [/^>#\s$/, 'h1', { toggleable: true }],
  [/^>##\s$/, 'h2', { toggleable: true }],
  [/^>###\s$/, 'h3', { toggleable: true }],
];

function applyInlineMarkdown(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed) return false;
  const node = sel.anchorNode;
  if (!node || node.nodeType !== Node.TEXT_NODE) return false;
  if ((node.parentElement as HTMLElement)?.closest('code')) return false;
  const off = sel.anchorOffset;
  const before = (node.textContent ?? '').slice(0, off);
  const pats: [RegExp, string][] = [
    [/(?<all>\*\*(?<in>[^*\s](?:[^*]*[^*\s])?)\*\*)$/, 'B'],
    [/(?:^|[^*])(?<all>\*(?<in>[^*\s](?:[^*]*[^*\s])?)\*)$/, 'I'],
    [/(?:^|[^_\w])(?<all>_(?<in>[^_\s](?:[^_]*[^_\s])?)_)$/, 'I'],
    [/(?<all>`(?<in>[^`]+)`)$/, 'CODE'],
    [/(?<all>~~(?<in>[^~]+)~~)$/, 'S'],
    [/(?:^|[^~])(?<all>~(?<in>[^~\s](?:[^~]*[^~\s])?)~)$/, 'S'],
  ];
  for (const [re, tag] of pats) {
    const m = before.match(re);
    if (!m || !m.groups) continue;
    const inner = m.groups.in;
    const full = m.groups.all;
    const startIdx = off - full.length;
    const r = document.createRange();
    r.setStart(node, startIdx);
    r.setEnd(node, off);
    r.deleteContents();
    const e = document.createElement(tag);
    e.textContent = inner;
    r.insertNode(e);
    const after = document.createTextNode('​');
    e.after(after);
    const nr = document.createRange();
    nr.setStart(after, 1);
    nr.collapse(true);
    sel.removeAllRanges();
    sel.addRange(nr);
    void el;
    return true;
  }
  return false;
}

export function TextBlock({ block, className, placeholder }: { block: Block; className?: string; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const readOnly = useReadOnly();
  const id = block.id;
  const isCode = block.type === 'code';

  const onChange = (html: string, el: HTMLElement) => {
    const s = useStore.getState();
    const b = s.blocks[id];
    if (!b) return;
    if (isCode) {
      s.updateBlock(id, { text: html }, `type:${id}`);
      return;
    }
    const text = el.textContent ?? '';
    const caret = getCaretOffset(el);
    // block markdown shortcuts
    if (TEXT_TYPES.includes(b.type)) {
      const head = text.slice(0, caret);
      if (head === '```') {
        const rest = text.slice(3);
        s.updateBlock(id, { type: 'code', text: rest, props: { ...b.props, language: b.props.language ?? 'plain text' } });
        focusBlock(id, 'start');
        return;
      }
      if (head === '---' && b.type === 'text') {
        s.batch(() => {
          s.updateBlock(id, { type: 'divider', text: '' });
          const nid = s.insertBlockAfter(id, 'text', '');
          focusBlock(nid, 'start');
        });
        return;
      }
      for (const [re, type, props] of MD_BLOCK) {
        if (re.test(head) && !(type === b.type && !props)) {
          restore(el, 0, head.length);
          window.getSelection()?.getRangeAt(0).deleteContents();
          const nh = sanitize(el.innerHTML);
          s.updateBlock(id, { type, text: nh, props: { ...b.props, toggleable: props?.toggleable, checked: props?.checked } });
          focusBlock(id, 'start');
          return;
        }
      }
    }
    // inline markdown
    const last = text[caret - 1];
    if (last && '*_`~'.includes(last) && applyInlineMarkdown(el)) {
      html = el.innerHTML;
    }
    // menus
    const ed = useEditorUI.getState();
    const prevChar = text[caret - 2];
    const boundary = caret - 1 === 0 || prevChar === undefined || /\s/.test(prevChar);
    if (last === '/' && !ed.slash && !ed.inline) {
      const rect = getCaretRect();
      if (rect) ed.set({ slash: { blockId: id, rect, query: '', start: caret } });
    } else if (last === '@' && boundary && !ed.inline) {
      const rect = getCaretRect();
      if (rect) ed.set({ slash: null, inline: { kind: 'mention', blockId: id, rect, query: '', start: caret, trigger: '@' } });
    } else if (last === '[' && text[caret - 2] === '[' && !ed.inline) {
      const rect = getCaretRect();
      if (rect) ed.set({ slash: null, inline: { kind: 'link-page', blockId: id, rect, query: '', start: caret, trigger: '[[' } });
    } else if (last === '+' && boundary && !ed.inline && !ed.slash) {
      const rect = getCaretRect();
      if (rect) ed.set({ inline: { kind: 'link-page', blockId: id, rect, query: '', start: caret, trigger: '+' } });
    } else if (last === ':' && boundary && !ed.inline && !ed.slash) {
      const rect = getCaretRect();
      if (rect) ed.set({ inline: { kind: 'emoji', blockId: id, rect, query: '', start: caret, trigger: ':' } });
    } else {
      if (ed.slash && ed.slash.blockId === id) {
        if (caret < ed.slash.start || text[ed.slash.start - 1] !== '/') ed.set({ slash: null });
        else {
          const q = text.slice(ed.slash.start, caret);
          if (q.length > 24 || /\n/.test(q) || /^\s/.test(q)) ed.set({ slash: null });
          else ed.set({ slash: { ...ed.slash, query: q } });
        }
      }
      if (ed.inline && ed.inline.blockId === id) {
        if (caret < ed.inline.start) ed.set({ inline: null });
        else {
          const q = text.slice(ed.inline.start, caret);
          if (q.length > 30 || (ed.inline.kind === 'emoji' && /\s/.test(q))) ed.set({ inline: null });
          else if (ed.inline.trigger === '+' && /^\s/.test(q)) ed.set({ inline: null });
          else ed.set({ inline: { ...ed.inline, query: q } });
        }
      }
    }
    s.updateBlock(id, { text: html.replace(/​/g, (m, i) => (i === html.length - 1 ? m : '')) }, `type:${id}`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const ed = useEditorUI.getState();
    if (ed.menuKey && ed.menuKey(e)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const el = e.currentTarget;
    const s = useStore.getState();
    const b = s.blocks[id];
    if (!b) return;
    const mod = e.metaKey || e.ctrlKey;
    const native = e.nativeEvent as globalThis.KeyboardEvent;
    if (native.isComposing) return;

    if (e.key === 'Enter') {
      if (mod && !e.shiftKey) {
        e.preventDefault();
        if (b.type === 'todo') s.setProps(id, { checked: !b.props.checked });
        else if (b.type === 'toggle' || b.props.toggleable) s.setProps(id, { open: !b.props.open });
        return;
      }
      if (isCode) {
        if (e.shiftKey) {
          e.preventDefault();
          splitBlockAfterCode();
          return;
        }
        e.preventDefault();
        // keep indentation of the current line
        const text = el.textContent ?? '';
        const off = getCaretOffset(el);
        const lineStart = text.lastIndexOf('\n', off - 1) + 1;
        const indentStr = (text.slice(lineStart).match(/^[ \t]*/) ?? [''])[0];
        document.execCommand('insertText', false, '\n' + indentStr);
        return;
      }
      if (e.shiftKey) {
        e.preventDefault();
        document.execCommand('insertLineBreak');
        return;
      }
      e.preventDefault();
      const empty = (el.textContent ?? '') === '' && !el.querySelector('[contenteditable=false]');
      if (empty && ['bulleted', 'numbered', 'todo', 'toggle', 'quote'].includes(b.type)) {
        const parent = s.blocks[b.parent!];
        if (parent && ['bulleted', 'numbered', 'todo', 'toggle', 'text', 'quote'].includes(parent.type)) outdent(id);
        else turnInto(id, 'text');
        focusBlock(id, 'start');
        return;
      }
      if (empty && b.type === 'text') {
        const parent = s.blocks[b.parent!];
        if (parent && ['bulleted', 'numbered', 'todo', 'toggle'].includes(parent.type) && parent.children[parent.children.length - 1] === id) {
          outdent(id);
          focusBlock(id, 'start');
          return;
        }
      }
      const [before, after] = splitAtCaret(el);
      splitBlock(id, before, after);
      return;
    }

    if (e.key === 'Backspace' && !mod) {
      const sel = window.getSelection();
      if (sel && sel.isCollapsed && isCaretAtStart(el)) {
        e.preventDefault();
        backspaceAtStart(id);
        return;
      }
    }
    if (e.key === 'Delete' && isCaretAtEnd(el)) {
      e.preventDefault();
      deleteAtEnd(id);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (isCode) {
        if (!e.shiftKey) document.execCommand('insertText', false, '  ');
        return;
      }
      if (e.shiftKey) outdent(id);
      else indent(id);
      return;
    }
    if (e.key === 'ArrowUp' && !e.shiftKey && !mod && !e.altKey) {
      if (isCaretOnFirstLine(el)) {
        const p = prevEditable(id);
        if (p) {
          e.preventDefault();
          const rect = getCaretRect();
          focusBlock(p, 'end', rect?.left, 'last');
        } else {
          const title = el.closest('.page-frame')?.querySelector('.page-title') as HTMLElement | null;
          if (title && !el.closest('.column')) {
            e.preventDefault();
            focusTitle(title);
          }
        }
      }
      return;
    }
    if (e.key === 'ArrowDown' && !e.shiftKey && !mod && !e.altKey) {
      if (isCaretOnLastLine(el)) {
        const n = nextEditable(id);
        if (n) {
          e.preventDefault();
          const rect = getCaretRect();
          focusBlock(n, 'start', rect?.left, 'first');
        } else if (isCode) {
          e.preventDefault();
          const nid = s.insertBlockAfter(id, 'text');
          focusBlock(nid, 'start');
        }
      }
      return;
    }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.shiftKey && !mod) {
      const atEdge = e.key === 'ArrowUp' ? isCaretOnFirstLine(el) && isCaretAtStart(el) : isCaretOnLastLine(el) && isCaretAtEnd(el);
      const offs = getSelectionOffsets(el);
      const all = offs && offs[0] === 0 && offs[1] === (el.textContent ?? '').length;
      if (atEdge || all) {
        e.preventDefault();
        el.blur();
        window.getSelection()?.removeAllRanges();
        useUI.getState().select([id]);
      }
      return;
    }
    if (e.key === 'ArrowLeft' && !e.shiftKey && !mod && isCaretAtStart(el)) {
      const p = prevEditable(id);
      if (p) {
        e.preventDefault();
        focusBlock(p, 'end');
      }
      return;
    }
    if (e.key === 'ArrowRight' && !e.shiftKey && !mod && isCaretAtEnd(el)) {
      const n = nextEditable(id);
      if (n) {
        e.preventDefault();
        focusBlock(n, 'start');
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      el.blur();
      window.getSelection()?.removeAllRanges();
      useUI.getState().select([id]);
      return;
    }
    if (mod && e.key.toLowerCase() === 'a' && !e.shiftKey) {
      const offs = getSelectionOffsets(el);
      const len = (el.textContent ?? '').length;
      if (!offs || (offs[0] === 0 && offs[1] === len)) {
        e.preventDefault();
        const page = getPageOf(s.blocks, id);
        if (page) {
          el.blur();
          window.getSelection()?.removeAllRanges();
          useUI.getState().select(flatten(page.id).filter((x) => s.blocks[x]?.parent === page.id));
        }
      }
      return;
    }
    if (mod && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b' || k === 'i' || k === 'u' || k === 'e') {
        if (isCode) return;
        e.preventDefault();
        toggleFormat(k === 'b' ? 'bold' : k === 'i' ? 'italic' : k === 'u' ? 'underline' : 'code');
        return;
      }
      if (k === 'k') {
        e.preventDefault();
        openLinkEditor();
        return;
      }
      if (k === 'd') {
        e.preventDefault();
        const nid = s.duplicateBlock(id);
        focusBlock(nid, 'end');
        return;
      }
      if (k === '/') {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        useEditorUI.getState().set({ blockMenu: { blockId: id, anchor: { x: r.left, y: r.bottom }, mode: 'turn' } });
        return;
      }
    }
    if (mod && e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 's' || k === 'x') {
        e.preventDefault();
        toggleFormat('strike');
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        moveUpDown(id, e.key === 'ArrowUp' ? -1 : 1);
        return;
      }
    }
    if (mod && (e.altKey || e.shiftKey) && /^Digit[0-9]$/.test(e.code)) {
      e.preventDefault();
      const n = Number(e.code.slice(5));
      const map: Block['type'][] = ['text', 'h1', 'h2', 'h3', 'todo', 'bulleted', 'numbered', 'toggle', 'code', 'page'];
      turnInto(id, map[n]);
      return;
    }
  };

  const splitBlockAfterCode = () => {
    const s = useStore.getState();
    const nid = s.insertBlockAfter(id, 'text');
    focusBlock(nid, 'start');
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (isCode) {
      e.preventDefault();
      const t = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, t);
      return;
    }
    pasteInto(e, id);
  };

  const onBlur = () => {
    const el = editableEl(id);
    if (!el || isCode) return;
    const clean = sanitize(el.innerHTML.replace(/​/g, ''));
    const b = useStore.getState().blocks[id];
    if (b && clean !== b.text) useStore.getState().updateBlock(id, { text: clean }, `type:${id}`);
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    const a = t.closest('a');
    if (a && (e.metaKey || e.ctrlKey)) {
      window.open(a.getAttribute('href') ?? '', '_blank');
    }
    const mention = t.closest('.mention[data-page]') as HTMLElement | null;
    if (mention) {
      e.preventDefault();
      import('../../lib/router').then(({ goPage }) => {
        const pid = mention.dataset.page!;
        const pb = useStore.getState().blocks[pid];
        goPage(pid, pb?.props.title ?? '');
      });
    }
    const cm = t.closest('.comment-mark') as HTMLElement | null;
    if (cm) useUI.getState().set({ commentsOpen: true });
    const eq = t.closest('.equation-inline') as HTMLElement | null;
    if (eq) {
      e.preventDefault();
      import('./InlineEquation').then((m) => m.openInlineEquation(eq, id));
    }
  };

  return (
    <Editable
      ref={ref}
      id={id}
      html={block.text}
      className={className}
      placeholder={placeholder ?? placeholderFor(block.type, block.props)}
      alwaysPlaceholder={['h1', 'h2', 'h3'].includes(block.type) || block.type === 'quote' || block.type === 'callout'}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onBlur={onBlur}
      onClick={onClick}
      highlight={isCode ? (t) => highlightCode(t, block.props.language) : undefined}
      spellCheck={!isCode}
      readOnly={readOnly}
    />
  );
}

export { escapeHtml, inlineMarkdown, htmlToText };
