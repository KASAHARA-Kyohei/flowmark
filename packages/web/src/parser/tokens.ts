import { todayISO, tomorrowISO } from '@/utils/date';

export type TokenParseContext = {
  now: Date;
};

const dateTokenRe = /^@(\d{4}-\d{2}-\d{2})$/;
const todayTokenRe = /^@today$/;
const tomorrowTokenRe = /^@tomorrow$/;
const timeTokenRe = /^@(\d{2}):(\d{2})$/;
const tagTokenRe = /^#([A-Za-z0-9_]+)$/;
const effortTokenRe = /^~(\d+(?:\.\d+)?)([mh])$/;

export function parseDueToken(token: string, ctx: TokenParseContext): string | undefined {
  if (todayTokenRe.test(token)) return todayISO(ctx.now);
  if (tomorrowTokenRe.test(token)) return tomorrowISO(ctx.now);

  const match = dateTokenRe.exec(token);
  if (!match) return undefined;

  return match[1];
}

export function parseTimeToken(token: string): string | undefined {
  const match = timeTokenRe.exec(token);
  if (!match) return undefined;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return undefined;
  if (hour < 0 || hour > 23) return undefined;
  if (minute < 0 || minute > 59) return undefined;

  return `${match[1]}:${match[2]}`;
}

export function parseTagToken(token: string): string | undefined {
  const match = tagTokenRe.exec(token);
  return match ? match[1] : undefined;
}

export function parsePriorityToken(token: string): number | undefined {
  switch (token) {
    case '!low':
      return 1;
    case '!high':
      return 2;
    case '!!':
      return 2;
    case '!!!':
      return 3;
    default:
      return undefined;
  }
}

export function parseEffortToken(token: string): number | undefined {
  const match = effortTokenRe.exec(token);
  if (!match) return undefined;

  const value = Number(match[1]);
  if (Number.isNaN(value) || value < 0) return undefined;

  const unit = match[2];
  const minutes = unit === 'h' ? value * 60 : value;
  return Math.round(minutes);
}
