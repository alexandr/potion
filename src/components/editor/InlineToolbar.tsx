import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { useStore } from '../../store/store';
import { useUI } from '../../store/ui';
import { Popover, MenuItem, MenuHeader, MOD } from '../ui/Popover';
import * as I from '../ui/Icons';
import {
  applyColor,
  currentColors,
  currentLink,
  editableOfSelection,
  isActive,
  offsetOf,
  restore,
  setLink,
  toggleFormat,
} from '../../lib/format';
import { TURN_INTO, COLOR_LIST, COLOR_NAMES, blockTypeLabel } from '../../lib/blockDefs';
import { turnInto } from './actions';
import { escapeHtml } from '../../lib/dom';
import { renderKatex } from './katex';
import { Tooltip } from '../ui/Tooltip';

interface ToolbarState {
  rect: DOMRect | null;
  blockId: string | null;
  saved: { root: HTMLElement; start: number; end: number } | null;
  sub: null | 'turn' | 'color' | 'link' | 'comment' | 'ai' | 'more';
  set: (p: Partial<ToolbarState>) => void;
}
export const useToolbar = create<ToolbarState>((set) => ({
  rect: null,
  blockId: null,
  saved: null,
  sub: null,
  set: (p) => set(p),
}));

function saveSelection() {
  const root = editableOfSelection();
  const sel = window.getSelection();
  if (!root || !sel || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0);
  return { root, start: offsetOf(root, r.startContainer, r.startOffset), end: offsetOf(root, r.endContainer, r.endOffset) };
}

export function openLinkEditor() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const root = editableOfSelection();
  if (!root) return;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  useToolbar.getState().set({ rect, blockId: root.getAttribute('data-editable'), saved: saveSelection(), sub: 'link' });
}

let lastColor: { c: string | null; kind: 'c' | 'bg' } = { c: 'red', kind: 'c' };

