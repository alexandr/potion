import { useStore, uid } from '../../store/store';
import type { Block, Color, Filter, ID, PropertySchema, PropType, SelectOption, Sort, View, ViewType } from '../../store/types';
import { evaluateFormula, formulaToString, type FormulaValue } from './formula';

export const S = () => useStore.getState();

export function getDb(id: ID): Block | undefined {
  return S().blocks[id];
}

export function schemaList(db: Block): PropertySchema[] {
  return Object.values((db.props.schema ?? {}) as Record<ID, PropertySchema>);
}

/** ordered visible properties for a view */
export function viewProps(db: Block, view: View): PropertySchema[] {
  const schema = (db.props.schema ?? {}) as Record<ID, PropertySchema>;
  const order = [...(view.propOrder ?? [])].filter((p) => schema[p]);
  Object.keys(schema).forEach((k) => {
    if (!order.includes(k)) order.push(k);
  });
  // title first
  const t = order.indexOf('title');
  if (t > 0) {
    order.splice(t, 1);
    order.unshift('title');
  }
  return order.map((k) => schema[k]);
}

export function isHidden(view: View, propId: ID): boolean {
  if (propId === 'title') return false;
  if (view.hidden?.includes(propId)) return true;
  // properties not in propOrder (newly added elsewhere) are hidden in non-table views by default
  return false;
}

export function visibleProps(db: Block, view: View): PropertySchema[] {
  return viewProps(db, view).filter((p) => !isHidden(view, p.id));
}

// ---------- mutations ----------
export function updateDb(dbId: ID, patch: Record<string, any>, key?: string) {
  S().setProps(dbId, patch, key);
}

export function updateView(dbId: ID, viewId: ID, patch: Partial<View>, key?: string) {
  const db = getDb(dbId);
  if (!db) return;
  const views = (db.props.views as View[]).map((v) => (v.id === viewId ? { ...v, ...patch } : v));
  updateDb(dbId, { views }, key);
}

export function updateSchema(dbId: ID, propId: ID, patch: Partial<PropertySchema>, key?: string) {
  const db = getDb(dbId);
  if (!db) return;
  const schema = { ...db.props.schema, [propId]: { ...db.props.schema[propId], ...patch } };
  updateDb(dbId, { schema }, key);
}

export function addProperty(dbId: ID, type: PropType, name?: string, viewId?: ID, index?: number): ID {
  const db = getDb(dbId);
  if (!db) return '';
  const id = uid(6);
  const existing = schemaList(db).map((p) => p.name);
  let base = name ?? PROP_TYPES.find((t) => t.type === type)?.label ?? 'Property';
  if (!name) {
    let n = base;
    let i = 1;
    while (existing.includes(n)) n = `${base} ${i++}`;
    base = n;
  }
  const p: PropertySchema = { id, name: base, type };
  if (type === 'select' || type === 'multi_select') p.options = [];
  if (type === 'status')
    p.options = [
      { id: uid(6), name: 'Not started', color: 'default', group: 'todo' },
      { id: uid(6), name: 'In progress', color: 'blue', group: 'in_progress' },
      { id: uid(6), name: 'Done', color: 'green', group: 'complete' },
    ];
  if (type === 'number') p.numberFormat = 'number';
  if (type === 'formula') p.formula = '';
  if (type === 'unique_id') p.prefix = '';
  const schema = { ...db.props.schema, [id]: p };
  const views = (db.props.views as View[]).map((v) => {
    const order = [...(v.propOrder ?? Object.keys(db.props.schema))];
    if (v.id === viewId && index != null) order.splice(index, 0, id);
    else order.push(id);
    const hidden = v.id === viewId || v.type === 'table' ? v.hidden ?? [] : [...(v.hidden ?? []), id];
    return { ...v, propOrder: order, hidden };
  });
  updateDb(dbId, { schema, views });
  return id;
}

export function deleteProperty(dbId: ID, propId: ID) {
  const db = getDb(dbId);
  if (!db || propId === 'title') return;
  const schema = { ...db.props.schema };
  delete schema[propId];
  const views = (db.props.views as View[]).map((v) => ({
    ...v,
    propOrder: (v.propOrder ?? []).filter((x) => x !== propId),
    hidden: (v.hidden ?? []).filter((x) => x !== propId),
    groupBy: v.groupBy === propId ? null : v.groupBy,
    dateProp: v.dateProp === propId ? null : v.dateProp,
    filters: v.filters.filter((f) => f.prop !== propId),
    sorts: v.sorts.filter((f) => f.prop !== propId),
  }));
  updateDb(dbId, { schema, views });
}

