/**
 * Social profile fields repurposed from factory columns:
 * - `additional_price` → looking_for (comma-separated keys)
 * - `main_product` → interests (comma-separated labels)
 * - `filter_city` → city
 * - `min_spend` → age (integer)
 */

import { LOOKING_FOR_ZH } from './i18n';

export const LOOKING_FOR_OPTIONS = [
  { key: 'friends' as const, label: LOOKING_FOR_ZH.friends.label, subtitle: LOOKING_FOR_ZH.friends.subtitle },
  { key: 'dating' as const, label: LOOKING_FOR_ZH.dating.label, subtitle: LOOKING_FOR_ZH.dating.subtitle },
  { key: 'activity' as const, label: LOOKING_FOR_ZH.activity.label, subtitle: LOOKING_FOR_ZH.activity.subtitle },
  { key: 'networking' as const, label: LOOKING_FOR_ZH.networking.label, subtitle: LOOKING_FOR_ZH.networking.subtitle },
];

export type LookingForKey = (typeof LOOKING_FOR_OPTIONS)[number]['key'];

export const LOOKING_FOR_KEYS: LookingForKey[] = LOOKING_FOR_OPTIONS.map((o) => o.key);

export function lookingForKeysFromField(value: string | null | undefined): LookingForKey[] {
  const hay = (value || '').toLowerCase();
  return LOOKING_FOR_KEYS.filter((key) => hay.includes(key));
}

export function profilePassesLookingForFilter(
  additionalPrice: string | null | undefined,
  filter: LookingForKey | null,
): boolean {
  if (!filter) return true;
  return lookingForKeysFromField(additionalPrice).includes(filter);
}

export const INTEREST_SUGGESTIONS = [
  '咖啡', '徒步', '摄影', '游戏', '音乐', '阅读',
  '旅行', '健身', '美食', '电影', '艺术', '科技',
] as const;

export function interestsFromField(value: string | null | undefined): string[] {
  return (value || '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
