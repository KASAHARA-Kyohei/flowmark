import { fnv1a32 } from '@/utils/hash';
import { parseTaskLine } from './parseTaskLine';

export type Task = {
  id: string;
  raw: string;
  title: string;
  completed: boolean;
  section: string;
  tags: string[];
  due?: string;
  time?: string;
  priority: number;
  effortMinutes?: number;
  lineNumber: number; // 1-based line number in the source markdown
};

export type ParsedMarkdown = {
  tasks: Task[];
  sections: string[];
  headings: string[]; // explicit level-1 headings found in the markdown
};

function normalizeTaskLineForId(raw: string): string {
  // Keep ids stable across checkbox state toggles and checkbox insertion.
  if (raw.startsWith('- [ ] ')) return raw;
  if (raw.startsWith('- [x] ')) return raw.replace(/^- \[x\] /, '- [ ] ');
  if (raw.startsWith('- [X] ')) return raw.replace(/^- \[X\] /, '- [ ] ');

  // No checkbox: treat as unchecked for id stability.
  if (raw.startsWith('- ')) return raw.replace(/^- /, '- [ ] ');

  return raw;
}

export function parseMarkdown(markdown: string, options?: { now?: Date }): ParsedMarkdown {
  const now = options?.now ?? new Date();
  const lines = markdown.split(/\r?\n/);

  const tasks: Task[] = [];
  const seenSections = new Set<string>();
  const seenHeadings = new Set<string>();
  let currentSection = 'Inbox';
  seenSections.add(currentSection);

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];

    // MVP heading: level-1 only
    if (line.startsWith('# ')) {
      const heading = line.slice(2).trim();
      currentSection = heading.length > 0 ? heading : 'Inbox';
      seenSections.add(currentSection);
      if (heading.length > 0) seenHeadings.add(heading);
      continue;
    }

    // Fast path: task line must start with "- "
    if (!line.startsWith('- ')) continue;

    const parsed = parseTaskLine(line, { now });
    if (!parsed) continue;

    const id = fnv1a32(`${currentSection}\n${normalizeTaskLineForId(line)}`);
    tasks.push({
      id,
      raw: line,
      section: currentSection,
      ...parsed,
      lineNumber: index + 1
    });
  }

  const sections = Array.from(seenSections);
  sections.sort((a, b) => a.localeCompare(b));

  const headings = Array.from(seenHeadings);
  headings.sort((a, b) => a.localeCompare(b));

  return { tasks, sections, headings };
}

export function runParserSelfCheck(): void {
  const sample = [
    '# Inbox',
    '- [ ] write blog @2026-01-10 #oss !high ~30m',
    '- [x] fix parser bug @2026-01-07 @15:00 #wbs !!',
    '- [ ] buy milk',
    '',
    '# Today',
    '- ship MVP @today !!!'
  ].join('\n');

  const { tasks, sections, headings } = parseMarkdown(sample, { now: new Date('2026-01-05T12:00:00') });

  const byTitle = new Map(tasks.map((task) => [task.title, task]));
  const a = byTitle.get('write blog');
  const b = byTitle.get('fix parser bug');
  const c = byTitle.get('buy milk');
  const d = byTitle.get('ship MVP');

  if (!a || a.completed !== false || a.section !== 'Inbox' || a.due !== '2026-01-10') {
    throw new Error('parser self-check failed: write blog');
  }
  if (!b || b.completed !== true || b.time !== '15:00' || b.priority !== 2) {
    throw new Error('parser self-check failed: fix parser bug');
  }
  if (!c || c.tags.length !== 0) {
    throw new Error('parser self-check failed: buy milk');
  }
  if (!d || d.section !== 'Today' || d.due !== '2026-01-05') {
    throw new Error('parser self-check failed: ship MVP');
  }
  if (!sections.includes('Inbox') || !sections.includes('Today')) {
    throw new Error('parser self-check failed: sections');
  }
  if (!headings.includes('Inbox') || !headings.includes('Today')) {
    throw new Error('parser self-check failed: headings');
  }
}