export function duplicateProperty(dbId: ID, propId: ID, viewId: ID) {
  const db = getDb(dbId);
  if (!db) return;
  const src = db.props.schema[propId] as PropertySchema;
  const view = (db.props.views as View[]).find((v) => v.id === viewId);
  const order = view ? viewProps(db, view).map((p) => p.id) : [];
  const nid = addProperty(dbId, src.type === 'title' ? 'text' : src.type, `${src.name} (1)`, viewId, order.indexOf(propId) + 1);
  const st = S();
  st.batch(() => {
    updateSchema(dbId, nid, { ...src, id: nid, type: src.type === 'title' ? 'text' : src.type, name: `${src.name} (1)` });
    const fresh = getDb(dbId)!;
    fresh.children.forEach((r) => {
      const row = st.blocks[r];
      if (!row) return;
      const v = propId === 'title' ? row.props.title : row.props.values?.[propId];
      if (v !== undefined) setValueRaw(r, nid, v);
    });
  });
}

export function changePropType(dbId: ID, propId: ID, type: PropType) {
  const db = getDb(dbId);
  if (!db) return;
  const p = db.props.schema[propId] as PropertySchema;
  const st = S();
  st.batch(() => {
    const patch: Partial<PropertySchema> = { type };
    let options: SelectOption[] = p.options ?? [];
    if ((type === 'select' || type === 'multi_select' || type === 'status') && !(p.type === 'select' || p.type === 'multi_select' || p.type === 'status')) {
      // build options from existing text values
      const names = new Set<string>();
      db.children.forEach((r) => {
        const v = st.blocks[r]?.props.values?.[propId];
        if (typeof v === 'string' && v.trim()) v.split(',').forEach((x) => names.add(x.trim()));
      });
      options = Array.from(names).map((n, i) => ({ id: uid(6), name: n, color: COLORS[(i + 1) % COLORS.length] }));
      if (type === 'status' && !options.length)
        options = [
          { id: uid(6), name: 'Not started', color: 'default', group: 'todo' },
          { id: uid(6), name: 'In progress', color: 'blue', group: 'in_progress' },
          { id: uid(6), name: 'Done', color: 'green', group: 'complete' },
        ];
      patch.options = options;
    }
    if (type === 'status') patch.options = (patch.options ?? options).map((o) => ({ ...o, group: o.group ?? 'todo' }));
    if (type === 'number' && !p.numberFormat) patch.numberFormat = 'number';
    updateSchema(dbId, propId, patch);
    // convert values
    db.children.forEach((r) => {
      const row = st.blocks[r];
      if (!row) return;
      const v = row.props.values?.[propId];
      if (v === undefined) return;
      let nv: any = v;
      const asText = valueToText(db, p, v);
      switch (type) {
        case 'text':
        case 'url':
        case 'email':
        case 'phone':
          nv = asText;
          break;
        case 'number':
          nv = parseFloat(asText);
          if (isNaN(nv)) nv = undefined;
          break;
        case 'checkbox':
          nv = !!v && v !== 'false' && v !== '0';
          break;
        case 'select':
        case 'status': {
          const first = Array.isArray(v) ? v[0] : v;
          const byId = options.find((o) => o.id === first);
          const byName = options.find((o) => o.name === (typeof first === 'string' ? first.split(',')[0].trim() : ''));
          nv = byId?.id ?? byName?.id;
          break;
        }
        case 'multi_select': {
          if (Array.isArray(v)) nv = v;
          else if (options.find((o) => o.id === v)) nv = [v];
          else nv = String(v).split(',').map((x) => options.find((o) => o.name === x.trim())?.id).filter(Boolean);
          break;
        }
        case 'date':
          nv = typeof v === 'object' && v?.start ? v : undefined;
          break;
        default:
          nv = undefined;
      }
      setValueRaw(r, propId, nv);
    });
  });
}

function setValueRaw(rowId: ID, propId: ID, value: any) {
  const st = S();
  const row = st.blocks[rowId];
  if (!row) return;
  if (propId === 'title') {
    st.setProps(rowId, { title: value ?? '' });
    return;
  }
  st.setProps(rowId, { values: { ...(row.props.values ?? {}), [propId]: value } });
}

export function setValue(rowId: ID, propId: ID, value: any, key?: string) {
  const st = S();
  const row = st.blocks[rowId];
  if (!row) return;
  if (propId === 'title') {
    st.setProps(rowId, { title: value ?? '' }, key);
    return;
  }
  st.setProps(rowId, { values: { ...(row.props.values ?? {}), [propId]: value } }, key);
}

export function addOption(dbId: ID, propId: ID, name: string, color?: Color, group?: SelectOption['group']): SelectOption {
  const db = getDb(dbId)!;
  const p = db.props.schema[propId] as PropertySchema;
  const opts = p.options ?? [];
  const o: SelectOption = { id: uid(6), name, color: color ?? COLORS[(opts.length + 1) % COLORS.length] };
  if (p.type === 'status') o.group = group ?? 'todo';
  updateSchema(dbId, propId, { options: [...opts, o] });
  return o;
}

export function updateOption(dbId: ID, propId: ID, optId: ID, patch: Partial<SelectOption>) {
  const db = getDb(dbId)!;
  const p = db.props.schema[propId] as PropertySchema;
  updateSchema(dbId, propId, { options: (p.options ?? []).map((o) => (o.id === optId ? { ...o, ...patch } : o)) });
}

