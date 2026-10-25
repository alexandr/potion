import type { ReactNode } from 'react';
import type { BlockType, ViewType } from '../store/types';
import * as I from '../components/ui/Icons';

export interface SlashItem {
  key: string;
  label: string;
  desc: string;
  group: string;
  icon: ReactNode;
  keywords: string;
  hint?: string;
  type?: BlockType;
  props?: Record<string, any>;
  /** special actions */
  action?:
    | 'page'
    | 'db-inline'
    | 'db-full'
    | 'columns'
    | 'mention-page'
    | 'mention-person'
    | 'date'
    | 'emoji'
    | 'inline-equation'
    | 'color'
    | 'link-to-page'
    | 'linked-db';
  view?: ViewType;
  columns?: number;
  color?: string;
}

const ic = (n: ReactNode) => <div className="slash-icon">{n}</div>;

export const SLASH_ITEMS: SlashItem[] = [
  { key: 'text', label: 'Text', desc: 'Just start writing with plain text', group: 'Basic blocks', icon: ic(<I.TextIcon size={18} />), keywords: 'text plain paragraph', type: 'text' },
  { key: 'h1', label: 'Heading 1', desc: 'Big section heading', group: 'Basic blocks', icon: ic(<I.H1Icon size={18} />), keywords: 'heading1 h1 title big', hint: '#', type: 'h1' },
  { key: 'h2', label: 'Heading 2', desc: 'Medium section heading', group: 'Basic blocks', icon: ic(<I.H2Icon size={18} />), keywords: 'heading2 h2 subtitle medium', hint: '##', type: 'h2' },
  { key: 'h3', label: 'Heading 3', desc: 'Small section heading', group: 'Basic blocks', icon: ic(<I.H3Icon size={18} />), keywords: 'heading3 h3 small', hint: '###', type: 'h3' },
  { key: 'bulleted', label: 'Bulleted list', desc: 'Create a simple bulleted list', group: 'Basic blocks', icon: ic(<I.BulletListIcon size={18} />), keywords: 'bulleted list bullet ul unordered', hint: '-', type: 'bulleted' },
  { key: 'numbered', label: 'Numbered list', desc: 'Create a list with numbering', group: 'Basic blocks', icon: ic(<I.NumberListIcon size={18} />), keywords: 'numbered list ordered ol number', hint: '1.', type: 'numbered' },
  { key: 'todo', label: 'To-do list', desc: 'Track tasks with a to-do list', group: 'Basic blocks', icon: ic(<I.CheckboxIcon size={18} />), keywords: 'todo to-do checkbox task check', hint: '[]', type: 'todo' },
  { key: 'toggle', label: 'Toggle list', desc: 'Toggles can hide and show content inside', group: 'Basic blocks', icon: ic(<I.ToggleListIcon size={18} />), keywords: 'toggle list collapse', hint: '>', type: 'toggle' },
  { key: 'page', label: 'Page', desc: 'Embed a sub-page inside this page', group: 'Basic blocks', icon: ic(<I.PageIcon size={18} />), keywords: 'page subpage new', action: 'page' },
  { key: 'callout', label: 'Callout', desc: 'Make writing stand out', group: 'Basic blocks', icon: ic(<I.CalloutIcon size={18} />), keywords: 'callout note info warning', type: 'callout' },
  { key: 'quote', label: 'Quote', desc: 'Capture a quote', group: 'Basic blocks', icon: ic(<I.QuoteIcon size={18} />), keywords: 'quote blockquote citation', hint: '"', type: 'quote' },
  { key: 'table', label: 'Table', desc: 'Add simple tabular content to your page', group: 'Basic blocks', icon: ic(<I.TableIcon size={18} />), keywords: 'table simple grid', type: 'table' },
  { key: 'divider', label: 'Divider', desc: 'Visually divide blocks', group: 'Basic blocks', icon: ic(<I.DividerIcon size={18} />), keywords: 'divider hr line separator', hint: '---', type: 'divider' },
  { key: 'link_to_page', label: 'Link to page', desc: 'Link to an existing page', group: 'Basic blocks', icon: ic(<I.ArrowUpRight size={18} />), keywords: 'link page reference', action: 'link-to-page' },

  { key: 'image', label: 'Image', desc: 'Upload or embed with a link', group: 'Media', icon: ic(<I.ImageIcon size={18} />), keywords: 'image picture photo img', type: 'image' },
  { key: 'video', label: 'Video', desc: 'Embed from YouTube, Vimeo..', group: 'Media', icon: ic(<I.VideoIcon size={18} />), keywords: 'video youtube vimeo movie', type: 'video' },
  { key: 'audio', label: 'Audio', desc: 'Embed from SoundCloud, Spotify..', group: 'Media', icon: ic(<I.AudioIcon size={18} />), keywords: 'audio sound music mp3', type: 'audio' },
  { key: 'code', label: 'Code', desc: 'Capture a code snippet', group: 'Media', icon: ic(<I.CodeIcon size={18} />), keywords: 'code snippet programming pre', hint: '```', type: 'code' },
  { key: 'file', label: 'File', desc: 'Upload or embed with a link', group: 'Media', icon: ic(<I.PaperclipIcon size={18} />), keywords: 'file upload attachment pdf', type: 'file' },
  { key: 'bookmark', label: 'Web bookmark', desc: 'Save a link as a visual bookmark', group: 'Media', icon: ic(<I.BookmarkIcon size={18} />), keywords: 'bookmark web link url', type: 'bookmark' },

  { key: 'db-table', label: 'Table view', desc: 'Add a table database', group: 'Database', icon: ic(<I.TableIcon size={18} />), keywords: 'table view database db inline', action: 'db-inline', view: 'table' },
  { key: 'db-board', label: 'Board view', desc: 'Add a kanban board', group: 'Database', icon: ic(<I.BoardIcon size={18} />), keywords: 'board kanban view database db', action: 'db-inline', view: 'board' },
  { key: 'db-gallery', label: 'Gallery view', desc: 'Add a gallery of cards', group: 'Database', icon: ic(<I.GalleryIcon size={18} />), keywords: 'gallery cards view database db', action: 'db-inline', view: 'gallery' },
  { key: 'db-list', label: 'List view', desc: 'Add a simple list database', group: 'Database', icon: ic(<I.ListIcon size={18} />), keywords: 'list view database db', action: 'db-inline', view: 'list' },
  { key: 'db-calendar', label: 'Calendar view', desc: 'Add a calendar database', group: 'Database', icon: ic(<I.CalendarIcon size={18} />), keywords: 'calendar view database db dates', action: 'db-inline', view: 'calendar' },
  { key: 'db-timeline', label: 'Timeline view', desc: 'Add a timeline database', group: 'Database', icon: ic(<I.TimelineIcon size={18} />), keywords: 'timeline gantt view database db', action: 'db-inline', view: 'timeline' },
  { key: 'db-chart', label: 'Chart view', desc: 'Visualize data with charts', group: 'Database', icon: ic(<I.ChartIcon size={18} />), keywords: 'chart graph bar view database db', action: 'db-inline', view: 'chart' },
  { key: 'db-inline', label: 'Database - Inline', desc: 'Add a new inline database to this page', group: 'Database', icon: ic(<I.TableIcon size={18} />), keywords: 'database inline db table', action: 'db-inline', view: 'table' },
  { key: 'db-full', label: 'Database - Full page', desc: 'Add a new database as a sub-page', group: 'Database', icon: ic(<I.TableIcon size={18} />), keywords: 'database full page db', action: 'db-full', view: 'table' },
  { key: 'linked-db', label: 'Linked view of data source', desc: 'Add a view of an existing data source to this page', group: 'Database', icon: ic(<I.ArrowUpRight size={18} />), keywords: 'linked database view source', action: 'linked-db' },

  { key: 'toc', label: 'Table of contents', desc: 'Show an outline of your page', group: 'Advanced blocks', icon: ic(<I.TocIcon size={18} />), keywords: 'table of contents toc outline', type: 'toc' },
  { key: 'equation', label: 'Block equation', desc: 'Display a standalone math equation', group: 'Advanced blocks', icon: ic(<I.EquationIcon size={18} />), keywords: 'equation math latex tex katex formula', type: 'equation' },
  { key: 'button', label: 'Button', desc: 'Run custom automations with a click', group: 'Advanced blocks', icon: ic(<I.ButtonIcon size={18} />), keywords: 'button template action automate', type: 'button' },
  { key: 'breadcrumb', label: 'Breadcrumb', desc: 'Show the current page location', group: 'Advanced blocks', icon: ic(<I.BreadcrumbIcon size={18} />), keywords: 'breadcrumb path location', type: 'breadcrumb' },
  { key: 'synced', label: 'Synced block', desc: 'Sync content across pages', group: 'Advanced blocks', icon: ic(<I.SyncIcon size={18} />), keywords: 'synced block sync', type: 'synced' },
  { key: 'th1', label: 'Toggle heading 1', desc: 'Hide content inside a large heading', group: 'Advanced blocks', icon: ic(<I.H1Icon size={18} />), keywords: 'toggle heading1 h1', hint: '>#', type: 'h1', props: { toggleable: true } },
  { key: 'th2', label: 'Toggle heading 2', desc: 'Hide content inside a medium heading', group: 'Advanced blocks', icon: ic(<I.H2Icon size={18} />), keywords: 'toggle heading2 h2', hint: '>##', type: 'h2', props: { toggleable: true } },
  { key: 'th3', label: 'Toggle heading 3', desc: 'Hide content inside a small heading', group: 'Advanced blocks', icon: ic(<I.H3Icon size={18} />), keywords: 'toggle heading3 h3', hint: '>###', type: 'h3', props: { toggleable: true } },
  { key: 'col2', label: '2 columns', desc: 'Create 2 columns of blocks', group: 'Advanced blocks', icon: ic(<I.ColumnsIcon size={18} />), keywords: 'columns 2 two layout', action: 'columns', columns: 2 },
  { key: 'col3', label: '3 columns', desc: 'Create 3 columns of blocks', group: 'Advanced blocks', icon: ic(<I.ColumnsIcon size={18} />), keywords: 'columns 3 three layout', action: 'columns', columns: 3 },
  { key: 'col4', label: '4 columns', desc: 'Create 4 columns of blocks', group: 'Advanced blocks', icon: ic(<I.ColumnsIcon size={18} />), keywords: 'columns 4 four layout', action: 'columns', columns: 4 },
  { key: 'col5', label: '5 columns', desc: 'Create 5 columns of blocks', group: 'Advanced blocks', icon: ic(<I.ColumnsIcon size={18} />), keywords: 'columns 5 five layout', action: 'columns', columns: 5 },
  { key: 'mermaid', label: 'Code - Mermaid', desc: 'Create a diagram by writing code', group: 'Advanced blocks', icon: ic(<I.CodeIcon size={18} />), keywords: 'mermaid diagram code chart', type: 'code', props: { language: 'mermaid' } },

  { key: 'mention-person', label: 'Mention a person', desc: 'Ping someone so they get a notification', group: 'Inline', icon: ic(<I.AtIcon size={18} />), keywords: 'mention person user people @', action: 'mention-person' },
  { key: 'mention-page', label: 'Mention a page', desc: 'Mention a page or data source, and place in text', group: 'Inline', icon: ic(<I.ArrowUpRight size={18} />), keywords: 'mention page link @', action: 'mention-page' },
  { key: 'date', label: 'Date or reminder', desc: 'Insert a date or reminder in text', group: 'Inline', icon: ic(<I.CalendarIcon size={18} />), keywords: 'date reminder today time', action: 'date' },
  { key: 'emoji', label: 'Emoji', desc: 'Search for an emoji to place in text', group: 'Inline', icon: ic(<I.SmileIcon size={18} />), keywords: 'emoji smiley icon', action: 'emoji' },
  { key: 'inline-equation', label: 'Inline equation', desc: 'Insert mathematical symbols in text', group: 'Inline', icon: ic(<I.EquationIcon size={18} />), keywords: 'inline equation math tex', action: 'inline-equation' },

  { key: 'embed', label: 'Embed', desc: 'For PDFs, Google Maps, and more', group: 'Embeds', icon: ic(<I.EmbedIcon size={18} />), keywords: 'embed iframe figma maps codepen', type: 'embed' },
];

