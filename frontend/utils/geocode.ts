import { getApiBaseUrl } from '../config/api';

export type GeocodeResult = {
  lat: number;
  lng: number;
  approximate: boolean;
  offset_km: number;
  display_name?: string;
};

/** Random 2–3 km offset in WGS-84 (privacy for map pins). */
export function applyPrivacyOffset(lat: number, lng: number): GeocodeResult {
  const offset_km = 2 + Math.random();
  const bearing = Math.random() * 2 * Math.PI;
  const earthKm = 6371;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const angular = offset_km / earthKm;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
    );
  return {
    lat: Math.round((lat2 * 180) / Math.PI * 1e6) / 1e6,
    lng: Math.round((lng2 * 180) / Math.PI * 1e6) / 1e6,
    approximate: true,
    offset_km: Math.round(offset_km * 100) / 100,
  };
}

/** Use device GPS, then apply privacy offset — works without backend. */
export function geolocateWithPrivacyOffset(): Promise<GeocodeResult> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('你的浏览器不支持定位'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve(applyPrivacyOffset(pos.coords.latitude, pos.coords.longitude));
      },
      (err) => {
        if (err.code === 1) reject(new Error('你已拒绝定位权限，请在浏览器设置中开启'));
        else if (err.code === 2) reject(new Error('无法获取位置，请检查 GPS 或网络'));
        else if (err.code === 3) reject(new Error('定位超时，请重试'));
        else reject(new Error('定位失败'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

/** Optional: resolve typed address via backend (needs /shop/geocode deployed). */
export async function geocodeAddressWithOffset(address: string): Promise<GeocodeResult> {
  const q = address.trim();
  if (q.length < 2) {
    throw new Error('地址太短');
  }
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/shop/geocode?address=${encodeURIComponent(q)}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '地理编码失败');
  }
  return {
    lat: data.lat,
    lng: data.lng,
    approximate: !!data.approximate,
    offset_km: data.offset_km,
    display_name: data.display_name,
  };
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(6)} ${lng.toFixed(6)}`;
}
