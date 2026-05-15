/**
 * MOQ / trade capacity — stored in backend `min_spend` integer (repurposed):
 * 0 / null / legacy currency values = unspecified (flexible)
 * 1 = Sample Available
 * 2 = Low MOQ (<100 pcs)
 * 3 = Medium MOQ (100–1000 pcs)
 * 4 = High MOQ (>1000 pcs)
 */

export type MoqFilterKey = 'sample' | 'low' | 'medium' | 'high';

export const MOQ_FILTER_OPTIONS: { key: MoqFilterKey; label: string; subtitle?: string }[] = [
  { key: 'sample', label: 'Sample Available', subtitle: 'Supports sampling' },
  { key: 'low', label: 'Low MOQ (< 100 pcs)', subtitle: 'Small runs / quick response' },
  { key: 'medium', label: 'Medium MOQ (100 - 1000 pcs)', subtitle: 'Mid-volume production' },
  { key: 'high', label: 'High MOQ (> 1000 pcs)', subtitle: 'Large-scale production' },
];

/** Normalize API value to tier 0–4 (0 = flexible / unknown). */
export function normalizeMoqStored(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 1 && n <= 4) return n;
  return 0;
}

export function shopPassesMoqFilter(storedRaw: unknown, filter: MoqFilterKey | null): boolean {
  if (filter == null) return true;
  const t = normalizeMoqStored(storedRaw);
  if (t === 0) return true;
  switch (filter) {
    case 'sample':
      return t === 1;
    case 'low':
      return t <= 2;
    case 'medium':
      return t <= 3;
    case 'high':
      return t >= 3;
    default:
      return true;
  }
}

export function moqTierLabel(tier: number): string | null {
  switch (tier) {
    case 1:
      return 'Sample available';
    case 2:
      return 'Low MOQ (<100 pcs)';
    case 3:
      return 'Medium MOQ (100–1000 pcs)';
    case 4:
      return 'High MOQ (>1000 pcs)';
    default:
      return null;
  }
}

/** Admin / edit dropdown: value sent to API as min_spend */
export const MOQ_TIER_FORM_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Any MOQ (unspecified)' },
  { value: 1, label: 'Sample Available' },
  { value: 2, label: 'Low MOQ (< 100 pcs)' },
  { value: 3, label: 'Medium MOQ (100 - 1000 pcs)' },
  { value: 4, label: 'High MOQ (> 1000 pcs)' },
];
