import type { PropType, ViewType } from '../../store/types';
import * as I from '../ui/Icons';

const svg = (paths: React.ReactNode) =>
  function Icon({ size = 16, style }: { size?: number; style?: React.CSSProperties }) {
    return (
      <svg viewBox="0 0 20 20" width={size} height={size} style={{ flexShrink: 0, display: 'block', ...style }} fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {paths}
      </svg>
    );
  };

export const TitleTypeIcon = svg(<><path d="M4 5.5h12M10 5.5v10" /><path d="M3.5 15.5h4M12.5 15.5h4" strokeWidth={1} /></>);
export const TextTypeIcon = svg(<><path d="M3.5 5h13M3.5 10h13M3.5 15h8" /></>);
export const NumberTypeIcon = I.HashIcon;
export const DateTypeIcon = I.CalendarIcon;
export const PersonTypeIcon = I.UserIcon;
export const UrlTypeIcon = I.LinkIcon;
export const CreatedTimeIcon = I.ClockIcon;
export const OpenIcon = I.SidePeekIcon;

export function PropTypeIcon({ type, size = 16 }: { type: PropType; size?: number }) {
  const p = { size };
  switch (type) {
    case 'title':
      return <I.TextIcon {...p} />;
    case 'text':
      return <TextTypeIcon {...p} />;
    case 'number':
      return <I.HashIcon {...p} />;
    case 'select':
      return <I.SelectIcon {...p} />;
    case 'multi_select':
      return <I.MultiSelectIcon {...p} />;
    case 'status':
      return <I.StatusIcon {...p} />;
    case 'date':
      return <I.CalendarIcon {...p} />;
    case 'person':
      return <I.UsersIcon {...p} />;
    case 'files':
      return <I.PaperclipIcon {...p} />;
    case 'checkbox':
      return <I.CheckboxIcon {...p} />;
    case 'url':
      return <I.LinkIcon {...p} />;
    case 'email':
      return <I.AtIcon {...p} />;
    case 'phone':
      return <I.PhoneIcon {...p} />;
    case 'formula':
      return <I.FormulaIcon {...p} />;
    case 'relation':
      return <I.ArrowUpRight {...p} />;
    case 'rollup':
      return <I.RollupIcon {...p} />;
    case 'created_time':
    case 'last_edited_time':
      return <I.ClockIcon {...p} />;
    case 'created_by':
    case 'last_edited_by':
      return <I.UserIcon {...p} />;
    case 'unique_id':
      return <I.IdIcon {...p} />;
  }
  return <TextTypeIcon {...p} />;
}

export function ViewTypeIcon({ type, size = 16 }: { type: ViewType; size?: number }) {
  const p = { size };
  switch (type) {
    case 'table':
      return <I.TableIcon {...p} />;
    case 'board':
      return <I.BoardIcon {...p} />;
    case 'list':
      return <I.ListIcon {...p} />;
    case 'gallery':
      return <I.GalleryIcon {...p} />;
    case 'calendar':
      return <I.CalendarIcon {...p} />;
    case 'timeline':
      return <I.TimelineIcon {...p} />;
    case 'chart':
      return <I.ChartIcon {...p} />;
    case 'feed':
      return <I.FeedIcon {...p} />;
  }
  return <I.TableIcon {...p} />;
}

export const VIEW_DESCRIPTIONS: Record<ViewType, string> = {
  table: 'Track and organize data in rows and columns',
  board: 'Group pages into columns by property',
  timeline: 'Visualize work over time',
  calendar: 'See pages organized by date',
  list: 'A minimal list of pages',
  gallery: 'Show pages as visual cards',
  chart: 'Visualize your data',
  feed: 'Read pages in a continuous feed',
};
