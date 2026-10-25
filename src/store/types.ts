export type ID = string;

export type BlockType =
  | 'page'
  | 'database'
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'todo'
  | 'bulleted'
  | 'numbered'
  | 'toggle'
  | 'quote'
  | 'callout'
  | 'divider'
  | 'code'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'bookmark'
  | 'embed'
  | 'equation'
  | 'table'
  | 'column_list'
  | 'column'
  | 'toc'
  | 'breadcrumb'
  | 'button'
  | 'synced'
  | 'link_to_page';

export type Color =
  | 'default'
  | 'gray'
  | 'brown'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'red';

export interface Block {
  id: ID;
  type: BlockType;
  /** sanitized inline HTML (rich text) */
  text: string;
  props: Record<string, any>;
  children: ID[];
  parent: ID | null;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  lastEditedBy: string;
}

export type PropType =
  | 'title'
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'status'
  | 'date'
  | 'person'
  | 'files'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'phone'
  | 'formula'
  | 'relation'
  | 'rollup'
  | 'created_time'
  | 'created_by'
  | 'last_edited_time'
  | 'last_edited_by'
  | 'unique_id';

export interface SelectOption {
  id: ID;
  name: string;
  color: Color;
  /** for status: group */
  group?: 'todo' | 'in_progress' | 'complete';
}

export interface PropertySchema {
  id: ID;
  name: string;
  type: PropType;
  options?: SelectOption[];
  numberFormat?: string;
  formula?: string;
  relationDb?: ID;
  rollup?: { relationProp: ID; targetProp: ID; fn: string };
  prefix?: string;
  dateFormat?: string;
  wrap?: boolean;
}

export type ViewType = 'table' | 'board' | 'list' | 'gallery' | 'calendar' | 'timeline' | 'chart' | 'feed';

export interface Filter {
  id: ID;
  prop: ID;
  op: string;
  value?: any;
}
export interface Sort {
  id: ID;
  prop: ID;
  dir: 'asc' | 'desc';
}

export interface View {
  id: ID;
  name: string;
  type: ViewType;
  filters: Filter[];
  filterMode?: 'and' | 'or';
  sorts: Sort[];
  groupBy?: ID | null;
  hiddenGroups?: string[];
  /** visible property ids in order (for table: columns) */
  propOrder?: ID[];
  hidden?: ID[];
  widths?: Record<ID, number>;
  calcs?: Record<ID, string>;
  cardPreview?: 'none' | 'cover' | 'content';
  cardSize?: 'small' | 'medium' | 'large';
  dateProp?: ID | null;
  endDateProp?: ID | null;
  wrapCells?: boolean;
  showVerticalLines?: boolean;
  openIn?: 'side' | 'center' | 'full';
  chartType?: 'bar' | 'line' | 'donut';
  limit?: number;
}

export interface Comment {
  id: ID;
  author: string;
  text: string;
  createdAt: number;
  resolved?: boolean;
}

export interface Discussion {
  id: ID;
  pageId: ID;
  blockId?: ID | null;
  quote?: string;
  comments: Comment[];
  resolved?: boolean;
}

export interface User {
  id: ID;
  name: string;
  email: string;
  color: string;
}

export interface Workspace {
  name: string;
  icon: string;
  privatePages: ID[];
  teamPages: ID[];
  favorites: ID[];
  recent: { id: ID; at: number }[];
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  startPage: 'home' | 'last';
  openPagesIn: 'side' | 'center' | 'full';
}

export interface Notification {
  id: ID;
  pageId: ID;
  text: string;
  at: number;
  read: boolean;
  actor: string;
}
