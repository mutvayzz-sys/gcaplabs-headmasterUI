export function normalizeHermesList<T>(value: unknown, envelopeKey: string): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (!value || typeof value !== 'object') {
    return [];
  }

  const nested = (value as Record<string, unknown>)[envelopeKey];
  return Array.isArray(nested) ? (nested as T[]) : [];
}
