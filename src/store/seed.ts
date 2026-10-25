import type { Block, BlockType, ID, PropertySchema, View } from './types';
import type { DataState } from './store';

let counter = 0;
const sid = (p = 'b') => `${p}${(++counter).toString(36).padStart(4, '0')}demo`;

interface Spec {
  type: BlockType;
  text?: string;
  props?: Record<string, any>;
  children?: Spec[];
  id?: string;
}

const B = (type: BlockType, text = '', props: Record<string, any> = {}, children: Spec[] = []): Spec => ({
  type,
  text,
  props,
  children,
});

const ME = 'u_me';
const DAY = 86400000;

export function buildSeed(): DataState {
  counter = 0;
  const blocks: Record<ID, Block> = {};
  const t0 = Date.now();

  const add = (spec: Spec, parent: ID | null, time = t0, by = ME): ID => {
    const id = spec.id ?? sid();
    const block: Block = {
      id,
      type: spec.type,
      text: spec.text ?? '',
      props: spec.props ?? {},
      children: [],
      parent,
      createdAt: time,
      updatedAt: time,
      createdBy: by,
      lastEditedBy: by,
    };
    blocks[id] = block;
    block.children = (spec.children ?? []).map((c) => add(c, id, time, by));
    return id;
  };

  const page = (title: string, icon: string, children: Spec[], props: Record<string, any> = {}): Spec =>
    B('page', '', { title, icon, ...props }, children);

  // ---------- databases ----------
  const opt = (name: string, color: string, group?: string) => ({ id: sid('o'), name, color, group });

  const makeDb = (
    title: string,
    icon: string,
    schema: PropertySchema[],
    views: Partial<View>[],
    rows: { title: string; icon?: string; values: Record<string, any>; content?: Spec[]; cover?: string }[],
    extra: Record<string, any> = {},
  ): Spec => {
    const sch: Record<ID, PropertySchema> = {};
    schema.forEach((p) => (sch[p.id] = p));
    const allIds = schema.map((p) => p.id);
    return {
      type: 'database',
      text: '',
      props: {
        title,
        icon,
        schema: sch,
        views: views.map((v) => ({
          id: sid('v'),
          name: 'Table',
          type: 'table',
          filters: [],
          sorts: [],
          propOrder: allIds,
          hidden: [],
          widths: {},
          calcs: {},
          ...v,
        })),
        inline: false,
        ...extra,
      },
      children: rows.map((r) =>
        B('page', '', { title: r.title, icon: r.icon, values: r.values, cover: r.cover }, r.content ?? []),
      ),
    };
  };

  // Task list
  const st = {
    ns: opt('Not started', 'default', 'todo'),
    ip: opt('In progress', 'blue', 'in_progress'),
    dn: opt('Done', 'green', 'complete'),
  };
  const pri = { low: opt('Low', 'green'), med: opt('Medium', 'yellow'), high: opt('High', 'red') };
  const tags = {
    mob: opt('Mobile', 'purple'),
    web: opt('Website', 'blue'),
    des: opt('Design', 'pink'),
    eng: opt('Engineering', 'orange'),
    mkt: opt('Marketing', 'brown'),
  };
  const day = (n: number) => new Date(t0 + n * DAY).toISOString().slice(0, 10);

  const tasks = makeDb(
    'Tasks',
    '✅',
    [
      { id: 'title', name: 'Task name', type: 'title' },
      { id: 'status', name: 'Status', type: 'status', options: [st.ns, st.ip, st.dn] as any },
      { id: 'assignee', name: 'Assignee', type: 'person' },
      { id: 'due', name: 'Due', type: 'date' },
      { id: 'priority', name: 'Priority', type: 'select', options: [pri.low, pri.med, pri.high] as any },
      { id: 'tags', name: 'Tags', type: 'multi_select', options: Object.values(tags) as any },
      { id: 'done', name: 'Reviewed', type: 'checkbox' },
      { id: 'est', name: 'Estimate', type: 'number', numberFormat: 'number' },
    ],
    [
      { name: 'Board', type: 'board', groupBy: 'status', hidden: ['status', 'done', 'est', 'due'] },
      { name: 'All tasks', type: 'table', calcs: { est: 'sum', title: 'count' } },
      { name: 'Calendar', type: 'calendar', dateProp: 'due', hidden: ['status', 'done', 'est', 'due', 'tags', 'priority', 'assignee'] },
      { name: 'Timeline', type: 'timeline', dateProp: 'due', hidden: ['status', 'done', 'est', 'due', 'tags', 'priority'] },
    ],
    [
      { title: 'Ship new onboarding flow', values: { status: st.ip.id, assignee: [ME], due: { start: day(2) }, priority: pri.high.id, tags: [tags.web.id, tags.des.id], est: 5 }, content: [B('text', 'Make the first five minutes delightful. Reduce steps from 7 to 3.'), B('todo', 'Wireframes', { checked: true }), B('todo', 'Copy review'), B('todo', 'Usability test with 5 people')] },
      { title: 'Fix login bug on Safari', values: { status: st.ns.id, assignee: ['u_ana'], due: { start: day(1) }, priority: pri.high.id, tags: [tags.eng.id], est: 2 } },
      { title: 'Write launch blog post', values: { status: st.ns.id, assignee: ['u_ben'], due: { start: day(6) }, priority: pri.med.id, tags: [tags.mkt.id], est: 3 } },
      { title: 'Redesign settings page', values: { status: st.ip.id, assignee: ['u_ana', ME], due: { start: day(4) }, priority: pri.med.id, tags: [tags.des.id, tags.web.id], est: 8 } },
      { title: 'iOS widget prototype', values: { status: st.ns.id, assignee: ['u_cho'], due: { start: day(9) }, priority: pri.low.id, tags: [tags.mob.id], est: 5 } },
      { title: 'Set up analytics dashboard', values: { status: st.dn.id, assignee: [ME], due: { start: day(-3) }, priority: pri.med.id, tags: [tags.eng.id], done: true, est: 3 } },
      { title: 'Customer interviews', values: { status: st.dn.id, assignee: ['u_ben'], due: { start: day(-6) }, priority: pri.low.id, tags: [tags.mkt.id], done: true, est: 4 } },
    ],
  );

  const reading = makeDb(
    'Reading List',
    '📚',
    [
      { id: 'title', name: 'Name', type: 'title' },
      { id: 'author', name: 'Author', type: 'text' },
      { id: 'type', name: 'Type', type: 'select', options: [opt('Book', 'orange'), opt('Article', 'blue'), opt('Podcast', 'purple'), opt('Film', 'red')] as any },
      { id: 'status', name: 'Status', type: 'status', options: [opt('Not started', 'default', 'todo'), opt('Reading', 'blue', 'in_progress'), opt('Finished', 'green', 'complete')] as any },
      { id: 'rating', name: 'Rating', type: 'select', options: [opt('⭐⭐⭐⭐⭐', 'yellow'), opt('⭐⭐⭐⭐', 'yellow'), opt('⭐⭐⭐', 'yellow')] as any },
      { id: 'link', name: 'Link', type: 'url' },
    ],
    [
      { name: 'Gallery', type: 'gallery', cardPreview: 'cover', cardSize: 'medium', hidden: ['link', 'rating'] },
      { name: 'Table', type: 'table' },
    ],
    [],
  );
  const readingRows: [string, string, number, number, number, string, string][] = [
    ['The Design of Everyday Things', 'Don Norman', 0, 2, 0, 'https://en.wikipedia.org/wiki/The_Design_of_Everyday_Things', 'gradient_1'],
    ['Thinking, Fast and Slow', 'Daniel Kahneman', 0, 1, 1, 'https://en.wikipedia.org/wiki/Thinking,_Fast_and_Slow', 'gradient_2'],
    ['How to Make Wealth', 'Paul Graham', 1, 2, 1, 'http://paulgraham.com/wealth.html', 'gradient_3'],
    ['The Tim Ferriss Show', 'Tim Ferriss', 2, 0, 2, 'https://tim.blog/podcast/', 'gradient_4'],
    ['Spirited Away', 'Hayao Miyazaki', 3, 2, 0, 'https://en.wikipedia.org/wiki/Spirited_Away', 'gradient_5'],
    ['Atomic Habits', 'James Clear', 0, 0, 2, 'https://jamesclear.com/atomic-habits', 'gradient_6'],
  ];
  const rOpts = reading.props!.schema;
  reading.children = readingRows.map(([t, a, ty, s, r, l, c]) =>
    B('page', '', {
      title: t,
      cover: c,
      values: {
        author: `${a}`,
        type: rOpts.type.options[ty].id,
        status: rOpts.status.options[s].id,
        rating: rOpts.rating.options[r].id,
        link: l,
      },
    }),
  );

  const journal = makeDb(
    'Journal',
    '✍️',
    [
      { id: 'title', name: 'Name', type: 'title' },
      { id: 'created', name: 'Created', type: 'created_time' },
      { id: 'tags', name: 'Tags', type: 'multi_select', options: [opt('Daily', 'blue'), opt('Idea', 'yellow'), opt('Reflection', 'green')] as any },
    ],
    [{ name: 'Entries', type: 'list', propOrder: ['title', 'tags', 'created'] }],
    [],
  );
  const jt = journal.props!.schema.tags.options;
  journal.children = [
    B('page', '', { title: 'A quiet Sunday', icon: '☕', values: { tags: [jt[0].id, jt[2].id] } }, [B('text', 'Slow morning, long walk, finally finished that book.')]),
    B('page', '', { title: 'App idea: shared grocery lists', icon: '💡', values: { tags: [jt[1].id] } }, [B('text', 'Lists that sort themselves by store aisle.')]),
    B('page', '', { title: 'Week in review', icon: '🗓️', values: { tags: [jt[2].id] } }, [B('bulleted', 'Shipped the onboarding prototype'), B('bulleted', 'Two great customer calls'), B('bulleted', 'Need more sleep')]),
  ];

  // ---------- pages ----------
  const gettingStarted = page('Getting Started', '👋', [
    B('text', 'Welcome to Potion!'),
    B('text', 'Here are the basics:'),
    B('todo', 'Click anywhere and just start typing'),
    B('todo', 'Hit <code>/</code> to see all the types of content you can add - headers, videos, sub pages, etc.'),
    B('todo', 'Highlight any text, and use the menu that pops up to <b>style</b> <i>your</i> <s>writing</s> <code>however</code> <span class="c-red">you</span> <span class="bg-yellow">like</span>'),
    B('todo', 'See the <code>⋮⋮</code> to the left of this checkbox on hover? Click and drag to move this line'),
    B('todo', 'Click the <code>+ New page</code> button at the top of your sidebar to add a new page'),
    B('todo', 'Click <code>Templates</code> in your sidebar to get started with pre-built pages'),
    B('toggle', 'This is a toggle block. Click the little triangle to see more useful tips!', {}, [
      B('bulleted', '<b>Templates:</b> Templates are pre-built pages that you can use to get started.'),
      B('bulleted', '<b>Integrations:</b> Embed tweets, videos, maps and more by pasting a link.'),
      B('bulleted', '<b>Keyboard shortcuts:</b> Press <code>Ctrl/⌘ + /</code> to turn the current block into another type.'),
      B('bulleted', '<b>Markdown:</b> Type <code>#</code> followed by a space for a heading, <code>-</code> for a bullet, <code>[]</code> for a to-do, and <code>&gt;</code> for a toggle.'),
    ]),
    B('callout', 'Have a question? Click the <b>?</b> at the bottom right for more guides, or to send us a message.', { icon: '👉', color: 'gray_background' }),
  ]);

  const quickNote = page('Quick Note', '📝', [
    B('text', 'Jot down a quick note here. Use this page as a scratchpad for anything on your mind.'),
    B('h1', 'Jot down some text'),
    B('text', 'Select any text to see formatting options. You can make text <b>bold</b>, <i>italic</i>, <u>underlined</u>, add <a href="https://potion.so">links</a>, and <span class="c-blue">change colors</span>.'),
    B('h2', 'Make a to-do list'),
    B('todo', 'Buy groceries', { checked: true }),
    B('todo', 'Call mom'),
    B('todo', 'Book dentist appointment'),
    B('h2', 'Create sub-pages'),
    B('text', 'Pages can live inside other pages, so you can organize everything in a nested structure.'),
    B('h2', 'Embed code'),
    B('code', "const greet = (name) => {\n  return `Hello, ${name}!`;\n};\n\nconsole.log(greet('Potion'));", { language: 'javascript' }),
    B('h2', 'Write some math'),
    B('equation', '', { expression: 'e^{i\\pi} + 1 = 0' }),
    B('quote', '“The best way to predict the future is to invent it.” — Alan Kay'),
    B('divider'),
    B('text', 'Lists can be nested:'),
    B('bulleted', 'Fruits', {}, [B('bulleted', 'Apples'), B('bulleted', 'Bananas', {}, [B('bulleted', 'Cavendish')])]),
    B('numbered', 'First'),
    B('numbered', 'Second'),
    B('numbered', 'Third'),
  ]);

  const personalHome = page(
    'Personal Home',
    '🏠',
    [
      B('callout', 'This is your home base. Everything you need to plan your week lives here.', { icon: '💡', color: 'default', bordered: true }),
      B('column_list', '', {}, [
        B('column', '', { width: 0.5 }, [
          B('h3', 'Daily'),
          B('todo', 'Morning pages', { checked: true }),
          B('todo', 'Exercise'),
          B('todo', 'Read 20 pages'),
        ]),
        B('column', '', { width: 0.5 }, [
          B('h3', 'Links'),
          B('bulleted', '<a href="https://www.wikipedia.org">Wikipedia</a>'),
          B('bulleted', '<a href="https://news.ycombinator.com">Hacker News</a>'),
          B('bulleted', '<a href="https://github.com">GitHub</a>'),
        ]),
      ]),
      B('h2', 'Table of contents'),
      B('toc'),
      B('h2', 'Inspiration'),
      B('image', '', { src: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&q=80', caption: 'Somewhere quiet', width: 1 }),
      B('h2', 'Bookmarks'),
      B('bookmark', '', { url: 'https://en.wikipedia.org/wiki/Notion_(productivity_software)', title: 'Notion (productivity software) - Wikipedia', description: 'Notion is a productivity and note-taking web application developed by Notion Labs Inc.', site: 'en.wikipedia.org' }),
    ],
    { cover: 'gradient_8' },
  );

  const team = page('Team Wiki', '📖', [
    B('text', 'The single source of truth for how our team works.'),
    B('h2', 'Getting around'),
    B('table', '', {
      hasHeaderRow: true,
      rows: [
        ['Topic', 'Owner', 'Where'],
        ['Engineering onboarding', 'Ana', 'Engineering Handbook'],
        ['Brand guidelines', 'Ben', 'Design / Brand'],
        ['Expense policy', 'Cho', 'Ops / Finance'],
      ],
    }),
    B('h2', 'Values'),
    B('numbered', '<b>Be kind.</b> Assume good intent.'),
    B('numbered', '<b>Ship it.</b> Done is better than perfect.'),
    B('numbered', '<b>Write it down.</b> If it isn\'t written, it didn\'t happen.'),
  ]);

  const roadmap = makeDb(
    'Product Roadmap',
    '🗺️',
    [
      { id: 'title', name: 'Project', type: 'title' },
      { id: 'status', name: 'Status', type: 'status', options: [opt('Planning', 'default', 'todo'), opt('In progress', 'blue', 'in_progress'), opt('Shipped', 'green', 'complete')] as any },
      { id: 'dates', name: 'Dates', type: 'date' },
      { id: 'owner', name: 'Owner', type: 'person' },
      { id: 'quarter', name: 'Quarter', type: 'select', options: [opt('Q3', 'orange'), opt('Q4', 'purple'), opt('Q1', 'blue')] as any },
      { id: 'progress', name: 'Progress', type: 'number', numberFormat: 'percent' },
    ],
    [
      { name: 'Timeline', type: 'timeline', dateProp: 'dates', hidden: ['dates', 'quarter', 'progress', 'status'] },
      { name: 'Table', type: 'table' },
      { name: 'By status', type: 'chart', groupBy: 'status', chartType: 'bar' },
    ],
    [],
  );
  const rs = roadmap.props!.schema;
  roadmap.children = [
    ['Offline mode', 1, -10, 14, ['u_ana'], 1, 0.4],
    ['Public API v2', 0, 7, 30, ['u_ben'], 1, 0],
    ['Calendar sync', 2, -40, -5, [ME], 0, 1],
    ['AI writing assistant', 1, -5, 20, ['u_cho', ME], 1, 0.65],
    ['Mobile redesign', 0, 20, 50, ['u_cho'], 2, 0],
  ].map(([t, s, a, b, o, q, p]: any) =>
    B('page', '', {
      title: t,
      values: {
        status: rs.status.options[s].id,
        dates: { start: day(a), end: day(b) },
        owner: o,
        quarter: rs.quarter.options[q].id,
        progress: p,
      },
    }),
  );

  const meetingNotes = page('Meeting Notes', '🤝', [
    B('text', 'Weekly sync — notes and action items.'),
    B('h3', 'Agenda'),
    B('bulleted', 'Wins from last week'),
    B('bulleted', 'Roadmap check-in'),
    B('bulleted', 'Open questions'),
    B('h3', 'Action items'),
    B('todo', '@Ana — follow up with design', { checked: false }),
    B('todo', '@Ben — draft blog post outline', { checked: true }),
  ]);

  const gsId = add(gettingStarted, null, t0 - 2 * DAY);
  const qnId = add(quickNote, null, t0 - 2 * DAY);
  const phId = add(personalHome, null, t0 - DAY);
  // nest some pages under Personal Home
  const tasksId = add(tasks, phId, t0 - DAY);
  const readingId = add(reading, phId, t0 - DAY);
  const journalId = add(journal, phId, t0 - DAY);
  blocks[phId].children.push(B_link(blocks, tasksId), B_link(blocks, readingId), B_link(blocks, journalId));
  // page blocks inside the page tree must be children; already pushed above by add(parent), fix duplicates
  blocks[phId].children = dedupe(blocks[phId].children);

  const teamId = add(team, null, t0 - 3 * DAY, 'u_ana');
  const roadmapId = add(roadmap, null, t0 - 3 * DAY, 'u_ben');
  const mnId = add(meetingNotes, teamId, t0 - DAY, 'u_ben');
  blocks[teamId].children = dedupe([...blocks[teamId].children, mnId]);

  const users = {
    [ME]: { id: ME, name: 'Demo User', email: 'demo@potion.so', color: '#E16259' },
    u_ana: { id: 'u_ana', name: 'Ana Silva', email: 'ana@potion.so', color: '#2383E2' },
    u_ben: { id: 'u_ben', name: 'Ben Carter', email: 'ben@potion.so', color: '#0F7B6C' },
    u_cho: { id: 'u_cho', name: 'Cho Min', email: 'cho@potion.so', color: '#9065B0' },
  };

  return {
    blocks,
    workspace: {
      name: "Demo User's Potion",
      icon: 'D',
      privatePages: [gsId, qnId, phId],
      teamPages: [teamId, roadmapId],
      favorites: [phId],
      recent: [
        { id: gsId, at: t0 - 1000 },
        { id: phId, at: t0 - 2000 },
        { id: qnId, at: t0 - 3000 },
        { id: tasksId, at: t0 - 4000 },
        { id: teamId, at: t0 - 5000 },
        { id: roadmapId, at: t0 - 6000 },
      ],
    },
    settings: {
      theme: 'light',
      sidebarWidth: 240,
      sidebarCollapsed: false,
      startPage: 'home',
      openPagesIn: 'side',
    },
    users,
    me: ME,
    discussions: {},
    notifications: [
      { id: 'n1', pageId: teamId, text: 'edited <b>Team Wiki</b>', at: t0 - 3600000, read: false, actor: 'u_ana' },
      { id: 'n2', pageId: roadmapId, text: 'invited you to <b>Product Roadmap</b>', at: t0 - 2 * DAY, read: false, actor: 'u_ben' },
      { id: 'n3', pageId: gsId, text: 'Welcome to Potion! Start with <b>Getting Started</b>', at: t0 - 3 * DAY, read: true, actor: 'u_cho' },
    ],
    versions: [],
  };
}

// helpers to keep the seed simple: the page block is already a child (added via add with parent)
function B_link(_blocks: Record<ID, Block>, id: ID) {
  return id;
}
function dedupe(a: ID[]) {
  return Array.from(new Set(a));
}