const COLORS = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];
export const COLOR_NAMES: Record<string, string> = {
  default: 'Default',
  gray: 'Gray',
  brown: 'Brown',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  purple: 'Purple',
  pink: 'Pink',
  red: 'Red',
};
export const COLOR_LIST = COLORS;

// color items for slash menu ("/red", "/blue background")
for (const c of COLORS) {
  SLASH_ITEMS.push({
    key: `color-${c}`,
    label: c === 'default' ? 'Default' : COLOR_NAMES[c],
    desc: '',
    group: 'Color',
    icon: (
      <div className="slash-icon color-swatch-icon" style={{ color: c === 'default' ? 'var(--text)' : `var(--c-${c})` }}>
        A
      </div>
    ),
    keywords: `color text ${c}`,
    action: 'color',
    color: c,
  });
}
for (const c of COLORS) {
  SLASH_ITEMS.push({
    key: `bgcolor-${c}`,
    label: c === 'default' ? 'Default background' : `${COLOR_NAMES[c]} background`,
    desc: '',
    group: 'Background color',
    icon: (
      <div className="slash-icon color-swatch-icon" style={{ background: c === 'default' ? 'transparent' : `var(--bg-${c})` }}>
        A
      </div>
    ),
    keywords: `background bg highlight ${c}`,
    action: 'color',
    color: `${c}_background`,
  });
}

