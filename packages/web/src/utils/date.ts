export function toISODateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO(now: Date = new Date()): string {
  return toISODateLocal(now);
}

export function tomorrowISO(now: Date = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  return toISODateLocal(date);
}
