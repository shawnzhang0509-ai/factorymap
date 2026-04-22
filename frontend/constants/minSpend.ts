/** Allowed minimum-spend values (shop field + home filter) */
export const MIN_SPEND_OPTIONS = [60, 80, 100, 120, 140, 160] as const;

export type MinSpendValue = (typeof MIN_SPEND_OPTIONS)[number];

export function parseMinSpend(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  if ((MIN_SPEND_OPTIONS as readonly number[]).includes(n)) return n;
  return n;
}