export const TURN_INTO: { type: BlockType; label: string; icon: ReactNode; props?: Record<string, any> }[] = [
  { type: 'text', label: 'Text', icon: <I.TextIcon size={18} /> },
  { type: 'h1', label: 'Heading 1', icon: <I.H1Icon size={18} /> },
  { type: 'h2', label: 'Heading 2', icon: <I.H2Icon size={18} /> },
  { type: 'h3', label: 'Heading 3', icon: <I.H3Icon size={18} /> },
  { type: 'page', label: 'Page', icon: <I.PageIcon size={18} /> },
  { type: 'bulleted', label: 'Bulleted list', icon: <I.BulletListIcon size={18} /> },
  { type: 'numbered', label: 'Numbered list', icon: <I.NumberListIcon size={18} /> },
  { type: 'todo', label: 'To-do list', icon: <I.CheckboxIcon size={18} /> },
  { type: 'toggle', label: 'Toggle list', icon: <I.ToggleListIcon size={18} /> },
  { type: 'code', label: 'Code', icon: <I.CodeIcon size={18} /> },
  { type: 'quote', label: 'Quote', icon: <I.QuoteIcon size={18} /> },
  { type: 'callout', label: 'Callout', icon: <I.CalloutIcon size={18} /> },
  { type: 'equation', label: 'Block equation', icon: <I.EquationIcon size={18} /> },
  { type: 'h1', label: 'Toggle heading 1', icon: <I.H1Icon size={18} />, props: { toggleable: true } },
  { type: 'h2', label: 'Toggle heading 2', icon: <I.H2Icon size={18} />, props: { toggleable: true } },
  { type: 'h3', label: 'Toggle heading 3', icon: <I.H3Icon size={18} />, props: { toggleable: true } },
];

