import { memo, useState, type ReactNode } from 'react';
import { useStore, getPagePath, pageTitle } from '../../store/store';
import type { Block, ID } from '../../store/types';
import { useUI } from '../../store/ui';
import { TextBlock } from './TextBlock';
import { NESTABLE } from '../../lib/blockDefs';
import * as I from '../ui/Icons';
import { focusBlock } from './actions';
import { goPage } from '../../lib/router';
import { EmojiPopover } from '../ui/EmojiPicker';
import { PageIconView } from '../ui/PageIcon';
import { MediaBlock, BookmarkBlock, EquationBlock, CodeBlock, EmbedBlock } from './Media';
import { SimpleTable } from './SimpleTable';
import { DatabaseBlock } from '../db/Database';
import { ColumnList } from './Columns';
import { ButtonBlock, SyncedBlock } from './Advanced';

const BULLETS = ['•', '◦', '▪'];

function numberLabel(n: number, depth: number) {
  const level = depth % 3;
  if (level === 0) return `${n}.`;
  if (level === 1) {
    let s = '';
    let x = n;
    while (x > 0) {
      x--;
      s = String.fromCharCode(97 + (x % 26)) + s;
      x = Math.floor(x / 26);
    }
    return `${s}.`;
  }
  const romans: [number, string][] = [
    [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ];
  let s = '';
  let x = n;
  for (const [v, r] of romans) while (x >= v) { s += r; x -= v; }
  return `${s}.`;
}

export function BlockList({ ids, depth = 0, readOnly }: { ids: ID[]; depth?: number; readOnly?: boolean }) {
  const blocks = useStore((s) => s.blocks);
  let num = 0;
  return (
    <>
      {ids.map((id) => {
        const b = blocks[id];
        if (!b) return null;
        if ((b.type === 'page' || b.type === 'database') && b.props.trashed) return null;
        if (b.type === 'numbered') num = b.props.start && num === 0 ? b.props.start : num + 1;
        else num = 0;
        return <BlockView key={id} id={id} depth={depth} listIndex={num} readOnly={readOnly} />;
      })}
    </>
  );
}

export const BlockView = memo(function BlockView({ id, depth, listIndex, readOnly }: { id: ID; depth: number; listIndex: number; readOnly?: boolean }) {
  const b = useStore((s) => s.blocks[id]);
  const selected = useUI((s) => s.selected.includes(id));
  if (!b) return null;
  const color = b.props.color as string | undefined;
  const colorCls = color ? (color.endsWith('_background') ? `block-bg-${color.replace('_background', '')}` : `block-c-${color}`) : '';
  const nest = NESTABLE.includes(b.type) && b.type !== 'callout' && b.type !== 'synced';
  const isToggle = b.type === 'toggle' || !!b.props.toggleable;
  const showChildren = nest && b.children.length > 0 && (!isToggle || b.props.open);

  return (
    <div className={`block-wrap type-${b.type} ${colorCls} ${selected ? 'selected' : ''}`} data-block-id={id}>
      <div className="block-self" data-block-self={id}>
        <BlockContent b={b} depth={depth} listIndex={listIndex} readOnly={readOnly} />
      </div>
      {isToggle && b.props.open && b.children.length === 0 && (
        <div className="block-children">
          <div
            className="empty-toggle"
            onClick={() => {
              const nid = useStore.getState().createBlock(id, 0, 'text');
              focusBlock(nid, 'start');
            }}
          >
            {b.type === 'toggle' ? 'Empty toggle. Click or drop blocks inside.' : 'Empty toggle. Click or drop blocks inside.'}
          </div>
        </div>
      )}
      {showChildren && (
        <div className="block-children">
          <BlockList ids={b.children} depth={depth + 1} readOnly={readOnly} />
        </div>
      )}
    </div>
  );
});

function BlockContent({ b, depth, listIndex, readOnly }: { b: Block; depth: number; listIndex: number; readOnly?: boolean }) {
  const s = useStore.getState;
  switch (b.type) {
    case 'text':
      return <TextBlock block={b} className="txt" />;
    case 'h1':
    case 'h2':
    case 'h3':
      if (b.props.toggleable)
        return (
          <div className="row-with-marker">
            <ToggleArrow b={b} heading />
            <TextBlock block={b} className={`txt heading ${b.type}`} placeholder={`Toggle heading ${b.type.slice(1)}`} />
          </div>
        );
      return <TextBlock block={b} className={`txt heading ${b.type}`} />;
    case 'bulleted':
      return (
        <div className="row-with-marker">
          <div className="list-marker bullet">
            <span>{BULLETS[depth % 3]}</span>
          </div>
          <TextBlock block={b} className="txt" />
        </div>
      );
    case 'numbered':
      return (
        <div className="row-with-marker">
          <div className="list-marker number">
            <span>{numberLabel(listIndex || 1, depth)}</span>
          </div>
          <TextBlock block={b} className="txt" />
        </div>
      );
    case 'todo':
      return (
        <div className={`row-with-marker todo ${b.props.checked ? 'checked' : ''}`}>
          <div className="list-marker check-wrap">
            <div
              className={`checkbox ${b.props.checked ? 'on' : ''}`}
              role="checkbox"
              aria-checked={!!b.props.checked}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => !readOnly && s().setProps(b.id, { checked: !b.props.checked })}
            >
              {b.props.checked && <I.CheckIcon size={12} style={{ strokeWidth: 2.4 }} />}
            </div>
          </div>
          <TextBlock block={b} className="txt" />
        </div>
      );
    case 'toggle':
      return (
        <div className="row-with-marker">
          <ToggleArrow b={b} />
          <TextBlock block={b} className="txt" />
        </div>
      );
    case 'quote':
      return (
        <div className={`quote-wrap ${b.props.size === 'large' ? 'large' : ''}`}>
          <TextBlock block={b} className="txt" />
        </div>
      );
    case 'callout':
      return <Callout b={b} depth={depth} />;
    case 'divider':
      return (
        <div className="divider-wrap" onClick={() => useUI.getState().select([b.id])}>
          <div className="divider" />
        </div>
      );
    case 'code':
      return <CodeBlock b={b} />;
    case 'page':
      return <PageLink b={b} />;
    case 'link_to_page':
      return <PageLink b={b} linkTo />;
    case 'image':
    case 'video':
    case 'audio':
    case 'file':
      return <MediaBlock b={b} />;
    case 'embed':
      return <EmbedBlock b={b} />;
    case 'bookmark':
      return <BookmarkBlock b={b} />;
    case 'equation':
      return <EquationBlock b={b} />;
    case 'table':
      return <SimpleTable b={b} />;
    case 'database':
      return <DatabaseBlock id={b.props.linkedDb ?? b.id} inlineBlockId={b.id} />;
    case 'column_list':
      return <ColumnList b={b} />;
    case 'toc':
      return <Toc b={b} />;
    case 'breadcrumb':
      return <BreadcrumbBlock b={b} />;
    case 'button':
      return <ButtonBlock b={b} />;
    case 'synced':
      return <SyncedBlock b={b} depth={depth} />;
    default:
      return <div className="unsupported">Unsupported block</div>;
  }
}