export function deleteOption(dbId: ID, propId: ID, optId: ID) {
  const db = getDb(dbId)!;
  const p = db.props.schema[propId] as PropertySchema;
  updateSchema(dbId, propId, { options: (p.options ?? []).filter((o) => o.id !== optId) });
}

export function addRow(dbId: ID, values: Record<ID, any> = {}, index?: number, title = ''): ID {
  const st = S();
  const db = getDb(dbId);
  if (!db) return '';
  // status properties start at their default ("Not started") option, like Notion
  const vals = { ...values };
  for (const p of Object.values(db.props.schema ?? {}) as PropertySchema[]) {
    if (p.type === 'status' && vals[p.id] === undefined) {
      const def = p.options?.find((o) => o.id === (p as any).defaultOption) ?? p.options?.find((o) => o.group === 'todo') ?? p.options?.[0];
      if (def) vals[p.id] = def.id;
    }
  }
  const id = st.createPage(dbId, { title, values: vals }, index);
  return id;
}

export function newView(db: Block, type: ViewType, name?: string): View {
  const schema = (db.props.schema ?? {}) as Record<ID, PropertySchema>;
  const list = Object.values(schema);
  const v: View = {
    id: uid(),
    name: name ?? VIEW_TYPES.find((t) => t.type === type)!.label,
    type,
    filters: [],
    sorts: [],
    propOrder: Object.keys(schema),
    hidden: [],
    widths: {},
    calcs: {},
  };
  if (type === 'board' || type === 'chart') {
    const g = list.find((p) => p.type === 'status') ?? list.find((p) => p.type === 'select');
    v.groupBy = g?.id ?? null;
  }
  if (type === 'calendar' || type === 'timeline') {
    v.dateProp = list.find((p) => p.type === 'date')?.id ?? null;
  }
  if (type === 'gallery') v.cardPreview = 'cover';
  if (type !== 'table') v.hidden = list.filter((p) => p.type !== 'title' && !['select', 'status', 'multi_select', 'person', 'date'].includes(p.type)).map((p) => p.id);
  if (type === 'chart') v.chartType = 'bar';
  return v;
}

/** ensure a date property exists for calendar/timeline */
export function ensureDateProp(dbId: ID, viewId: ID) {
  const db = getDb(dbId);
  if (!db) return;
  const d = schemaList(db).find((p) => p.type === 'date');
  if (d) {
    updateView(dbId, viewId, { dateProp: d.id });
    return;
  }
  const id = addProperty(dbId, 'date', 'Date');
  updateView(dbId, viewId, { dateProp: id });
}

export function ensureGroupProp(dbId: ID, viewId: ID) {
  const db = getDb(dbId);
  if (!db) return;
  const d = schemaList(db).find((p) => p.type === 'status') ?? schemaList(db).find((p) => p.type === 'select');
  if (d) {
    updateView(dbId, viewId, { groupBy: d.id });
    return;
  }
  const id = addProperty(dbId, 'status', 'Status');
  updateView(dbId, viewId, { groupBy: id });
}

// ---------- constants ----------
export const COLORS: Color[] = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];

export const PROP_TYPES: { type: PropType; label: string; desc?: string }[] = [
  { type: 'text', label: 'Text' },
  { type: 'number', label: 'Number' },
  { type: 'select', label: 'Select' },
  { type: 'multi_select', label: 'Multi-select' },
  { type: 'status', label: 'Status' },
  { type: 'date', label: 'Date' },
  { type: 'person', label: 'Person' },
  { type: 'files', label: 'Files & media' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'url', label: 'URL' },
  { type: 'email', label: 'Email' },
  { type: 'phone', label: 'Phone' },
  { type: 'formula', label: 'Formula' },
  { type: 'relation', label: 'Relation' },
  { type: 'rollup', label: 'Rollup' },
  { type: 'created_time', label: 'Created time' },
  { type: 'created_by', label: 'Created by' },
  { type: 'last_edited_time', label: 'Last edited time' },
  { type: 'last_edited_by', label: 'Last edited by' },
  { type: 'unique_id', label: 'ID' },
];

export const VIEW_TYPES: { type: ViewType; label: string }[] = [
  { type: 'table', label: 'Table' },
  { type: 'board', label: 'Board' },
  { type: 'timeline', label: 'Timeline' },
  { type: 'calendar', label: 'Calendar' },
  { type: 'list', label: 'List' },
  { type: 'gallery', label: 'Gallery' },
  { type: 'chart', label: 'Chart' },
  { type: 'feed', label: 'Feed' },
];

export const NUMBER_FORMATS: { id: string; label: string }[] = [
  { id: 'number', label: 'Number' },
  { id: 'commas', label: 'Number with commas' },
  { id: 'percent', label: 'Percent' },
  { id: 'dollar', label: 'US dollar' },
  { id: 'euro', label: 'Euro' },
  { id: 'pound', label: 'Pound' },
  { id: 'yen', label: 'Yen' },
  { id: 'rupee', label: 'Rupee' },
  { id: 'won', label: 'Won' },
  { id: 'yuan', label: 'Yuan' },
];

