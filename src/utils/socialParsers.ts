import { parseISO, isValid, format } from 'date-fns';

export function safeParseArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function safeParseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

export function safeFormatDate(value: unknown, pattern: string, fallback = '—'): string {
  const d = safeParseDate(value);
  return d ? format(d, pattern) : fallback;
}
