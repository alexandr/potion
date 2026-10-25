import type { Block, ID, View } from '../../store/types';
import { setPeek, goPage } from '../../lib/router';
import { useStore } from '../../store/store';
import { addRow } from './dbUtils';

export function openRow(view: View | undefined, rowId: ID) {
  const mode = view?.openIn ?? 'side';
  if (mode === 'full') {
    const b = useStore.getState().blocks[rowId];
    goPage(rowId, b?.props.title ?? '');
  } else setPeek(rowId, mode === 'center' ? 'c' : 's');
}

/** focus the title of the freshly opened page (peek renders it) */
export function focusNewTitle() {
  let tries = 20;
  const run = () => {
    const el = document.querySelector('.peek [data-page-title], .peek .page-title [contenteditable], [data-page-title]') as HTMLElement | null;
    if (el) {
      el.focus();
      return;
    }
    if (tries-- > 0) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
}

export function createAndOpen(db: Block, view: View | undefined, values: Record<ID, any> = {}, index?: number) {
  // apply filter values so the new row stays visible (Notion does this)
  const v = { ...values };
  if (view) {
    for (const f of view.filters ?? []) {
      const p = db.props.schema[f.prop];
      if (!p || v[f.prop] !== undefined) continue;
      if ((p.type === 'select' || p.type === 'status') && f.op === 'is' && f.value) v[f.prop] = Array.isArray(f.value) ? f.value[0] : f.value;
      if (p.type === 'multi_select' && f.op === 'contains' && f.value) v[f.prop] = Array.isArray(f.value) ? [f.value[0]] : [f.value];
      if (p.type === 'checkbox' && f.op === 'is') v[f.prop] = !!f.value;
    }
  }
  const id = addRow(db.id, v, index);
  openRow(view?.openIn === 'full' ? { ...view, openIn: 'side' } : view, id);
  focusNewTitle();
  return id;
}
