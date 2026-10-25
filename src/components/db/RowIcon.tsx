import type { Block } from '../../store/types';
import * as I from '../ui/Icons';

export function RowIcon({ row, size = 16, always }: { row: Block; size?: number; always?: boolean }) {
  const icon = row.props.icon as string | undefined;
  if (!icon) {
    if (!always) return null;
    const hasContent = row.children.length > 0;
    return (
      <span className="row-icon placeholder" style={{ width: size + 2, height: size + 2 }}>
        {hasContent ? <I.PageIcon size={size} /> : <I.EmptyPageIcon size={size} />}
      </span>
    );
  }
  if (/^(https?:|data:|\/)/.test(icon))
    return (
      <span className="row-icon" style={{ width: size + 2, height: size + 2 }}>
        <img src={icon} alt="" style={{ width: size, height: size, borderRadius: 3, objectFit: 'cover' }} />
      </span>
    );
  return (
    <span className="row-icon emoji" style={{ width: size + 2, height: size + 2, fontSize: size * 0.95 }}>
      {icon}
    </span>
  );
}
