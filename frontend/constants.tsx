// App-wide constants (map center, tag visuals)

/** Default map center — China (approx. geographic midpoint for overview). */
export const CHINA_CENTER = { lat: 32.0, lng: 105.0 };

/** @deprecated Use CHINA_CENTER */
export const NZ_CENTER = CHINA_CENTER;

export type TagStyle = { icon: string; bg: string; text?: string };

export const TAG_CONFIG: Record<string, TagStyle> = {
  'industry-leader': {
    icon: '🏭',
    bg: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-amber-200',
    text: 'Industry Leader',
  },
  'export-experience': {
    icon: '🌏',
    bg: 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-sky-200',
    text: 'Export Experience',
  },
  'iso-9001': {
    icon: '✓',
    bg: 'bg-gradient-to-r from-slate-600 to-slate-800 text-white shadow-slate-300',
    text: 'ISO 9001',
  },
  'oem-odm': {
    icon: '⚙️',
    bg: 'bg-gradient-to-r from-violet-500 to-purple-700 text-white shadow-violet-200',
    text: 'OEM/ODM',
  },
  'trade-assurance': {
    icon: '🛡️',
    bg: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-200',
    text: 'Trade Assurance',
  },
  'fast-turnaround': {
    icon: '⚡',
    bg: 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-rose-200',
    text: 'Fast Turnaround',
  },
  default: { icon: '📋', bg: 'bg-gray-800/90 text-white backdrop-blur-md shadow-gray-400', text: '' },
};

export const getTagStyle = (rawTag: string): TagStyle => {
  const tag = (rawTag || '').trim().toLowerCase();
  return TAG_CONFIG[tag] || TAG_CONFIG.default;
};
