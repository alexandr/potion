import type { CSSProperties } from 'react';

type P = { size?: number; style?: CSSProperties; className?: string };

const svg = (paths: React.ReactNode, vb = '0 0 20 20') =>
  function Icon({ size = 20, style, className }: P) {
    return (
      <svg
        viewBox={vb}
        width={size}
        height={size}
        style={{ flexShrink: 0, display: 'block', ...style }}
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.35}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {paths}
      </svg>
    );
  };

const fill = (d: string, vb = '0 0 20 20') =>
  function Icon({ size = 20, style, className }: P) {
    return (
      <svg viewBox={vb} width={size} height={size} style={{ flexShrink: 0, display: 'block', ...style }} className={className} fill="currentColor" aria-hidden>
        <path d={d} />
      </svg>
    );
  };

export const SearchIcon = svg(<><circle cx="8.75" cy="8.75" r="5.25" /><path d="M12.6 12.6l4.15 4.15" /></>);
export const HomeIcon = svg(<><path d="M3.5 8.6L10 3.4l6.5 5.2" /><path d="M5 7.6v8.4a.6.6 0 0 0 .6.6h3V12.4h2.8v4.2h3a.6.6 0 0 0 .6-.6V7.6" /></>);
export const InboxIcon = svg(<><path d="M3.4 11.3l2-6.4a1 1 0 0 1 .95-.7h7.3a1 1 0 0 1 .95.7l2 6.4" /><path d="M3.4 11.3v3.9a1.2 1.2 0 0 0 1.2 1.2h10.8a1.2 1.2 0 0 0 1.2-1.2v-3.9h-3.8a2.8 2.8 0 0 1-5.6 0H3.4z" /></>);
export const SettingsIcon = svg(<><circle cx="10" cy="10" r="2.4" /><path d="M10 2.8l1.3 1.7 2.1-.3.8 2 2 .8-.3 2.1 1.7 1.3-1.7 1.3.3 2.1-2 .8-.8 2-2.1-.3L10 17.2l-1.3-1.7-2.1.3-.8-2-2-.8.3-2.1L2.4 10l1.7-1.3-.3-2.1 2-.8.8-2 2.1.3z" /></>);
export const TrashIcon = svg(<><path d="M4 5.6h12" /><path d="M8 5.6V4.2a.8.8 0 0 1 .8-.8h2.4a.8.8 0 0 1 .8.8v1.4" /><path d="M5.4 5.6l.7 10a1.2 1.2 0 0 0 1.2 1.1h5.4a1.2 1.2 0 0 0 1.2-1.1l.7-10" /><path d="M8.5 8.6v5M11.5 8.6v5" /></>);
export const TemplatesIcon = svg(<><rect x="3.4" y="3.4" width="5.6" height="5.6" rx="1.1" /><circle cx="13.8" cy="6.2" r="2.8" /><path d="M6.2 11.2l3 5.2h-6z" /><rect x="11" y="11" width="5.6" height="5.6" rx="2.8" /></>);
export const ComposeIcon = svg(<><path d="M9.2 4H5.4A1.4 1.4 0 0 0 4 5.4v9.2A1.4 1.4 0 0 0 5.4 16h9.2a1.4 1.4 0 0 0 1.4-1.4v-3.8" /><path d="M14.3 3.3a1.4 1.4 0 0 1 2 2L10 11.6l-2.6.6.6-2.6z" /></>);
export const DoubleChevronLeft = svg(<><path d="M10 5l-5 5 5 5" /><path d="M15 5l-5 5 5 5" /></>);
export const DoubleChevronRight = svg(<><path d="M5 5l5 5-5 5" /><path d="M10 5l5 5-5 5" /></>);
export const MenuIcon = svg(<><path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" /></>);
export const ChevronRight = svg(<path d="M7.5 4.5L13 10l-5.5 5.5" />);
export const ChevronDown = svg(<path d="M4.5 7.5L10 13l5.5-5.5" />);
export const ChevronLeft = svg(<path d="M12.5 4.5L7 10l5.5 5.5" />);
export const ChevronUpDown = svg(<><path d="M6.5 8l3.5-3.5L13.5 8" /><path d="M6.5 12l3.5 3.5 3.5-3.5" /></>);
export const TriangleRight = fill('M6.5 4.6v10.8a.5.5 0 0 0 .78.42l7.6-5.4a.5.5 0 0 0 0-.84l-7.6-5.4a.5.5 0 0 0-.78.42z');
export const TriangleDown = fill('M4.6 6.5h10.8a.5.5 0 0 1 .42.78l-5.4 7.6a.5.5 0 0 1-.84 0l-5.4-7.6a.5.5 0 0 1 .42-.78z');
export const PlusIcon = svg(<path d="M10 4v12M4 10h12" />);
export const DotsIcon = fill('M4.5 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm5.5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm5.5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z');
export const DragIcon = fill('M7.25 5.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5zm5.5 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5zM7.25 11.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5zm5.5 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5zM7.25 17a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5zm5.5 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5z');
export const StarIcon = svg(<path d="M10 3.3l2 4.2 4.6.6-3.4 3.2.9 4.6L10 13.7l-4.1 2.2.9-4.6-3.4-3.2 4.6-.6z" />);
export const StarFilled = fill('M10 3.3l2 4.2 4.6.6-3.4 3.2.9 4.6L10 13.7l-4.1 2.2.9-4.6-3.4-3.2 4.6-.6z');
export const CommentIcon = svg(<path d="M4.8 4h10.4A1.3 1.3 0 0 1 16.5 5.3v7.1a1.3 1.3 0 0 1-1.3 1.3H9.6L6 16.4v-2.7H4.8a1.3 1.3 0 0 1-1.3-1.3V5.3A1.3 1.3 0 0 1 4.8 4z" />);
export const ClockIcon = svg(<><circle cx="10" cy="10" r="6.6" /><path d="M10 6v4.2l2.8 1.6" /></>);
export const PageIcon = svg(<><path d="M5.6 3h5.8l3.6 3.6v9.2a1.2 1.2 0 0 1-1.2 1.2H5.6a1.2 1.2 0 0 1-1.2-1.2V4.2A1.2 1.2 0 0 1 5.6 3z" /><path d="M11.2 3v3.8H15" /><path d="M7.2 10.4h5.6M7.2 13.2h5.6" /></>);
export const EmptyPageIcon = svg(<><path d="M5.6 3h5.8l3.6 3.6v9.2a1.2 1.2 0 0 1-1.2 1.2H5.6a1.2 1.2 0 0 1-1.2-1.2V4.2A1.2 1.2 0 0 1 5.6 3z" /><path d="M11.2 3v3.8H15" /></>);
export const TableIcon = svg(<><rect x="3" y="4" width="14" height="12" rx="1.4" /><path d="M3 8h14M3 12h14M8 8v8" /></>);
export const BoardIcon = svg(<><rect x="3" y="4" width="4" height="12" rx="1" /><rect x="8" y="4" width="4" height="8" rx="1" /><rect x="13" y="4" width="4" height="10" rx="1" /></>);
export const ListIcon = svg(<><path d="M7.5 5.5h9M7.5 10h9M7.5 14.5h9" /><circle cx="4" cy="5.5" r=".6" fill="currentColor" /><circle cx="4" cy="10" r=".6" fill="currentColor" /><circle cx="4" cy="14.5" r=".6" fill="currentColor" /></>);
export const GalleryIcon = svg(<><rect x="3" y="3.5" width="6" height="6" rx="1" /><rect x="11" y="3.5" width="6" height="6" rx="1" /><rect x="3" y="11.5" width="6" height="5" rx="1" /><rect x="11" y="11.5" width="6" height="5" rx="1" /></>);
export const CalendarIcon = svg(<><rect x="3.3" y="4.4" width="13.4" height="12.3" rx="1.6" /><path d="M3.3 8.2h13.4M7 3v2.6M13 3v2.6" /></>);
export const TimelineIcon = svg(<><path d="M3.5 5.5h7M6.5 10h8M9.5 14.5h7" strokeWidth="2.2" /></>);
export const ChartIcon = svg(<><path d="M4 16.5V9.5M8 16.5V5M12 16.5v-8M16 16.5V3.5" strokeWidth="2" /></>);
export const FeedIcon = svg(<><rect x="4" y="3.5" width="12" height="5.5" rx="1.2" /><rect x="4" y="11" width="12" height="5.5" rx="1.2" /></>);
export const FilterIcon = svg(<path d="M3.5 5h13M6 10h8M8.5 15h3" />);
export const SortIcon = svg(<><path d="M6 4v12M3.5 13.5L6 16l2.5-2.5" /><path d="M14 16V4M11.5 6.5L14 4l2.5 2.5" /></>);
export const LightningIcon = svg(<path d="M11 2.8L4.6 11h4.6L8.8 17.2 15.4 9h-4.6z" />);
export const ArrowUpRight = svg(<><path d="M6.5 13.5l7-7M8 6.5h5.5V12" /></>);
export const SidePeekIcon = svg(<><rect x="3" y="4" width="14" height="12" rx="1.6" /><path d="M11 4v12" /></>);
export const CenterPeekIcon = svg(<><rect x="3" y="4" width="14" height="12" rx="1.6" /><rect x="6" y="7" width="8" height="6" rx=".8" /></>);
export const FullPageIcon = svg(<><rect x="3" y="4" width="14" height="12" rx="1.6" /></>);
export const ExpandIcon = svg(<><path d="M11.5 3.5h5v5M8.5 16.5h-5v-5M16.5 3.5l-5.5 5.5M3.5 16.5L9 11" /></>);
export const CloseIcon = svg(<path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />);
export const CheckIcon = svg(<path d="M4.5 10.5l3.5 3.5 7.5-8" />);
export const LinkIcon = svg(<><path d="M8.6 11.4a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.9.9" /><path d="M11.4 8.6a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.9-.9" /></>);
export const DuplicateIcon = svg(<><rect x="6.5" y="6.5" width="10" height="10" rx="1.6" /><path d="M13.5 6.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5" /></>);
export const TurnIntoIcon = svg(<><path d="M4 7.5a4 4 0 0 1 7-2.6l1.2 1.3" /><path d="M12.6 3.4v3.2H9.4" /><path d="M16 12.5a4 4 0 0 1-7 2.6l-1.2-1.3" /><path d="M7.4 16.6v-3.2h3.2" /></>);
export const MoveToIcon = svg(<><path d="M4 10h10.5M10.5 5.5L15 10l-4.5 4.5" /></>);
export const PaintIcon = svg(<><path d="M5 15.5l4.2-11h1.6l4.2 11M6.5 11.5h7" /></>);
export const ArrowUturnIcon = svg(<><path d="M7.5 6.5L4 10l3.5 3.5" /><path d="M4 10h8a4 4 0 0 1 0 8h-1" /></>);
export const LockIcon = svg(<><rect x="4.5" y="9" width="11" height="8" rx="1.4" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" /></>);
export const ExportIcon = svg(<><path d="M10 3.5v9M6.5 7L10 3.5 13.5 7" /><path d="M4 12v3a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 16 15v-3" /></>);
export const ImportIcon = svg(<><path d="M10 12.5v-9M6.5 9L10 12.5 13.5 9" /><path d="M4 12v3a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 16 15v-3" /></>);
export const HistoryIcon = svg(<><path d="M3.8 10a6.2 6.2 0 1 0 1.8-4.4L3.8 7.4" /><path d="M3.8 4v3.4h3.4" /><path d="M10 6.8v3.6l2.4 1.4" /></>);
export const SmileIcon = svg(<><circle cx="10" cy="10" r="6.6" /><path d="M7.2 11.6a3.4 3.4 0 0 0 5.6 0" /><circle cx="7.8" cy="8.3" r=".5" fill="currentColor" /><circle cx="12.2" cy="8.3" r=".5" fill="currentColor" /></>);
export const ImageIcon = svg(<><rect x="3" y="4" width="14" height="12" rx="1.6" /><circle cx="7.4" cy="8.2" r="1.3" /><path d="M3.4 14.4l4-3.6 2.8 2.4 2.8-2.6 3.6 3.4" /></>);
export const TextIcon = svg(<path d="M5 5.5h10M10 5.5v10" />);
export const AtIcon = svg(<><circle cx="10" cy="10" r="2.8" /><path d="M12.8 10v1a2 2 0 0 0 4 0v-1a6.8 6.8 0 1 0-2.7 5.4" /></>);
export const BoldIcon = fill('M6 3.75h4.6c2.3 0 3.8 1.2 3.8 3.1 0 1.3-.8 2.3-2 2.6v.1c1.5.2 2.6 1.4 2.6 2.9 0 2.2-1.7 3.6-4.3 3.6H6zm2 1.7v3.6h2.2c1.4 0 2.2-.6 2.2-1.8 0-1.1-.8-1.8-2.1-1.8zm0 5.2v3.9h2.5c1.6 0 2.4-.7 2.4-1.9s-.9-2-2.5-2z');
export const ItalicIcon = svg(<><path d="M8.5 4h6M5.5 16h6M11.5 4l-3 12" /></>);
export const UnderlineIcon = svg(<><path d="M6 4v5.5a4 4 0 0 0 8 0V4" /><path d="M5 16.5h10" /></>);
export const StrikeIcon = svg(<><path d="M4 10h12" /><path d="M13.6 6.2c-.4-1.4-1.8-2.4-3.7-2.4-2.1 0-3.6 1.1-3.6 2.7 0 .7.3 1.3.9 1.7M6.3 13.6c.4 1.6 1.9 2.6 3.9 2.6 2.3 0 3.8-1.1 3.8-2.9 0-.5-.1-.9-.4-1.3" /></>);
export const CodeIcon = svg(<><path d="M7 6l-4 4 4 4M13 6l4 4-4 4" /></>);
export const EquationIcon = svg(<><path d="M3.5 11l1.8-1 2.2 5.5 3-11.5h6" /><path d="M11.5 9l4 4M15.5 9l-4 4" /></>);
export const SparkleIcon = svg(<><path d="M10 3l1.4 4.1L15.5 8.5l-4.1 1.4L10 14l-1.4-4.1L4.5 8.5l4.1-1.4z" /><path d="M15.5 13v4M13.5 15h4" /></>);
export const UserIcon = svg(<><circle cx="10" cy="7" r="3.2" /><path d="M3.8 16.8a6.2 6.2 0 0 1 12.4 0" /></>);
export const UsersIcon = svg(<><circle cx="7.5" cy="7.2" r="2.8" /><path d="M2.5 16.3a5 5 0 0 1 10 0" /><path d="M12.6 4.7a2.8 2.8 0 0 1 0 5.2M14.5 11.6a5 5 0 0 1 3 4.7" /></>);
export const GlobeIcon = svg(<><circle cx="10" cy="10" r="6.8" /><path d="M3.2 10h13.6M10 3.2c1.9 2 2.8 4.2 2.8 6.8s-.9 4.8-2.8 6.8c-1.9-2-2.8-4.2-2.8-6.8s.9-4.8 2.8-6.8z" /></>);
export const HashIcon = svg(<path d="M8 3.5l-1.5 13M13.5 3.5l-1.5 13M4 7.5h12.5M3.5 12.5H16" />);
export const CheckboxIcon = svg(<><rect x="3.5" y="3.5" width="13" height="13" rx="2.2" /><path d="M6.8 10.2l2.2 2.2 4.4-4.8" /></>);
export const SelectIcon = svg(<><circle cx="10" cy="10" r="6.8" /><path d="M7 9l3 3 3-3" /></>);
export const MultiSelectIcon = svg(<><path d="M8 5.5h9M8 10h9M8 14.5h9" /><path d="M3 5.5l1.2 1.2L6 4.5M3 10l1.2 1.2L6 9M3 14.5l1.2 1.2L6 13.5" /></>);
export const StatusIcon = svg(<><circle cx="10" cy="10" r="6.6" strokeDasharray="2.6 1.8" /><circle cx="10" cy="10" r="2.6" fill="currentColor" stroke="none" /></>);
export const ParagraphIcon = svg(<><path d="M5 5h10M5 10h10M5 15h6" /></>);
export const MailIcon = svg(<><rect x="3" y="4.5" width="14" height="11" rx="1.6" /><path d="M3.5 5.5L10 11l6.5-5.5" /></>);
export const PhoneIcon = svg(<path d="M5 3.5h2.6l1.3 3.4-1.7 1.1a8 8 0 0 0 4.8 4.8l1.1-1.7 3.4 1.3V15a1.5 1.5 0 0 1-1.6 1.5A12.5 12.5 0 0 1 3.5 5.1 1.5 1.5 0 0 1 5 3.5z" />);
export const FormulaIcon = svg(<><path d="M14 4.5H7.5L11 10l-3.5 5.5H14" /></>);
export const RelationIcon = svg(<><path d="M7.5 12.5l5-5M8.5 7.5h4v4" /><rect x="3" y="3" width="14" height="14" rx="2.5" /></>);
export const RollupIcon = svg(<><circle cx="10" cy="10" r="6.8" /><path d="M7 10.5l2 2 4-4.5" /></>);
export const PaperclipIcon = svg(<path d="M15.6 9.4l-5.3 5.3a3.5 3.5 0 0 1-5-5l6-6a2.3 2.3 0 0 1 3.3 3.3L8.6 13a1.2 1.2 0 0 1-1.7-1.7l5.3-5.3" />);
export const IdIcon = svg(<><rect x="3" y="5" width="14" height="10" rx="1.6" /><path d="M6.5 8v4M9.5 8v4h1.2a2 2 0 0 0 0-4z" /></>);
export const EyeIcon = svg(<><path d="M2.8 10s2.6-5 7.2-5 7.2 5 7.2 5-2.6 5-7.2 5-7.2-5-7.2-5z" /><circle cx="10" cy="10" r="2.2" /></>);
export const EyeOffIcon = svg(<><path d="M2.8 10s2.6-5 7.2-5 7.2 5 7.2 5-2.6 5-7.2 5-7.2-5-7.2-5z" /><circle cx="10" cy="10" r="2.2" /><path d="M4 16L16 4" /></>);
export const PropertiesIcon = svg(<><path d="M3.5 5.5h4M10.5 5.5h6M3.5 10h7M13.5 10h3M3.5 14.5h2M8.5 14.5h8" /></>);
export const GroupIcon = svg(<><rect x="3" y="3.5" width="14" height="5" rx="1.2" /><rect x="3" y="11.5" width="14" height="5" rx="1.2" /></>);
export const SlidersIcon = svg(<><path d="M4 6h5M13 6h3M4 14h2M10 14h6" /><circle cx="11" cy="6" r="2" /><circle cx="8" cy="14" r="2" /></>);
export const ArrowLeftIcon = svg(<path d="M15.5 10h-11M9 5.5L4.5 10 9 14.5" />);
export const ArrowRightIcon = svg(<path d="M4.5 10h11M11 5.5l4.5 4.5-4.5 4.5" />);
export const ArrowUpIcon = svg(<path d="M10 15.5v-11M5.5 9L10 4.5 14.5 9" />);
export const ArrowDownIcon = svg(<path d="M10 4.5v11M5.5 11l4.5 4.5 4.5-4.5" />);
export const WrapIcon = svg(<><path d="M3.5 5.5h13M3.5 10h10.5a2.5 2.5 0 0 1 0 5H10M11.5 13l-2 2 2 2M3.5 14.5h3" /></>);
export const QuestionIcon = svg(<><circle cx="10" cy="10" r="6.8" /><path d="M7.8 8a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.4v.5" /><circle cx="10" cy="14.4" r=".5" fill="currentColor" /></>);
export const BellIcon = svg(<><path d="M5.3 13.6V9a4.7 4.7 0 0 1 9.4 0v4.6l1.3 1.4H4z" /><path d="M8.3 15.8a1.8 1.8 0 0 0 3.4 0" /></>);
export const BulletListIcon = ListIcon;
export const NumberListIcon = svg(<><path d="M8 5.5h8.5M8 10h8.5M8 14.5h8.5" /><path d="M3.5 4.5l1-.5v3M3.3 9.6c.3-.6 1.7-.6 1.7.3 0 .7-1.7 1.4-1.7 1.6h1.8" strokeWidth="1" /></>);
export const ToggleListIcon = svg(<><path d="M3.5 4.5L6.5 6.5 3.5 8.5z" fill="currentColor" /><path d="M9 6.5h7.5M9 13.5h7.5" /></>);
export const QuoteIcon = svg(<><path d="M4.5 4v12" strokeWidth="2" /><path d="M8.5 6h8M8.5 10h8M8.5 14h5" /></>);
export const CalloutIcon = svg(<><rect x="3" y="4.5" width="14" height="11" rx="1.6" /><circle cx="6.4" cy="8" r=".8" fill="currentColor" /><path d="M8.8 8h5.4M6 12h8.2" /></>);
export const DividerIcon = svg(<path d="M3 10h14" />);
export const VideoIcon = svg(<><rect x="3" y="5" width="10" height="10" rx="1.6" /><path d="M13 9l4-2.4v6.8L13 11" /></>);
export const AudioIcon = svg(<><path d="M4 8v4h3l4 3V5L7 8z" /><path d="M13.5 7.5a3.5 3.5 0 0 1 0 5M15.5 5.5a6.3 6.3 0 0 1 0 9" /></>);
export const FileIcon = PaperclipIcon;
export const BookmarkIcon = svg(<path d="M5.5 3.5h9v13L10 13l-4.5 3.5z" />);
export const EmbedIcon = svg(<><rect x="3" y="4" width="14" height="12" rx="1.6" /><path d="M8 8.5l-2 1.5 2 1.5M12 8.5l2 1.5-2 1.5" /></>);
export const ColumnsIcon = svg(<><rect x="3" y="4" width="6" height="12" rx="1.2" /><rect x="11" y="4" width="6" height="12" rx="1.2" /></>);
export const TocIcon = svg(<><path d="M3.5 5.5h9M6 10h10.5M6 14.5h7.5" /></>);
export const BreadcrumbIcon = svg(<><path d="M3.5 10h2.5M9 10h2.5M14.5 10H17" /><path d="M6.5 8l1.5 2-1.5 2M12 8l1.5 2-1.5 2" /></>);
export const ButtonIcon = svg(<><rect x="3" y="6" width="14" height="8" rx="2.5" /><path d="M7 10h6" /></>);
export const SyncIcon = svg(<><path d="M15.5 8a5.6 5.6 0 0 0-10.3-1.7M4.5 12a5.6 5.6 0 0 0 10.3 1.7" /><path d="M5 3.5v3h3M15 16.5v-3h-3" /></>);
export const H1Icon = fill('M3 4.5h1.6v4.6h5.1V4.5h1.6v11H9.7V10.5H4.6v5H3zm11.7 11V7.9h-.1l-2 1.4V7.8l2.1-1.5h1.6v9.2z');
export const H2Icon = fill('M2.5 4.5h1.6v4.6h5.1V4.5h1.6v11H9.2V10.5H4.1v5H2.5zm9.8 3.8c0-1.4 1.1-2.4 2.7-2.4 1.6 0 2.6 1 2.6 2.3 0 .9-.4 1.6-1.5 2.7l-1.9 1.9v.1h3.6v1.4h-5.4v-1.1l2.9-2.9c.7-.7.9-1.1.9-1.6 0-.6-.5-1.1-1.2-1.1-.8 0-1.3.5-1.3 1.3v.1h-1.5z');
export const H3Icon = fill('M2.5 4.5h1.6v4.6h5.1V4.5h1.6v11H9.2V10.5H4.1v5H2.5zm11.3 6.3v-1.2h.9c.8 0 1.3-.4 1.3-1 0-.6-.5-1-1.2-1s-1.2.4-1.3 1.1h-1.5c.1-1.4 1.1-2.4 2.8-2.4 1.6 0 2.7.9 2.7 2.1 0 .9-.6 1.5-1.4 1.7v.1c1 .1 1.7.8 1.7 1.8 0 1.4-1.2 2.4-2.9 2.4-1.7 0-2.9-1-2.9-2.4h1.5c.1.7.6 1.1 1.4 1.1s1.4-.5 1.4-1.1c0-.7-.5-1.2-1.4-1.2z');
export const WorkspaceSwitchIcon = ChevronUpDown;
export const NotionAiIcon = svg(<><path d="M10 3.2c3.8 0 6.8 2.8 6.8 6.4 0 3.6-3 6.4-6.8 6.4-1 0-2-.2-2.8-.5L4 16.6l.9-2.8C3.8 12.7 3.2 11.2 3.2 9.6 3.2 6 6.2 3.2 10 3.2z" /><circle cx="7.6" cy="9.4" r=".7" fill="currentColor" /><circle cx="12.4" cy="9.4" r=".7" fill="currentColor" /></>);
export const UploadIcon = ExportIcon;
export const ShuffleIcon = svg(<><path d="M3.5 6h2.6c1.6 0 3 .9 3.7 2.3l.4.9c.7 1.4 2.1 2.3 3.7 2.3h2.6M3.5 14h2.6c1.2 0 2.3-.5 3-1.4M13.9 4l2.6 2-2.6 2M13.9 12l2.6 2-2.6 2" /><path d="M11.4 7.6a3.9 3.9 0 0 1 2.5-1.6h2.6M13.9 14h2.6" /></>);
export const MoonIcon = svg(<path d="M15.8 12.4A6.6 6.6 0 0 1 7.6 4.2a6.6 6.6 0 1 0 8.2 8.2z" />);
export const SunIcon = svg(<><circle cx="10" cy="10" r="3.2" /><path d="M10 2.8v1.6M10 15.6v1.6M2.8 10h1.6M15.6 10h1.6M4.9 4.9l1.1 1.1M14 14l1.1 1.1M4.9 15.1L6 14M14 6l1.1-1.1" /></>);
export const ArchiveIcon = svg(<><rect x="3" y="4" width="14" height="3.5" rx="1" /><path d="M4.2 7.5v7.3a1.2 1.2 0 0 0 1.2 1.2h9.2a1.2 1.2 0 0 0 1.2-1.2V7.5M8 10.5h4" /></>);
export const FontIcon = svg(<><path d="M4 15.5l3.6-11h1.6l3.6 11M5.3 11.5h6" /><path d="M14 9.5c.3-.6 1-1 1.8-1 1.1 0 1.8.7 1.8 1.8v5.2" /></>);
export const PinIcon = svg(<><path d="M10 13v4.5M6.5 3.5h7M7.5 3.5v4l-2 3.5h9l-2-3.5v-4" /></>);
export const ResizeIcon = svg(<path d="M7.5 5.5v9M12.5 5.5v9" />);