function ToggleArrow({ b, heading }: { b: Block; heading?: boolean }) {
  return (
    <div
      className={`list-marker toggle-arrow ${heading ? 'heading-arrow ' + b.type : ''} ${b.props.open ? 'open' : ''}`}
      role="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => useStore.getState().setProps(b.id, { open: !b.props.open }, 'toggle')}
    >
      <I.TriangleRight size={heading ? 16 : 12} />
    </div>
  );
}

function Callout({ b, depth }: { b: Block; depth: number }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const icon = b.props.icon ?? '💡';
  return (
    <div className={`callout ${b.props.color ? '' : 'callout-default'} ${b.props.bordered ? 'bordered' : ''}`}>
      <div className="callout-icon" onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}>
        <PageIconView icon={icon} size={20} />
      </div>
      <div className="callout-body">
        <TextBlock block={b} className="txt" />
        {b.children.length > 0 && <BlockList ids={b.children} depth={depth + 1} />}
      </div>
      {anchor && (
        <EmojiPopover
          anchor={anchor}
          onClose={() => setAnchor(null)}
          onPick={(e) => {
            useStore.getState().setProps(b.id, { icon: e });
            setAnchor(null);
          }}
          onRemove={() => {
            useStore.getState().setProps(b.id, { icon: '' });
            setAnchor(null);
          }}
        />
      )}
    </div>
  );
}

function PageLink({ b, linkTo }: { b: Block; linkTo?: boolean }) {
  const target = useStore((s) => (linkTo ? s.blocks[b.props.pageId] : b));
  if (!target) return <div className="page-link deleted">Deleted page</div>;
  const isDb = target.type === 'database';
  return (
    <div
      className="page-link"
      onClick={() => goPage(target.id, pageTitle(target))}
      onMouseDown={(e) => {
        if (e.detail > 1) e.preventDefault();
      }}
    >
      <div className="page-link-icon">
        <PageIconView icon={target.props.icon} size={19} page={target} fallback={isDb ? 'db' : 'page'} />
        {linkTo && (
          <span className="link-arrow">
            <I.ArrowUpRight size={10} />
          </span>
        )}
      </div>
      <span className="page-link-title">{pageTitle(target)}</span>
    </div>
  );
}

function Toc({ b }: { b: Block }) {
  const blocks = useStore((s) => s.blocks);
  let page = blocks[b.parent ?? ''];
  while (page && page.type !== 'page') page = blocks[page.parent ?? ''];
  if (!page) return null;
  const heads: Block[] = [];
  const walk = (id: ID) => {
    const x = blocks[id];
    if (!x) return;
    for (const c of x.children) {
      const cb = blocks[c];
      if (!cb || cb.type === 'page' || cb.type === 'database') continue;
      if (['h1', 'h2', 'h3'].includes(cb.type)) heads.push(cb);
      walk(c);
    }
  };
  walk(page.id);
  const colorCls = b.props.color ? `c-${b.props.color}` : '';
  if (!heads.length)
    return <div className="toc-empty">Add headings to create a table of contents.</div>;
  const minLevel = Math.min(...heads.map((h) => Number(h.type[1])));
  return (
    <div className={`toc ${colorCls}`}>
      {heads.map((h) => (
        <div
          key={h.id}
          className="toc-item"
          style={{ marginLeft: (Number(h.type[1]) - minLevel) * 24 }}
          onClick={() => {
            const el = document.querySelector(`[data-block-id="${h.id}"]`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el?.classList.add('flash');
            setTimeout(() => el?.classList.remove('flash'), 1200);
          }}
          dangerouslySetInnerHTML={{ __html: h.text || 'Untitled' }}
        />
      ))}
    </div>
  );
}

function BreadcrumbBlock({ b }: { b: Block }) {
  const blocks = useStore((s) => s.blocks);
  const path = getPagePath(blocks, b.parent ?? '');
  return (
    <div className="breadcrumb-block">
      {path.map((p, i) => (
        <span key={p.id} className="bc-seg">
          {i > 0 && <span className="bc-slash">/</span>}
          <span className="bc-item" onClick={() => goPage(p.id, pageTitle(p))}>
            <PageIconView icon={p.props.icon} size={16} page={p} />
            <span>{pageTitle(p)}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

export function EmptyNode({ children }: { children: ReactNode }) {
  return <div className="empty-node">{children}</div>;
}
