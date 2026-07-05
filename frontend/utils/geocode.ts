import { getApiBaseUrl } from '../config/api';

export type GeocodeResult = {
  lat: number;
  lng: number;
  approximate: boolean;
  offset_km: number;
  display_name?: string;
};

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
