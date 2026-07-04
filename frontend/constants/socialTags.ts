/**
 * Social profile fields repurposed from factory columns:
 * - `additional_price` → looking_for (comma-separated keys)
 * - `main_product` → interests (comma-separated labels)
 * - `filter_city` → city
 * - `min_spend` → age (integer)
 */

export const LOOKING_FOR_OPTIONS = [
  { key: 'friends', label: 'New friends', subtitle: 'Hang out, chat, explore the city' },
  { key: 'dating', label: 'Dating', subtitle: 'Romantic connections' },
  { key: 'activity', label: 'Activity buddies', subtitle: 'Sports, hobbies, events' },
  { key: 'networking', label: 'Networking', subtitle: 'Career, projects, co-founders' },
] as const;

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
  'Coffee', 'Hiking', 'Photography', 'Gaming', 'Music', 'Reading',
  'Travel', 'Fitness', 'Food', 'Movies', 'Art', 'Tech',
] as const;

export function interestsFromField(value: string | null | undefined): string[] {
  return (value || '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
