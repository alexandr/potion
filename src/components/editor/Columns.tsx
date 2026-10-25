import { useRef } from 'react';
import { useStore } from '../../store/store';
import type { Block } from '../../store/types';
import { BlockList } from './Block';
import { focusBlock } from './actions';

export function ColumnList({ b }: { b: Block }) {
  const blocks = useStore((s) => s.blocks);
  const ref = useRef<HTMLDivElement>(null);
  const cols = b.children.map((c) => blocks[c]).filter(Boolean);
  const startResize = (e: React.MouseEvent, i: number) => {
    e.preventDefault();
    const total = ref.current!.getBoundingClientRect().width;
    const a = cols[i];
    const c = cols[i + 1];
    const wa0 = a.props.width ?? 1 / cols.length;
    const wc0 = c.props.width ?? 1 / cols.length;
    const x0 = e.clientX;
    useStore.getState().checkpoint();
    const move = (ev: MouseEvent) => {
      const d = (ev.clientX - x0) / total;
      const sum = wa0 + wc0;
      const wa = Math.max(0.1, Math.min(sum - 0.1, wa0 + d));
      useStore.setState((st) => ({
        blocks: {
          ...st.blocks,
          [a.id]: { ...st.blocks[a.id], props: { ...st.blocks[a.id].props, width: wa } },
          [c.id]: { ...st.blocks[c.id], props: { ...st.blocks[c.id].props, width: sum - wa } },
        },
      }));
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.classList.remove('col-resizing');
    };
    document.body.classList.add('col-resizing');
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  return (
    <div className="column-list" ref={ref}>
      {cols.map((col, i) => (
        <div key={col.id} className="column" data-block-id={col.id} data-column={col.id} style={{ flexGrow: col.props.width ?? 1 / cols.length, flexBasis: 0 }}>
          <BlockList ids={col.children} depth={0} />
          <div
            className="column-tail"
            onClick={() => {
              const last = blocks[col.children[col.children.length - 1]];
              if (last && last.type === 'text' && !last.text) focusBlock(last.id, 'start');
              else {
                const nid = useStore.getState().createBlock(col.id, col.children.length, 'text');
                focusBlock(nid, 'start');
              }
            }}
          />
          {i < cols.length - 1 && (
            <div className="column-gutter" onMouseDown={(e) => startResize(e, i)}>
              <div className="column-gutter-line" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