// ---------- value helpers ----------
export function getRawValue(row: Block, p: PropertySchema): any {
  switch (p.type) {
    case 'title':
      return row.props.title ?? '';
    case 'created_time':
      return row.createdAt;
    case 'last_edited_time':
      return row.updatedAt;
    case 'created_by':
      return [row.createdBy];
    case 'last_edited_by':
      return [row.lastEditedBy];
    default:
      return row.props.values?.[p.id];
  }
}

export function rowIndex(db: Block, rowId: ID) {
  // unique id: creation order
  const st = S();
  const rows = db.children.map((c) => st.blocks[c]).filter(Boolean);
  const sorted = [...rows].sort((a, b) => a.createdAt - b.createdAt || db.children.indexOf(a.id) - db.children.indexOf(b.id));
  return sorted.findIndex((r) => r.id === rowId) + 1;
}

export function computeValue(db: Block, row: Block, p: PropertySchema, depth = 0): any {
  if (p.type === 'formula') return computeFormula(db, row, p, depth).value;
  if (p.type === 'unique_id') return rowIndex(db, row.id);
  if (p.type === 'rollup') return computeRollup(db, row, p);
  return getRawValue(row, p);
}

export function computeFormula(db: Block, row: Block, p: PropertySchema, depth = 0): { value: FormulaValue; error?: string } {
  if (depth > 4) return { value: null, error: 'Circular reference' };
  const schema = schemaList(db);
  return evaluateFormula(p.formula ?? '', (name) => {
    const target = schema.find((x) => x.name === name);
    if (!target) throw new Error(`Property "${name}" not found`);
    const v = computeValue(db, row, target, depth + 1);
    switch (target.type) {
      case 'select':
      case 'status':
        return target.options?.find((o) => o.id === v)?.name ?? '';
      case 'multi_select':
        return ((v as ID[]) ?? []).map((id) => target.options?.find((o) => o.id === id)?.name ?? '');
      case 'date':
        return v?.start ? new Date(v.start + 'T00:00:00') : null;
      case 'created_time':
      case 'last_edited_time':
        return new Date(v);
      case 'person':
      case 'created_by':
      case 'last_edited_by':
        return ((v as ID[]) ?? []).map((u) => S().users[u]?.name ?? '');
      case 'checkbox':
        return !!v;
      case 'number':
        return typeof v === 'number' ? v : null;
      case 'relation':
        return ((v as ID[]) ?? []).map((r) => S().blocks[r]?.props.title ?? '');
      default:
        return v ?? '';
    }
  });
}

export function computeRollup(_db: Block, row: Block, p: PropertySchema): any {
  const r = p.rollup;
  if (!r) return null;
  const ids = (row.props.values?.[r.relationProp] as ID[]) ?? [];
  const st = S();
  const relProp = _db.props.schema[r.relationProp] as PropertySchema | undefined;
  const target = relProp?.relationDb ? st.blocks[relProp.relationDb] : undefined;
  if (!target) return null;
  const tp = target.props.schema[r.targetProp] as PropertySchema | undefined;
  const vals = ids.map((id) => st.blocks[id]).filter(Boolean).map((rb) => (tp ? computeValue(target, rb, tp) : rb.props.title));
  switch (r.fn) {
    case 'count':
      return ids.length;
    case 'sum':
      return vals.reduce((a, b) => a + (Number(b) || 0), 0);
    case 'average':
      return vals.length ? vals.reduce((a, b) => a + (Number(b) || 0), 0) / vals.length : null;
    case 'min':
      return vals.length ? Math.min(...vals.map(Number)) : null;
    case 'max':
      return vals.length ? Math.max(...vals.map(Number)) : null;
    default:
      return vals.map((v) => (tp ? valueToText(target, tp, v) : String(v ?? ''))).filter(Boolean).join(', ');
  }
}

