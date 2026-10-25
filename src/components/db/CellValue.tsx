import type { Block, Color, ID, PropertySchema, SelectOption } from '../../store/types';
import { useStore } from '../../store/store';
import { computeFormula, computeValue, formatDateValue, formatNumber, formatTimestamp, valueToText } from './dbUtils';
import { formulaToString } from './formula';
import * as I from '../ui/Icons';

export function Tag({ name, color, onRemove, status, small }: { name: string; color: Color; onRemove?: () => void; status?: boolean; small?: boolean }) {
  return (
    <span className={`db-tag tag-${color || 'default'} ${status ? 'status' : ''} ${small ? 'small' : ''}`}>
      {status && <span className={`status-dot dot-${color || 'default'}`} />}
      <span className="db-tag-text">{name}</span>
      {onRemove && (
        <span
          className="db-tag-x"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <I.CloseIcon size={12} />
        </span>
      )}
    </span>
  );
}

export function OptionTag({ opt, status, onRemove }: { opt?: SelectOption; status?: boolean; onRemove?: () => void }) {
  if (!opt) return null;
  return <Tag name={opt.name} color={opt.color} status={status} onRemove={onRemove} />;
}

export function Avatar({ userId, size = 20 }: { userId: ID; size?: number }) {
  const u = useStore((s) => s.users[userId]);
  if (!u) return null;
  return (
    <span className="db-avatar" style={{ width: size, height: size, fontSize: size * 0.55, background: u.color }}>
      {u.name[0]}
    </span>
  );
}

export function PersonChip({ userId, onRemove }: { userId: ID; onRemove?: () => void }) {
  const u = useStore((s) => s.users[userId]);
  if (!u) return null;
  return (
    <span className="db-person">
      <Avatar userId={userId} />
      <span className="db-person-name">{u.name}</span>
      {onRemove && (
        <span className="db-tag-x" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
          <I.CloseIcon size={12} />
        </span>
      )}
    </span>
  );
}

/** read-only rendering of a property value */
export function CellValue({ db, row, prop, wrap, compact }: { db: Block; row: Block; prop: PropertySchema; wrap?: boolean; compact?: boolean }) {
  const v = computeValue(db, row, prop);
  void compact;
  switch (prop.type) {
    case 'title':
      return <span className="db-title-text">{v || ''}</span>;
    case 'text':
      return <span className={`db-text ${wrap ? 'wrap' : ''}`}>{v ?? ''}</span>;
    case 'number':
      return <span className="db-number">{formatNumber(v, prop.numberFormat)}</span>;
    case 'select':
    case 'status':
      return <OptionTag opt={prop.options?.find((o) => o.id === v)} status={prop.type === 'status'} />;
    case 'multi_select':
      return (
        <span className={`db-tags ${wrap ? 'wrap' : ''}`}>
          {((v as ID[]) ?? []).map((id) => (
            <OptionTag key={id} opt={prop.options?.find((o) => o.id === id)} />
          ))}
        </span>
      );
    case 'date':
      return <span className="db-date">{formatDateValue(v)}</span>;
    case 'person':
    case 'created_by':
    case 'last_edited_by':
      return (
        <span className={`db-people ${wrap ? 'wrap' : ''}`}>
          {((v as ID[]) ?? []).map((u) => (
            <PersonChip key={u} userId={u} />
          ))}
        </span>
      );
    case 'checkbox':
      return (
        <span className={`db-checkbox ${v ? 'on' : ''}`}>{v && <I.CheckIcon size={12} style={{ strokeWidth: 2.4 }} />}</span>
      );
    case 'url':
      return v ? (
        <a className="db-link" href={/^https?:/.test(v) ? v : `https://${v}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          {String(v).replace(/^https?:\/\/(www\.)?/, '')}
        </a>
      ) : null;
    case 'email':
      return v ? (
        <a className="db-link" href={`mailto:${v}`} onClick={(e) => e.stopPropagation()}>
          {v}
        </a>
      ) : null;
    case 'phone':
      return v ? (
        <a className="db-link" href={`tel:${v}`} onClick={(e) => e.stopPropagation()}>
          {v}
        </a>
      ) : null;
    case 'files':
      return (
        <span className="db-files">
          {((v as { name: string; url: string }[]) ?? []).map((f, i) =>
            /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name) || f.url.startsWith('data:image') ? (
              <img key={i} src={f.url} alt={f.name} className="db-file-thumb" />
            ) : (
              <span key={i} className="db-file">
                <I.PaperclipIcon size={14} />
                {f.name}
              </span>
            ),
          )}
        </span>
      );
    case 'created_time':
    case 'last_edited_time':
      return <span className="db-date">{formatTimestamp(v)}</span>;
    case 'formula': {
      const r = computeFormula(db, row, prop);
      if (r.error) return <span className="db-formula-error">{''}</span>;
      if (typeof r.value === 'boolean') return <span className={`db-checkbox ${r.value ? 'on' : ''}`}>{r.value && <I.CheckIcon size={12} style={{ strokeWidth: 2.4 }} />}</span>;
      return <span className={typeof r.value === 'number' ? 'db-number' : 'db-text'}>{typeof r.value === 'number' ? formatNumber(r.value, prop.numberFormat) : formulaToString(r.value)}</span>;
    }
    case 'relation':
      return (
        <span className={`db-relations ${wrap ? 'wrap' : ''}`}>
          {((v as ID[]) ?? []).map((id) => (
            <RelationChip key={id} id={id} />
          ))}
        </span>
      );
    case 'rollup':
      return <span className={typeof v === 'number' ? 'db-number' : 'db-text'}>{typeof v === 'number' ? formatNumber(v) : (v ?? '')}</span>;
    case 'unique_id':
      return <span className="db-text">{valueToText(db, prop, v)}</span>;
  }
  return null;
}

function RelationChip({ id }: { id: ID }) {
  const b = useStore((s) => s.blocks[id]);
  if (!b) return null;
  return (
    <span className="db-relation">
      <span className="db-relation-icon">{b.props.icon || <I.PageIcon size={14} />}</span>
      <span className="db-relation-title">{b.props.title || 'Untitled'}</span>
    </span>
  );
}
