import { useState } from 'react';
import { useStore } from '../../store/store';
import type { Block } from '../../store/types';
import { BlockList } from './Block';
import { Popover, MenuItem, MenuHeader } from '../ui/Popover';
import * as I from '../ui/Icons';
import { focusBlock } from './actions';

const ACTIONS = [
  { key: 'todo', label: 'Insert a to-do' },
  { key: 'text', label: 'Insert text' },
  { key: 'date', label: 'Insert today’s date' },
  { key: 'page', label: 'Add a new page' },
];

export function ButtonBlock({ b }: { b: Block }) {
  const [edit, setEdit] = useState<DOMRect | null>(null);
  const s = useStore.getState;
  const label = b.props.label ?? 'New button';
  const action = b.props.action ?? 'todo';
  const run = () => {
    const st = s();
    st.batch(() => {
      let nid: string;
      if (action === 'todo') nid = st.insertBlockAfter(b.id, 'todo', b.props.content ?? '');
      else if (action === 'date') nid = st.insertBlockAfter(b.id, 'text', new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }));
      else if (action === 'page') {
        const p = st.blocks[b.parent!];
        nid = st.createPage(p.id, { title: b.props.content || 'Untitled' }, p.children.indexOf(b.id) + 1);
        return;
      } else nid = st.insertBlockAfter(b.id, 'text', b.props.content ?? '');
      focusBlock(nid, 'end');
    });
  };
  return (
    <div className="button-block">
      <button className="potion-button" onMouseDown={(e) => e.preventDefault()} onClick={run}>
        <span className="pb-icon">{b.props.icon || <I.LightningIcon size={14} />}</span>
        {label}
      </button>
      <div className="button-edit" onClick={(e) => setEdit(e.currentTarget.getBoundingClientRect())}>
        <I.SettingsIcon size={14} />
      </div>
      {edit && (
        <Popover anchor={edit} onClose={() => setEdit(null)} width={300}>
          <div className="menu" style={{ padding: 8 }}>
            <MenuHeader>Button name</MenuHeader>
            <input className="text-input" autoFocus value={label} onChange={(e) => s().setProps(b.id, { label: e.target.value }, `btn:${b.id}`)} />
            <MenuHeader>Do this</MenuHeader>
            {ACTIONS.map((a) => (
              <MenuItem key={a.key} label={a.label} checked={a.key === action} onClick={() => s().setProps(b.id, { action: a.key })} />
            ))}
            {action !== 'date' && (
              <>
                <MenuHeader>Content</MenuHeader>
                <input className="text-input" placeholder="Text to insert" value={b.props.content ?? ''} onChange={(e) => s().setProps(b.id, { content: e.target.value }, `btnc:${b.id}`)} />
              </>
            )}
          </div>
        </Popover>
      )}
    </div>
  );
}

export function SyncedBlock({ b, depth }: { b: Block; depth: number }) {
  const source = useStore((s) => (b.props.sourceId ? s.blocks[b.props.sourceId] : b));
  if (!source) return <div className="synced-block missing">Original synced block was deleted</div>;
  return (
    <div className="synced-block">
      <div className="synced-label">
        <I.SyncIcon size={12} /> {b.props.sourceId ? 'Synced from another page' : 'Synced block'}
      </div>
      {source.children.length ? (
        <BlockList ids={source.children} depth={depth} />
      ) : (
        <div
          className="empty-toggle"
          onClick={() => {
            const nid = useStore.getState().createBlock(source.id, 0, 'text');
            focusBlock(nid, 'start');
          }}
        >
          Type something to sync…
        </div>
      )}
    </div>
  );
}