export function formatNumber(n: any, fmt = 'number'): string {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '';
  const v = Number(n);
  const cur = (sym: string, code: string, loc = 'en-US') => {
    try {
      return new Intl.NumberFormat(loc, { style: 'currency', currency: code }).format(v);
    } catch {
      return sym + v;
    }
  };
  switch (fmt) {
    case 'commas':
      return v.toLocaleString('en-US', { maximumFractionDigits: 8 });
    case 'percent':
      return `${Math.round(v * 100 * 100) / 100}%`;
    case 'dollar':
      return cur('$', 'USD');
    case 'euro':
      return cur('€', 'EUR', 'de-DE');
    case 'pound':
      return cur('£', 'GBP', 'en-GB');
    case 'yen':
      return cur('¥', 'JPY', 'ja-JP');
    case 'rupee':
      return cur('₹', 'INR', 'en-IN');
    case 'won':
      return cur('₩', 'KRW', 'ko-KR');
    case 'yuan':
      return cur('¥', 'CNY', 'zh-CN');
    default:
      return String(Math.round(v * 1e8) / 1e8);
  }
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

export function parseDay(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDateStr(s?: string, withTime?: boolean): string {
  if (!s) return '';
  const d = parseDay(s);
  let out = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  if (withTime && s.length > 10) {
    const [hh, mm] = s.slice(11, 16).split(':').map(Number);
    const h12 = ((hh + 11) % 12) + 1;
    out += ` ${h12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
  }
  return out;
}

export function formatDateValue(v: any): string {
  if (!v || !v.start) return '';
  const a = formatDateStr(v.start, v.time);
  return v.end ? `${a} → ${formatDateStr(v.end, v.time)}` : a;
}

export function formatTimestamp(t: number): string {
  const d = new Date(t);
  const h = d.getHours();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${((h + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** plain text form for search/sort/copy */
export function valueToText(db: Block, p: PropertySchema, v: any): string {
  if (v === undefined || v === null) return '';
  switch (p.type) {
    case 'select':
    case 'status':
      return p.options?.find((o) => o.id === v)?.name ?? '';
    case 'multi_select':
      return (Array.isArray(v) ? v : []).map((id: ID) => p.options?.find((o) => o.id === id)?.name ?? '').filter(Boolean).join(', ');
    case 'date':
      return formatDateValue(v);
    case 'person':
    case 'created_by':
    case 'last_edited_by':
      return (Array.isArray(v) ? v : []).map((u: ID) => S().users[u]?.name ?? '').join(', ');
    case 'checkbox':
      return v ? 'Yes' : 'No';
    case 'number':
      return formatNumber(v, p.numberFormat);
    case 'created_time':
    case 'last_edited_time':
      return formatTimestamp(v);
    case 'files':
      return (Array.isArray(v) ? v : []).map((f: any) => f.name).join(', ');
    case 'relation':
      return (Array.isArray(v) ? v : []).map((r: ID) => S().blocks[r]?.props.title || 'Untitled').join(', ');
    case 'unique_id':
      return `${p.prefix ? p.prefix + '-' : ''}${v}`;
    case 'formula':
      return formulaToString(v);
    default:
      void db;
      return String(v);
  }
}

export function isEmptyValue(p: PropertySchema, v: any): boolean {
  if (p.type === 'checkbox') return !v;
  if (v === undefined || v === null || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (p.type === 'date') return !v.start;
  return false;
}

// ---------- filtering ----------
export interface OpDef {
  id: string;
  label: string;
  noValue?: boolean;
}

export function opsFor(type: PropType): OpDef[] {
  const empty = [
    { id: 'is_empty', label: 'Is empty', noValue: true },
    { id: 'is_not_empty', label: 'Is not empty', noValue: true },
  ];
  switch (type) {
    case 'number':
    case 'unique_id':
      return [
        { id: 'eq', label: '=' },
        { id: 'neq', label: '≠' },
        { id: 'gt', label: '>' },
        { id: 'lt', label: '<' },
        { id: 'gte', label: '≥' },
        { id: 'lte', label: '≤' },
        ...empty,
      ];
    case 'select':
    case 'status':
      return [{ id: 'is', label: 'Is' }, { id: 'is_not', label: 'Is not' }, ...empty];
    case 'multi_select':
    case 'person':
    case 'created_by':
    case 'last_edited_by':
    case 'relation':
      return [{ id: 'contains', label: 'Contains' }, { id: 'not_contains', label: 'Does not contain' }, ...empty];
    case 'checkbox':
      return [{ id: 'is', label: 'Is' }, { id: 'is_not', label: 'Is not' }];
    case 'date':
    case 'created_time':
    case 'last_edited_time':
      return [
        { id: 'is', label: 'Is' },
        { id: 'before', label: 'Is before' },
        { id: 'after', label: 'Is after' },
        { id: 'on_or_before', label: 'Is on or before' },
        { id: 'on_or_after', label: 'Is on or after' },
        { id: 'past_week', label: 'Is within past week', noValue: true },
        { id: 'next_week', label: 'Is within next week', noValue: true },
        { id: 'this_month', label: 'Is within this month', noValue: true },
        ...empty,
      ];
    case 'files':
      return empty;
    default:
      return [
        { id: 'is', label: 'Is' },
        { id: 'is_not', label: 'Is not' },
        { id: 'contains', label: 'Contains' },
        { id: 'not_contains', label: 'Does not contain' },
        { id: 'starts', label: 'Starts with' },
        { id: 'ends', label: 'Ends with' },
        ...empty,
      ];
  }
}

export function defaultOp(type: PropType) {
  if (type === 'checkbox') return 'is';
  if (['multi_select', 'person', 'relation', 'created_by', 'last_edited_by'].includes(type)) return 'contains';
  if (type === 'files') return 'is_not_empty';
  if (['text', 'title', 'url', 'email', 'phone', 'formula', 'rollup'].includes(type)) return 'contains';
  return 'is';
}

function dayOf(v: any, p: PropertySchema): number | null {
  if (p.type === 'created_time' || p.type === 'last_edited_time') {
    const d = new Date(v);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (!v?.start) return null;
  return parseDay(v.start).getTime();
}

export function matchFilter(db: Block, row: Block, f: Filter): boolean {
  const p = db.props.schema[f.prop] as PropertySchema | undefined;
  if (!p) return true;
  const v = computeValue(db, row, p);
  const op = f.op;
  if (op === 'is_empty') return isEmptyValue(p, v);
  if (op === 'is_not_empty') return !isEmptyValue(p, v);
  const fv = f.value;
  switch (p.type) {
    case 'checkbox':
      return op === 'is' ? !!v === !!fv : !!v !== !!fv;
    case 'number':
    case 'unique_id': {
      if (fv === undefined || fv === '' || fv === null) return true;
      const a = Number(v);
      const b = Number(fv);
      if (v === undefined || v === null || v === '') return op === 'neq';
      return { eq: a === b, neq: a !== b, gt: a > b, lt: a < b, gte: a >= b, lte: a <= b }[op as 'eq'] ?? true;
    }
    case 'select':
    case 'status': {
      const arr = Array.isArray(fv) ? fv : fv ? [fv] : [];
      if (!arr.length) return true;
      return op === 'is' ? arr.includes(v) : !arr.includes(v);
    }
    case 'multi_select':
    case 'person':
    case 'created_by':
    case 'last_edited_by':
    case 'relation': {
      const arr = Array.isArray(fv) ? fv : fv ? [fv] : [];
      if (!arr.length) return true;
      const vals: ID[] = Array.isArray(v) ? v : [];
      const has = arr.some((x: ID) => vals.includes(x));
      return op === 'contains' ? has : !has;
    }
    case 'date':
    case 'created_time':
    case 'last_edited_time': {
      const d = dayOf(v, p);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const t = today.getTime();
      if (op === 'past_week') return d !== null && d <= t && d >= t - 7 * 86400000;
      if (op === 'next_week') return d !== null && d >= t && d <= t + 7 * 86400000;
      if (op === 'this_month') return d !== null && new Date(d).getMonth() === today.getMonth() && new Date(d).getFullYear() === today.getFullYear();
      if (!fv) return true;
      if (d === null) return false;
      const target = parseDay(fv).getTime();
      return { is: d === target, before: d < target, after: d > target, on_or_before: d <= target, on_or_after: d >= target }[op as 'is'] ?? true;
    }
    default: {
      const text = (p.type === 'formula' ? formulaToString(v) : valueToText(db, p, v)).toLowerCase();
      const q = String(fv ?? '').toLowerCase();
      if (!q) return true;
      switch (op) {
        case 'is':
          return text === q;
        case 'is_not':
          return text !== q;
        case 'contains':
          return text.includes(q);
        case 'not_contains':
          return !text.includes(q);
        case 'starts':
          return text.startsWith(q);
        case 'ends':
          return text.endsWith(q);
      }
      return true;
    }
  }
}

function sortKey(db: Block, row: Block, p: PropertySchema): any {
  const v = computeValue(db, row, p);
  switch (p.type) {
    case 'number':
    case 'unique_id':
    case 'created_time':
    case 'last_edited_time':
      return typeof v === 'number' ? v : null;
    case 'checkbox':
      return v ? 1 : 0;
    case 'date':
      return v?.start ? parseDay(v.start).getTime() : null;
    case 'select':
    case 'status': {
      const i = (p.options ?? []).findIndex((o) => o.id === v);
      return i === -1 ? null : i;
    }
    default: {
      const t = valueToText(db, p, v);
      return t ? t.toLowerCase() : null;
    }
  }
}

export function getRows(db: Block, view: View, search = ''): Block[] {
  const st = S();
  let rows = db.children.map((c) => st.blocks[c]).filter((r) => r && !r.props.trashed);
  const filters = view.filters ?? [];
  if (filters.length) {
    rows = rows.filter((r) => (view.filterMode === 'or' ? filters.some((f) => matchFilter(db, r, f)) : filters.every((f) => matchFilter(db, r, f))));
  }
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    rows = rows.filter((r) => (r.props.title ?? '').toLowerCase().includes(q) || schemaList(db).some((p) => p.type !== 'title' && valueToText(db, p, computeValue(db, r, p)).toLowerCase().includes(q)));
  }
  const sorts = (view.sorts ?? []).filter((s: Sort) => db.props.schema[s.prop]);
  if (sorts.length) {
    rows = [...rows].sort((a, b) => {
      for (const s of sorts) {
        const p = db.props.schema[s.prop] as PropertySchema;
        const ka = sortKey(db, a, p);
        const kb = sortKey(db, b, p);
        if (ka === kb) continue;
        if (ka === null) return 1;
        if (kb === null) return -1;
        const c = ka < kb ? -1 : 1;
        return s.dir === 'asc' ? c : -c;
      }
      return 0;
    });
  }
  return rows;
}

// ---------- grouping ----------
export interface Group {
  key: string; // option id or '__none'
  label: string;
  color: Color;
  option?: SelectOption;
  rows: Block[];
}

export function groupRows(db: Block, view: View, rows: Block[]): Group[] | null {
  const gp = view.groupBy ? (db.props.schema[view.groupBy] as PropertySchema | undefined) : undefined;
  if (!gp) return null;
  if (gp.type === 'select' || gp.type === 'status' || gp.type === 'multi_select') {
    const groups: Group[] = [
      { key: '__none', label: `No ${gp.name}`, color: 'default', rows: [] },
      ...(gp.options ?? []).map((o) => ({ key: o.id, label: o.name, color: o.color, option: o, rows: [] as Block[] })),
    ];
    const map = new Map(groups.map((g) => [g.key, g]));
    rows.forEach((r) => {
      const v = r.props.values?.[gp.id];
      if (gp.type === 'multi_select') {
        const arr: ID[] = Array.isArray(v) ? v.filter((x: ID) => map.has(x)) : [];
        if (!arr.length) map.get('__none')!.rows.push(r);
        arr.forEach((x) => map.get(x)!.rows.push(r));
      } else (map.get(v) ?? map.get('__none')!).rows.push(r);
    });
    // custom group order
    const order = (view as any).groupOrder as string[] | undefined;
    if (order) groups.sort((a, b) => (order.indexOf(a.key) + 1 || 999) - (order.indexOf(b.key) + 1 || 999));
    return groups;
  }
  if (gp.type === 'checkbox') {
    return [
      { key: 'true', label: 'Checked', color: 'default', rows: rows.filter((r) => !!r.props.values?.[gp.id]) },
      { key: 'false', label: 'Unchecked', color: 'default', rows: rows.filter((r) => !r.props.values?.[gp.id]) },
    ];
  }
  if (gp.type === 'person') {
    const users = S().users;
    const groups: Group[] = [{ key: '__none', label: `No ${gp.name}`, color: 'default', rows: [] }, ...Object.values(users).map((u) => ({ key: u.id, label: u.name, color: 'default' as Color, rows: [] as Block[] }))];
    const map = new Map(groups.map((g) => [g.key, g]));
    rows.forEach((r) => {
      const arr: ID[] = r.props.values?.[gp.id] ?? [];
      if (!arr.length) map.get('__none')!.rows.push(r);
      arr.forEach((u) => map.get(u)?.rows.push(r));
    });
    return groups;
  }
  // text-like: group by text value
  const m = new Map<string, Group>();
  rows.forEach((r) => {
    const t = valueToText(db, gp, computeValue(db, r, gp)) || '';
    const key = t || '__none';
    if (!m.has(key)) m.set(key, { key, label: t || `No ${gp.name}`, color: 'default', rows: [] });
    m.get(key)!.rows.push(r);
  });
  return Array.from(m.values());
}

/** value to assign to a row when moved into a group */
export function groupValue(gp: PropertySchema, key: string, current: any): any {
  if (gp.type === 'multi_select') {
    if (key === '__none') return [];
    return [key];
  }
  if (gp.type === 'person') return key === '__none' ? [] : [key];
  if (gp.type === 'checkbox') return key === 'true';
  if (key === '__none') return undefined;
  void current;
  return key;
}

// ---------- calculations ----------
export const CALCS: { id: string; label: string; types?: PropType[] | 'number' | 'date' | 'checkbox' }[] = [
  { id: 'none', label: 'None' },
  { id: 'count', label: 'Count all' },
  { id: 'count_values', label: 'Count values' },
  { id: 'count_unique', label: 'Count unique values' },
  { id: 'count_empty', label: 'Count empty' },
  { id: 'count_not_empty', label: 'Count not empty' },
  { id: 'percent_empty', label: 'Percent empty' },
  { id: 'percent_not_empty', label: 'Percent not empty' },
  { id: 'sum', label: 'Sum', types: 'number' },
  { id: 'average', label: 'Average', types: 'number' },
  { id: 'median', label: 'Median', types: 'number' },
  { id: 'min', label: 'Min', types: 'number' },
  { id: 'max', label: 'Max', types: 'number' },
  { id: 'range', label: 'Range', types: 'number' },
  { id: 'earliest', label: 'Earliest date', types: 'date' },
  { id: 'latest', label: 'Latest date', types: 'date' },
  { id: 'date_range', label: 'Date range', types: 'date' },
  { id: 'checked', label: 'Checked', types: 'checkbox' },
  { id: 'unchecked', label: 'Unchecked', types: 'checkbox' },
  { id: 'percent_checked', label: 'Percent checked', types: 'checkbox' },
  { id: 'percent_unchecked', label: 'Percent unchecked', types: 'checkbox' },
];

export function calcsFor(type: PropType) {
  const isNum = type === 'number' || type === 'unique_id' || type === 'formula' || type === 'rollup';
  const isDate = type === 'date' || type === 'created_time' || type === 'last_edited_time';
  if (type === 'checkbox')
    return CALCS.filter((c) => ['none', 'count', 'checked', 'unchecked', 'percent_checked', 'percent_unchecked'].includes(c.id));
  return CALCS.filter((c) => !c.types || (c.types === 'number' && isNum) || (c.types === 'date' && isDate));
}

export const CALC_SHORT: Record<string, string> = {
  count: 'Count',
  count_values: 'Values',
  count_unique: 'Unique',
  count_empty: 'Empty',
  count_not_empty: 'Not empty',
  percent_empty: 'Empty',
  percent_not_empty: 'Not empty',
  sum: 'Sum',
  average: 'Average',
  median: 'Median',
  min: 'Min',
  max: 'Max',
  range: 'Range',
  earliest: 'Earliest',
  latest: 'Latest',
  date_range: 'Range',
  checked: 'Checked',
  unchecked: 'Unchecked',
  percent_checked: 'Checked',
  percent_unchecked: 'Unchecked',
};

export function calculate(db: Block, p: PropertySchema, rows: Block[], calc: string): string {
  const vals = rows.map((r) => computeValue(db, r, p));
  const n = rows.length;
  const nonEmpty = vals.filter((v) => !isEmptyValue(p, v));
  const pct = (x: number) => (n ? `${Math.round((x / n) * 1000) / 10}%` : '0%');
  const nums = vals.map(Number).filter((x, i) => !isEmptyValue(p, vals[i]) && !isNaN(x));
  const fmt = (x: number) => (p.type === 'number' ? formatNumber(x, p.numberFormat) : String(Math.round(x * 100) / 100));
  const dates = vals
    .map((v) => (p.type === 'date' ? (v?.start ? parseDay(v.start).getTime() : null) : typeof v === 'number' ? v : null))
    .filter((x): x is number => x !== null);
  switch (calc) {
    case 'count':
      return String(n);
    case 'count_values':
      return String(nonEmpty.reduce((a, v) => a + (Array.isArray(v) ? v.length : 1), 0));
    case 'count_unique':
      return String(new Set(nonEmpty.flatMap((v) => (Array.isArray(v) ? v : [JSON.stringify(v)]))).size);
    case 'count_empty':
      return String(n - nonEmpty.length);
    case 'count_not_empty':
      return String(nonEmpty.length);
    case 'percent_empty':
      return pct(n - nonEmpty.length);
    case 'percent_not_empty':
      return pct(nonEmpty.length);
    case 'sum':
      return fmt(nums.reduce((a, b) => a + b, 0));
    case 'average':
      return nums.length ? fmt(nums.reduce((a, b) => a + b, 0) / nums.length) : '';
    case 'median': {
      if (!nums.length) return '';
      const s = [...nums].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return fmt(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
    }
    case 'min':
      return nums.length ? fmt(Math.min(...nums)) : '';
    case 'max':
      return nums.length ? fmt(Math.max(...nums)) : '';
    case 'range':
      return nums.length ? fmt(Math.max(...nums) - Math.min(...nums)) : '';
    case 'earliest':
      return dates.length ? formatDateStr(dayKey(new Date(Math.min(...dates)))) : '';
    case 'latest':
      return dates.length ? formatDateStr(dayKey(new Date(Math.max(...dates)))) : '';
    case 'date_range': {
      if (!dates.length) return '';
      const days = Math.round((Math.max(...dates) - Math.min(...dates)) / 86400000);
      return `${days} day${days === 1 ? '' : 's'}`;
    }
    case 'checked':
      return String(vals.filter(Boolean).length);
    case 'unchecked':
      return String(vals.filter((v) => !v).length);
    case 'percent_checked':
      return pct(vals.filter(Boolean).length);
    case 'percent_unchecked':
      return pct(vals.filter((v) => !v).length);
  }
  return '';
}

export function coverStyle(cover?: string): React.CSSProperties | undefined {
  if (!cover) return undefined;
  const m = cover.match(/^gradient_(\d+)$/);
  if (m) return { background: GRADIENTS[(Number(m[1]) - 1) % GRADIENTS.length] };
  if (cover.startsWith('solid_')) return { background: `var(--bg-${cover.slice(6)})` };
  if (cover.startsWith('#') || cover.startsWith('rgb') || cover.startsWith('linear')) return { background: cover };
  return { backgroundImage: `url("${cover}")`, backgroundSize: 'cover', backgroundPosition: 'center' };
}

export const GRADIENTS = [
  'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
  'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
  'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
  'linear-gradient(120deg, #2383e2 0%, #9065b0 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
];

export function firstImage(row: Block): string | undefined {
  const st = S();
  const walk = (ids: ID[]): string | undefined => {
    for (const id of ids) {
      const b = st.blocks[id];
      if (!b) continue;
      if (b.type === 'image' && b.props.src) return b.props.src;
      const r = walk(b.children);
      if (r) return r;
    }
    return undefined;
  };
  return walk(row.children);
}

export function contentPreview(row: Block, max = 8): Block[] {
  const st = S();
  return row.children
    .map((c) => st.blocks[c])
    .filter((b) => b && b.type !== 'page' && b.type !== 'database')
    .slice(0, max);
}
