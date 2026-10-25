import type { Block } from '../../store/types';
import * as I from './Icons';
import { NOTION_ICONS } from './iconSet';

export function hasContent(b?: Block) {
  return !!b && b.children.length > 0;
}

export function PageIconView({
  icon,
  size = 18,
  page,
  fallback = 'page',
}: {
  icon?: string;
  size?: number;
  page?: Block;
  fallback?: 'page' | 'db' | 'none';
}) {
  if (icon) {
    if (icon.startsWith('icon:')) {
      const [, name, color] = icon.split(':');
      const Cmp = NOTION_ICONS[name] ?? I.PageIcon;
      return (
        <span className="page-icon svg-icon" style={{ width: size, height: size, color: color && color !== 'default' ? `var(--dot-${color})` : 'var(--icon)' }}>
          <Cmp size={size} />
        </span>
      );
    }
    if (/^(https?:|data:|\/)/.test(icon))
      return <img className="page-icon img-icon" src={icon} alt="" style={{ width: size, height: size, borderRadius: 3, objectFit: 'cover' }} />;
    return (
      <span className="page-icon emoji-icon" style={{ fontSize: size * 0.92, width: size, height: size, lineHeight: `${size}px` }}>
        {icon}
      </span>
    );
  }
  if (fallback === 'none') return null;
  const isDb = page?.type === 'database' || fallback === 'db';
  return (
    <span className="page-icon svg-icon default-icon" style={{ width: size, height: size }}>
      {isDb ? <I.TableIcon size={size} /> : hasContent(page) || !page ? <I.PageIcon size={size} /> : <I.EmptyPageIcon size={size} />}
    </span>
  );
}