export function InlineToolbar() {
  const { rect, blockId, sub, set } = useToolbar();
  const block = useStore((s) => (blockId ? s.blocks[blockId] : undefined));
  const [, force] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mouseDown = false;
    const update = () => {
      if (useToolbar.getState().sub) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        if (useToolbar.getState().rect) set({ rect: null, blockId: null });
        return;
      }
      const root = editableOfSelection();
      if (!root || root.classList.contains('no-toolbar')) {
        if (useToolbar.getState().rect) set({ rect: null, blockId: null });
        return;
      }
      const id = root.getAttribute('data-editable');
      const b = id ? useStore.getState().blocks[id] : undefined;
      if (!b && !root.classList.contains('table-cell-edit')) {
        set({ rect: null, blockId: null });
        return;
      }
      if (b?.type === 'code') return;
      const r = sel.getRangeAt(0);
      const rects = r.getClientRects();
      const first = rects[0] ?? r.getBoundingClientRect();
      set({ rect: first, blockId: id });
      force((x) => x + 1);
    };
    const onUp = () => {
      mouseDown = false;
      setTimeout(update, 0);
    };
    const onDown = (e: MouseEvent) => {
      if (barRef.current?.contains(e.target as Node)) return;
      mouseDown = true;
      if (!useToolbar.getState().sub) set({ rect: null });
    };
    const onSel = () => {
      if (mouseDown) return;
      update();
    };
    document.addEventListener('mouseup', onUp);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('selectionchange', onSel);
    return () => {
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('selectionchange', onSel);
    };
  }, [set]);

  if (!rect) return null;

  const btn = (key: string, icon: React.ReactNode, onClick: () => void, active = false, tip?: string, extra?: string) => (
    <Tooltip label={tip ?? ''} shortcut={extra} key={key}>
      <div
        className={`tb-btn ${active ? 'active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault();
          onClick();
          force((x) => x + 1);
        }}
      >
        {icon}
      </div>
    </Tooltip>
  );

  const openSub = (s: ToolbarState['sub']) => set({ sub: s, saved: saveSelection() });
  const closeSub = () => {
    const saved = useToolbar.getState().saved;
    set({ sub: null });
    if (saved && document.contains(saved.root)) {
      saved.root.focus({ preventScroll: true });
      restore(saved.root, saved.start, saved.end);
    }
  };

  const top = Math.max(8, rect.top - 44);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - 560));
  const colors = currentColors();

  return (
    <>
      {!sub && (
        <div ref={barRef} className="inline-toolbar" style={{ top, left }} onMouseDown={(e) => e.preventDefault()}>
          <div className="tb-btn tb-text tb-ai" onMouseDown={(e) => { e.preventDefault(); openSub('ai'); }}>
            <I.SparkleIcon size={16} />
            <span>Ask AI</span>
          </div>
          <div className="tb-sep" />
          {block && (
            <div className="tb-btn tb-text" onMouseDown={(e) => { e.preventDefault(); openSub('turn'); }}>
              <span>{blockTypeLabel(block.type, block.props)}</span>
              <I.ChevronDown size={12} />
            </div>
          )}
          <div className="tb-sep" />
          <div className="tb-btn tb-text" onMouseDown={(e) => { e.preventDefault(); openSub('link'); }}>
            <I.LinkIcon size={16} />
            <span style={{ textDecoration: currentLink() ? 'underline' : undefined }}>Link</span>
          </div>
          <div className="tb-sep" />
          {btn('b', <I.BoldIcon size={16} />, () => toggleFormat('bold'), isActive('bold'), 'Bold', `${MOD}B`)}
          {btn('i', <I.ItalicIcon size={16} />, () => toggleFormat('italic'), isActive('italic'), 'Italicize', `${MOD}I`)}
          {btn('u', <I.UnderlineIcon size={16} />, () => toggleFormat('underline'), isActive('underline'), 'Underline', `${MOD}U`)}
          {btn('s', <I.StrikeIcon size={16} />, () => toggleFormat('strike'), isActive('strike'), 'Strike-through', `${MOD}⇧S`)}
          {btn('code', <I.CodeIcon size={16} />, () => toggleFormat('code'), isActive('code'), 'Mark as code', `${MOD}E`)}
          {btn('eq', <I.EquationIcon size={16} />, () => makeEquation(), false, 'Create equation', `${MOD}⇧E`)}
          <div className="tb-sep" />
          <Tooltip label="Text color">
            <div className="tb-btn tb-text" onMouseDown={(e) => { e.preventDefault(); openSub('color'); }}>
              <span
                className="tb-color-a"
                style={{
                  color: colors.c ? `var(--c-${colors.c})` : undefined,
                  background: colors.bg ? `var(--bg-${colors.bg})` : undefined,
                }}
              >
                A
              </span>
              <I.ChevronDown size={12} />
            </div>
          </Tooltip>
          <div className="tb-sep" />
          <div className="tb-btn tb-text" onMouseDown={(e) => { e.preventDefault(); openSub('comment'); }}>
            <I.CommentIcon size={16} />
            <span>Comment</span>
          </div>
          <div className="tb-sep" />
          {btn('more', <I.DotsIcon size={16} />, () => openSub('more'), false, 'More')}
        </div>
      )}
      {sub === 'turn' && block && (
        <Popover anchor={{ x: left, y: top, h: 36 }} onClose={closeSub} width={240}>
          <div className="menu">
            <MenuHeader>Turn into</MenuHeader>
            {TURN_INTO.map((t) => (
              <MenuItem
                key={t.label}
                icon={t.icon}
                label={t.label}
                checked={block.type === t.type && !!block.props.toggleable === !!t.props?.toggleable}
                onClick={() => {
                  set({ sub: null, rect: null });
                  turnInto(block.id, t.type, t.props);
                }}
              />
            ))}
          </div>
        </Popover>
      )}
      {sub === 'color' && (
        <Popover anchor={{ x: left + 300, y: top, h: 36 }} onClose={closeSub} width={220}>
          <ColorMenu
            current={colors}
            onPick={(c, kind) => {
              const saved = useToolbar.getState().saved;
              if (saved) restore(saved.root, saved.start, saved.end);
              applyColor(c ? `${kind}-${c}` : null, kind);
              lastColor = { c, kind };
              set({ sub: null, rect: null });
            }}
          />
        </Popover>
      )}
      {sub === 'link' && <LinkEditor anchor={{ x: left, y: top, h: 36 }} onDone={closeSub} />}
      {sub === 'comment' && <CommentComposer anchor={{ x: left, y: top, h: 36 }} onDone={closeSub} />}
      {sub === 'ai' && (
        <Popover anchor={{ x: left, y: top, h: 36 }} onClose={closeSub} width={300}>
          <div className="menu">
            <div className="ai-input-row">
              <I.SparkleIcon size={18} style={{ color: 'var(--purple, #9065b0)' }} />
              <input autoFocus placeholder="Ask AI anything…" className="ai-input" onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  useUI.getState().showToast('Potion AI is not available in this demo workspace');
                  closeSub();
                }
              }} />
            </div>
            <MenuHeader>Edit or review selection</MenuHeader>
            {['Improve writing', 'Fix spelling & grammar', 'Make shorter', 'Make longer', 'Change tone', 'Simplify language'].map((l) => (
              <MenuItem key={l} icon={<I.SparkleIcon size={16} />} label={l} onClick={() => aiTransform(l, closeSub)} />
            ))}
            <MenuHeader>Generate from selection</MenuHeader>
            {['Summarize', 'Translate', 'Explain this', 'Find action items'].map((l) => (
              <MenuItem key={l} icon={<I.SparkleIcon size={16} />} label={l} onClick={() => aiTransform(l, closeSub)} />
            ))}
          </div>
        </Popover>
      )}
      {sub === 'more' && (
        <Popover anchor={{ x: left + 480, y: top, h: 36 }} onClose={closeSub} width={220}>
          <div className="menu">
            <MenuItem icon={<I.AtIcon size={16} />} label="Mention a page" onClick={() => closeSub()} />
            <MenuItem
              icon={<I.PaintIcon size={16} />}
              label="Repeat last color"
              shortcut={`${MOD}⇧H`}
              onClick={() => {
                const saved = useToolbar.getState().saved;
                if (saved) restore(saved.root, saved.start, saved.end);
                applyColor(lastColor.c ? `${lastColor.kind}-${lastColor.c}` : null, lastColor.kind);
                set({ sub: null, rect: null });
              }}
            />
            <MenuItem
              icon={<I.CloseIcon size={16} />}
              label="Clear formatting"
              onClick={() => {
                const saved = useToolbar.getState().saved;
                if (saved) {
                  restore(saved.root, saved.start, saved.end);
                  const r = window.getSelection()!.getRangeAt(0);
                  const t = r.toString();
                  r.deleteContents();
                  r.insertNode(document.createTextNode(t));
                  saved.root.dispatchEvent(new Event('input', { bubbles: true }));
                }
                set({ sub: null, rect: null });
              }}
            />
          </div>
        </Popover>
      )}
    </>
  );
}

function aiTransform(kind: string, done: () => void) {
  const saved = useToolbar.getState().saved;
  if (!saved) return done();
  restore(saved.root, saved.start, saved.end);
  const sel = window.getSelection()!;
  const text = sel.toString();
  let out: string | null = null;
  if (kind === 'Make shorter') out = text.split(/(?<=[.!?])\s+/)[0];
  if (kind === 'Simplify language') out = text.replace(/\b(utilize|leverage)\b/gi, 'use');
  if (kind === 'Fix spelling & grammar') out = text.replace(/\s+/g, ' ').replace(/\bi\b/g, 'I').replace(/^\w/, (c) => c.toUpperCase());
  if (out != null && out !== text) {
    document.execCommand('insertText', false, out);
    done();
    return;
  }
  useUI.getState().showToast('Potion AI is not available in this demo workspace');
  done();
}

function makeEquation() {
  const sel = window.getSelection();
  const root = editableOfSelection();
  if (!sel || !root || sel.isCollapsed) return;
  const expr = sel.toString();
  const r = sel.getRangeAt(0);
  r.deleteContents();
  const span = document.createElement('span');
  span.className = 'equation-inline';
  span.setAttribute('contenteditable', 'false');
  span.setAttribute('data-expr', expr);
  span.innerHTML = renderKatex(expr, false);
  r.insertNode(span);
  root.dispatchEvent(new Event('input', { bubbles: true }));
  useToolbar.getState().set({ rect: null });
}

export function ColorMenu({
  current,
  onPick,
}: {
  current: { c: string | null; bg: string | null };
  onPick: (c: string | null, kind: 'c' | 'bg') => void;
}) {
  return (
    <div className="menu">
      <MenuHeader>Text color</MenuHeader>
      {COLOR_LIST.map((c) => (
        <MenuItem
          key={'c' + c}
          icon={
            <div className="color-swatch" style={{ color: c === 'default' ? 'var(--text)' : `var(--c-${c})` }}>
              A
            </div>
          }
          label={c === 'default' ? 'Default text' : `${COLOR_NAMES[c]} text`}
          checked={(current.c ?? 'default') === c}
          onClick={() => onPick(c === 'default' ? null : c, 'c')}
        />
      ))}
      <MenuHeader>Background color</MenuHeader>
      {COLOR_LIST.map((c) => (
        <MenuItem
          key={'b' + c}
          icon={
            <div className="color-swatch" style={{ background: c === 'default' ? 'transparent' : `var(--bg-${c})` }}>
              A
            </div>
          }
          label={c === 'default' ? 'Default background' : `${COLOR_NAMES[c]} background`}
          checked={(current.bg ?? 'default') === c}
          onClick={() => onPick(c === 'default' ? null : c, 'bg')}
        />
      ))}
    </div>
  );
}

function LinkEditor({ anchor, onDone }: { anchor: { x: number; y: number; h: number }; onDone: () => void }) {
  const saved = useToolbar.getState().saved;
  const existing = (() => {
    if (!saved) return '';
    restore(saved.root, saved.start, saved.end);
    return currentLink() ?? '';
  })();
  const [v, setV] = useState(existing);
  const pages = useStore((s) => s.blocks);
  const q = v.trim().toLowerCase();
  const matches =
    q && !/^https?:|^www\./.test(q)
      ? Object.values(pages)
          .filter((b) => (b.type === 'page' || b.type === 'database') && !b.props.trashed && (b.props.title ?? '').toLowerCase().includes(q))
          .slice(0, 6)
      : [];
  const apply = (href: string | null) => {
    if (saved) setLink(href, saved);
    useToolbar.getState().set({ sub: null, rect: null });
  };
  return (
    <Popover anchor={anchor} onClose={onDone} width={360}>
      <div className="menu link-editor">
        <input
          autoFocus
          className="text-input"
          placeholder="Paste link or search pages"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              let href = v.trim();
              if (!href) return apply(null);
              if (matches.length && !/^https?:|^www\./.test(href)) {
                href = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${matches[0].id}`;
              } else if (!/^[a-z]+:/i.test(href) && !href.startsWith('/')) href = 'https://' + href;
              apply(href);
            }
          }}
        />
        {matches.length > 0 && <MenuHeader>Link to page</MenuHeader>}
        {matches.map((p) => (
          <MenuItem
            key={p.id}
            icon={<span className="menu-emoji">{p.props.icon || '📄'}</span>}
            label={escapeHtml(p.props.title || 'Untitled')}
            onClick={() => apply(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/${p.id}`)}
          />
        ))}
        {existing && (
          <>
            <MenuItem icon={<I.ArrowUpRight size={16} />} label="Open link" onClick={() => window.open(existing, '_blank')} />
            <MenuItem icon={<I.TrashIcon size={16} />} label="Remove link" onClick={() => apply(null)} />
          </>
        )}
      </div>
    </Popover>
  );
}

function CommentComposer({ anchor, onDone }: { anchor: { x: number; y: number; h: number }; onDone: () => void }) {
  const [v, setV] = useState('');
  const saved = useToolbar.getState().saved;
  const me = useStore((s) => s.users[s.me]);
  const submit = () => {
    if (!v.trim() || !saved) return onDone();
    const s = useStore.getState();
    const blockId = saved.root.getAttribute('data-editable');
    const b = blockId ? s.blocks[blockId] : undefined;
    let page = b;
    while (page && page.type !== 'page') page = page.parent ? s.blocks[page.parent] : undefined;
    restore(saved.root, saved.start, saved.end);
    const quote = window.getSelection()!.toString();
    const did = s.addDiscussion(page?.id ?? '', blockId, quote, v.trim());
    const r = window.getSelection()!.getRangeAt(0);
    const span = document.createElement('span');
    span.className = 'comment-mark';
    span.setAttribute('data-discussion', did);
    span.appendChild(r.extractContents());
    r.insertNode(span);
    saved.root.dispatchEvent(new Event('input', { bubbles: true }));
    useToolbar.getState().set({ sub: null, rect: null });
    useUI.getState().set({ commentsOpen: true });
  };
  return (
    <Popover anchor={anchor} onClose={onDone} width={400}>
      <div className="comment-composer">
        <div className="avatar" style={{ background: me?.color }}>
          {me?.name[0]}
        </div>
        <input
          autoFocus
          className="comment-input"
          placeholder="Add a comment…"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button className={`send-btn ${v.trim() ? 'on' : ''}`} onClick={submit}>
          <I.ArrowUpIcon size={16} />
        </button>
      </div>
    </Popover>
  );
}
