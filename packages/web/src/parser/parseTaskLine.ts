import {
  parseDueToken,
  parseEffortToken,
  parsePriorityToken,
  parseTagToken,
  parseTimeToken,
  type TokenParseContext
} from './tokens';

export type ParsedTaskLine = {
  completed: boolean;
  title: string;
  tags: string[];
  due?: string;
  time?: string;
  priority: number;
  effortMinutes?: number;
};

// MVP task line rules:
// - starts with "- "
// - optional checkbox "[ ] " or "[x] " right after
const taskLineRe = /^- (?:\[([ xX])\]\s)?(.*)$/;

export function parseTaskLine(line: string, ctx: TokenParseContext): ParsedTaskLine | null {
  const match = taskLineRe.exec(line);
  if (!match) return null;

  const checkbox = match[1];
  const completed = checkbox === 'x' || checkbox === 'X';

  const rest = match[2] ?? '';
  const parts = rest.trim().length === 0 ? [] : rest.trim().split(/\s+/);

  const tags = new Set<string>();
  let due: string | undefined;
  let time: string | undefined;
  let priority = 0;
  let effortMinutes: number | undefined;

  const titleParts: string[] = [];
  for (const token of parts) {
    const parsedDue = parseDueToken(token, ctx);
    if (parsedDue) {
      due = parsedDue;
      continue;
    }

    const parsedTime = parseTimeToken(token);
    if (parsedTime) {
      time = parsedTime;
      continue;
    }

    const parsedTag = parseTagToken(token);
    if (parsedTag) {
      tags.add(parsedTag);
      continue;
    }

    const parsedPriority = parsePriorityToken(token);
    if (parsedPriority !== undefined) {
      priority = parsedPriority;
      continue;
    }

    const parsedEffort = parseEffortToken(token);
    if (parsedEffort !== undefined) {
      effortMinutes = parsedEffort;
      continue;
    }

    titleParts.push(token);
  }

  return {
    completed,
    title: titleParts.join(' ').trim(),
    tags: Array.from(tags),
    due,
    time,
    priority,
    effortMinutes
  };
}
