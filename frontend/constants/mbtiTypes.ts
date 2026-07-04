/** 16 MBTI personality types — stored in backend `badge_text` (primary type, uppercase). */

import { MBTI_GROUP_ZH, UI } from './i18n';

export const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
] as const;

export type MbtiType = (typeof MBTI_TYPES)[number];

export type MbtiGroup = 'analysts' | 'diplomats' | 'sentinels' | 'explorers';

export const MBTI_GROUP_LABELS: Record<MbtiGroup, string> = {
  analysts: MBTI_GROUP_ZH.analysts,
  diplomats: MBTI_GROUP_ZH.diplomats,
  sentinels: MBTI_GROUP_ZH.sentinels,
  explorers: MBTI_GROUP_ZH.explorers,
};

export const MBTI_GROUP_BY_TYPE: Record<MbtiType, MbtiGroup> = {
  INTJ: 'analysts', INTP: 'analysts', ENTJ: 'analysts', ENTP: 'analysts',
  INFJ: 'diplomats', INFP: 'diplomats', ENFJ: 'diplomats', ENFP: 'diplomats',
  ISTJ: 'sentinels', ISFJ: 'sentinels', ESTJ: 'sentinels', ESFJ: 'sentinels',
  ISTP: 'explorers', ISFP: 'explorers', ESTP: 'explorers', ESFP: 'explorers',
};

/** Quick-filter rows shown above the map (first chip = show all). */
export const MBTI_FILTER_ROWS: readonly (readonly string[])[] = [
  [UI.all, 'INTJ', 'INTP', 'ENTJ', 'ENTP'],
  ['INFJ', 'INFP', 'ENFJ', 'ENFP'],
  ['ISTJ', 'ISFJ', 'ESTJ', 'ESFJ'],
  ['ISTP', 'ISFP', 'ESTP', 'ESFP'],
] as const;

export const MBTI_FILTER_ALL = UI.all;

export const MBTI_MARKER_COLORS: Record<MbtiGroup, { normal: string; selected: string }> = {
  analysts: { normal: '#7c3aed', selected: '#5b21b6' },
  diplomats: { normal: '#059669', selected: '#047857' },
  sentinels: { normal: '#2563eb', selected: '#1d4ed8' },
  explorers: { normal: '#ea580c', selected: '#c2410c' },
};

export function isMbtiType(value: string): value is MbtiType {
  return (MBTI_TYPES as readonly string[]).includes(value.toUpperCase());
}

/** Extract primary MBTI type from `badge_text` (first token). */
export function mbtiTypeFromBadge(badgeText: string | null | undefined): MbtiType | null {
  const raw = (badgeText || '').trim().split(/[,，\s]+/)[0]?.toUpperCase();
  return raw && isMbtiType(raw) ? raw : null;
}

export function mbtiGroupLabel(type: MbtiType): string {
  return MBTI_GROUP_LABELS[MBTI_GROUP_BY_TYPE[type]];
}

export function mbtiMarkerColors(type: MbtiType | null, isSelected: boolean) {
  if (!type) {
    return isSelected
      ? { normal: '#e11d48', selected: '#e11d48' }
      : { normal: '#f43f5e', selected: '#e11d48' };
  }
  const group = MBTI_GROUP_BY_TYPE[type];
  const palette = MBTI_MARKER_COLORS[group];
  return isSelected ? palette : palette;
}
