/**
 * 社交地图区域筛选 — 存入后端 `filter_city`（区域名或城市名均可，前端会推断）。
 */

import type { UserLocation } from '../types';

export type SocialRegionKey =
  | 'all'
  | 'jingjinji'
  | 'changsanjiao'
  | 'zhusanjiao'
  | 'chuanyu'
  | 'other';

export interface SocialRegion {
  key: SocialRegionKey;
  label: string;
  center: UserLocation;
  zoom: number;
  /** 城市/省份关键词，用于匹配 filter_city、address */
  cityKeywords: readonly string[];
  bounds?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

export const DEFAULT_REGION_STORAGE_KEY = 'mbti_social_default_region_v1';

export const SOCIAL_REGIONS: readonly SocialRegion[] = [
  {
    key: 'all',
    label: '全国',
    center: { lat: 32.0, lng: 105.0 },
    zoom: 5.5,
    cityKeywords: [],
  },
  {
    key: 'jingjinji',
    label: '京津冀',
    center: { lat: 39.55, lng: 116.4 },
    zoom: 8,
    cityKeywords: ['北京', '天津', '石家庄', '保定', '唐山', '廊坊', '张家口', '承德', '秦皇岛', '邯郸', '雄安', '京津冀'],
    bounds: { minLat: 36.0, maxLat: 42.5, minLng: 113.5, maxLng: 120.0 },
  },
  {
    key: 'changsanjiao',
    label: '长三角',
    center: { lat: 31.2, lng: 121.0 },
    zoom: 7.5,
    cityKeywords: ['上海', '杭州', '南京', '苏州', '宁波', '无锡', '合肥', '嘉兴', '绍兴', '常州', '南通', '长三角', '江浙沪'],
    bounds: { minLat: 28.5, maxLat: 33.5, minLng: 118.0, maxLng: 123.0 },
  },
  {
    key: 'zhusanjiao',
    label: '珠三角',
    center: { lat: 22.8, lng: 113.5 },
    zoom: 8,
    cityKeywords: ['广州', '深圳', '东莞', '佛山', '珠海', '惠州', '中山', '江门', '肇庆', '珠三角', '粤港澳'],
    bounds: { minLat: 21.5, maxLat: 24.5, minLng: 111.5, maxLng: 115.5 },
  },
  {
    key: 'chuanyu',
    label: '川渝',
    center: { lat: 30.6, lng: 104.1 },
    zoom: 7,
    cityKeywords: ['成都', '重庆', '绵阳', '德阳', '宜宾', '川渝', '四川', '巴蜀'],
    bounds: { minLat: 28.0, maxLat: 32.5, minLng: 102.5, maxLng: 108.5 },
  },
  {
    key: 'other',
    label: '其他',
    center: { lat: 32.0, lng: 105.0 },
    zoom: 5.5,
    cityKeywords: [],
  },
] as const;

const REGION_BY_KEY = Object.fromEntries(
  SOCIAL_REGIONS.map((r) => [r.key, r])
) as Record<SocialRegionKey, SocialRegion>;

export function isSocialRegionKey(value: string): value is SocialRegionKey {
  return value in REGION_BY_KEY;
}

export function getRegionByKey(key: SocialRegionKey): SocialRegion {
  return REGION_BY_KEY[key] ?? REGION_BY_KEY.all;
}

export function loadStoredDefaultRegion(): SocialRegionKey {
  if (typeof window === 'undefined') return 'all';
  try {
    const saved = localStorage.getItem(DEFAULT_REGION_STORAGE_KEY);
    if (saved && isSocialRegionKey(saved)) return saved;
  } catch {
    /* ignore */
  }
  return 'all';
}

export function saveDefaultRegion(key: SocialRegionKey): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEFAULT_REGION_STORAGE_KEY, key);
  } catch {
    /* ignore */
  }
}

/** 根据城市名、区域标签或坐标推断资料所属区域 */
export function inferShopRegion(shop: {
  filter_city?: string | null;
  address?: string | null;
  lat: number;
  lng: number;
}): SocialRegionKey {
  const hay = `${shop.filter_city || ''} ${shop.address || ''}`.trim();
  if (hay) {
    for (const region of SOCIAL_REGIONS) {
      if (region.key === 'all' || region.key === 'other') continue;
      if (hay.includes(region.label)) return region.key;
      if (region.cityKeywords.some((kw) => hay.includes(kw))) return region.key;
    }
  }
  const { lat, lng } = shop;
  for (const region of SOCIAL_REGIONS) {
    if (!region.bounds || region.key === 'other') continue;
    const b = region.bounds;
    if (lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng) {
      return region.key;
    }
  }
  return 'other';
}

export function shopMatchesRegion(
  shop: { filter_city?: string | null; address?: string | null; lat: number; lng: number },
  regionKey: SocialRegionKey
): boolean {
  if (regionKey === 'all') return true;
  return inferShopRegion(shop) === regionKey;
}

/** @deprecated legacy factory import */
export const CHINA_ECONOMIC_ZONES = SOCIAL_REGIONS.filter(
  (r) => r.key !== 'all' && r.key !== 'other'
).map((r) => r.label);

export const SELECTABLE_REGIONS = SOCIAL_REGIONS.filter(
  (r) => r.key !== 'all'
) as readonly SocialRegion[];
