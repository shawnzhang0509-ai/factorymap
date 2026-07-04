// App-wide constants (map center, MBTI tag visuals)

import { MBTI_TYPES, MBTI_GROUP_BY_TYPE, type MbtiType } from './constants/mbtiTypes';

/** Default map center — China (approx. geographic midpoint for overview). */
export const CHINA_CENTER = { lat: 32.0, lng: 105.0 };

/** @deprecated Use CHINA_CENTER */
export const NZ_CENTER = CHINA_CENTER;

export type TagStyle = { icon: string; bg: string; text?: string };

const GROUP_CHIP: Record<string, TagStyle> = {
  analysts: {
    icon: '🧠',
    bg: 'bg-gradient-to-r from-violet-500 to-purple-700 text-white shadow-violet-200',
  },
  diplomats: {
    icon: '💚',
    bg: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-200',
  },
  sentinels: {
    icon: '🛡️',
    bg: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-blue-200',
  },
  explorers: {
    icon: '🎒',
    bg: 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-orange-200',
  },
};

const MBTI_TAG_CONFIG: Record<string, TagStyle> = Object.fromEntries(
  MBTI_TYPES.map((type) => [
    type.toLowerCase(),
    {
      icon: type.slice(0, 1),
      bg: GROUP_CHIP[MBTI_GROUP_BY_TYPE[type as MbtiType]].bg,
      text: type,
    },
  ]),
);

export const TAG_CONFIG: Record<string, TagStyle> = {
  ...MBTI_TAG_CONFIG,
  'new-member': {
    icon: '✨',
    bg: 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-rose-200',
    text: 'New',
  },
  default: { icon: '✨', bg: 'bg-gray-800/90 text-white backdrop-blur-md shadow-gray-400', text: '' },
};

export const getTagStyle = (rawTag: string): TagStyle => {
  const tag = (rawTag || '').trim().toLowerCase();
  return TAG_CONFIG[tag] || TAG_CONFIG.default;
};
