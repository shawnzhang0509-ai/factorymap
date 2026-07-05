"""Forward geocoding with random 2–3 km privacy offset for map pins."""

from __future__ import annotations

import math
import random

import requests

NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
USER_AGENT = 'MBTISocialMap/1.0 (https://factorymap.online; profile geocoding)'


def _offset_lat_lng(lat: float, lng: float, distance_km: float, bearing_rad: float) -> tuple[float, float]:
    """Move a WGS-84 point by distance_km along bearing_rad (radians)."""
    earth_km = 6371.0
    lat1 = math.radians(lat)
    lng1 = math.radians(lng)
    angular = distance_km / earth_km
    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular)
        + math.cos(lat1) * math.sin(angular) * math.cos(bearing_rad)
    )
    lng2 = lng1 + math.atan2(
        math.sin(bearing_rad) * math.sin(angular) * math.cos(lat1),
        math.cos(angular) - math.sin(lat1) * math.sin(lat2),
    )
    return round(math.degrees(lat2), 6), round(math.degrees(lng2), 6)


def geocode_address_with_privacy_offset(address: str) -> dict:
    """
    Resolve a free-text address in China, then apply a random 2–3 km offset
    so the public map pin does not reveal the exact location.
    """
    raw = (address or '').strip()
    if len(raw) < 2:
        raise ValueError('地址太短，请填写城市与区县')

    query = raw if ('中国' in raw or 'China' in raw) else f'{raw}, 中国'

    resp = requests.get(
        NOMINATIM_URL,
        params={
            'q': query,
            'format': 'json',
            'limit': 1,
            'countrycodes': 'cn',
        },
        headers={'User-Agent': USER_AGENT},
        timeout=12,
    )
    resp.raise_for_status()
    rows = resp.json()
    if not rows:
        raise ValueError('无法识别该地址，请写清楚城市与区县（如：上海市静安区）')

    lat = float(rows[0]['lat'])
    lng = float(rows[0]['lon'])
    offset_km = random.uniform(2.0, 3.0)
    bearing = random.uniform(0.0, 2.0 * math.pi)
    lat2, lng2 = _offset_lat_lng(lat, lng, offset_km, bearing)

    return {
        'lat': lat2,
        'lng': lng2,
        'approximate': True,
        'offset_km': round(offset_km, 2),
        'display_name': rows[0].get('display_name', ''),
    }
