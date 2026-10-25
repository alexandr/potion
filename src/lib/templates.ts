import { useStore } from '../store/store';
import { parseMarkdown, insertClipBlocks } from '../components/editor/clipboard';

export interface Template {
  name: string;
  icon: string;
  category: string;
  description: string;
  markdown: string;
  cover?: string;
  withTasks?: boolean;
}

export const TEMPLATES: Template[] = [
  {
    name: 'Meeting Notes',
    icon: '🤝',
    category: 'Work',
    description: 'Capture agendas, decisions and action items for every meeting.',
    markdown: `## Attendees\n- \n## Agenda\n1. Updates\n2. Discussion\n3. Next steps\n## Notes\n## Action items\n- [ ] Follow up with the team\n- [ ] Share notes`,
  },
  {
    name: 'Weekly To-do List',
    icon: '✔️',
    category: 'Personal',
    description: 'Plan your week day by day.',
    markdown: `## Monday\n- [ ] \n## Tuesday\n- [ ] \n## Wednesday\n- [ ] \n## Thursday\n- [ ] \n## Friday\n- [ ] \n## Weekend\n- [ ] `,
    cover: 'gradient_2',
  },
  {
    name: 'Reading List',
    icon: '📚',
    category: 'Personal',
    description: 'Keep track of books, articles and podcasts.',
    markdown: `> Everything you want to read, watch or listen to.\n## Books\n- [ ] The Pragmatic Programmer\n- [ ] Deep Work\n## Articles\n- [ ] \n## Podcasts\n- [ ] `,
  },
  {
    name: 'Product Spec',
    icon: '📐',
    category: 'Engineering',
    description: 'A lightweight PRD to align your team.',
    markdown: `## Context\nWhy are we building this?\n## Goals\n- \n## Non-goals\n- \n## Proposal\n### User stories\n- As a user, I want…\n### Design\n## Open questions\n- [ ] \n## Launch plan\n1. Internal beta\n2. Public launch`,
    cover: 'gradient_3',
  },
  {
    name: 'Journal',
    icon: '✍️',
    category: 'Personal',
    description: 'A simple daily journal.',
    markdown: `## Today I'm grateful for\n1. \n2. \n3. \n## What would make today great?\n- \n## Reflection\n`,
    cover: 'gradient_9',
  },
  {
    name: 'Engineering Wiki',
    icon: '🛠️',
    category: 'Engineering',
    description: 'Document your stack, processes and onboarding.',
    markdown: `## Getting started\n- Clone the repo\n- Run \`npm install\`\n- Run \`npm run dev\`\n## Architecture\n## Code review guidelines\n1. Keep PRs small\n2. Write tests\n## On-call\n`,
  },
  {
    name: 'Habit Tracker',
    icon: '🌱',
    category: 'Personal',
    description: 'Build habits one day at a time.',
    markdown: `## Daily habits\n- [ ] Drink water\n- [ ] Exercise 30 min\n- [ ] Read 20 pages\n- [ ] Meditate\n## Notes\n`,
    cover: 'gradient_5',
  },
  {
    name: 'Project Kickoff',
    icon: '🚀',
    category: 'Work',
    description: 'Get a new project off on the right foot.',
    markdown: `## Overview\n## Team\n- Lead: \n- Design: \n- Engineering: \n## Timeline\n- [ ] Kickoff\n- [ ] Milestone 1\n- [ ] Launch\n## Risks\n`,
    withTasks: true,
  },
  {
    name: 'Class Notes',
    icon: '🎓',
    category: 'School',
    description: 'Organize lecture notes and assignments.',
    markdown: `## Lecture\n### Key ideas\n- \n### Questions\n- \n## Assignments\n- [ ] Problem set\n- [ ] Reading`,
  },
];

export function instantiateTemplate(t: Template): string {
  const s = useStore.getState();
  return s.batch(() => {
    const pid = s.createPage('private', { title: t.name, icon: t.icon, cover: t.cover });
    const first = useStore.getState().createBlock(pid, 0, 'text');
    insertClipBlocks(first, parseMarkdown(t.markdown), true);
    if (t.withTasks) {
      const p = useStore.getState().blocks[pid];
      useStore.getState().createDatabase(pid, true, p.children.length, 'board');
    }
    return pid;
  });
}