export const TEXT_TYPES: BlockType[] = ['text', 'h1', 'h2', 'h3', 'todo', 'bulleted', 'numbered', 'toggle', 'quote', 'callout'];
export const isTextType = (t: BlockType) => TEXT_TYPES.includes(t) || t === 'code';
/** block types that can have nested children rendered indented */
export const NESTABLE: BlockType[] = ['text', 'todo', 'bulleted', 'numbered', 'toggle', 'quote', 'callout', 'h1', 'h2', 'h3', 'synced'];

export function blockTypeLabel(t: BlockType, props: Record<string, any> = {}): string {
  const found = TURN_INTO.find((x) => x.type === t && !!x.props?.toggleable === !!props.toggleable);
  if (found) return found.label;
  const s = SLASH_ITEMS.find((x) => x.type === t);
  return s?.label ?? t;
}

export function placeholderFor(t: BlockType, props: Record<string, any> = {}): string {
  switch (t) {
    case 'h1':
      return 'Heading 1';
    case 'h2':
      return 'Heading 2';
    case 'h3':
      return 'Heading 3';
    case 'todo':
      return 'To-do';
    case 'bulleted':
    case 'numbered':
      return 'List';
    case 'toggle':
      return 'Toggle';
    case 'quote':
      return 'Empty quote';
    case 'callout':
      return void props, 'Type something…';
    default:
      return "Press '/' for commands…";
  }
}
