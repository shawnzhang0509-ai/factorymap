/**
 * China manufacturing economic zones — stored in backend `filter_city` (must match exactly).
 */
export const CHINA_ECONOMIC_ZONES = [
  'Yangtze River Delta',
  'Pearl River Delta',
  'Bohai Economic Rim',
  'Central & Western China',
] as const;

/** Map filter chips: first entry clears regional restriction. */
export const REGION_FILTER_OPTIONS = ['All China', ...CHINA_ECONOMIC_ZONES] as const;

export type ChinaEconomicZone = (typeof CHINA_ECONOMIC_ZONES)[number];
export type RegionFilterOption = (typeof REGION_FILTER_OPTIONS)[number];

/** @deprecated Use REGION_FILTER_OPTIONS — kept for imports expecting REGION_OPTIONS */
export const REGION_OPTIONS = REGION_FILTER_OPTIONS;

export type RegionOption = RegionFilterOption;

export function normalizeRegionLabel(raw: string | null | undefined): string {
  return (raw || '').trim();
}
