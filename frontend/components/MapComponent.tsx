import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Shop, UserLocation } from '../types';

// ✅ 1. 接口增加 zoom 属性
interface MapComponentProps {
  shops: Shop[];
  center: UserLocation;
  zoom?: number; // 新增：接收缩放级别
  selectedShop: Shop | null;
  onMarkerClick: (shop: Shop) => void;
  userLocation: UserLocation | null;
  radiusKm?: number;
  /** Bump when the parent wants the map to pan/zoom to selectedShop (skip for ShopCard-only selection while anchor is SHOP) */
  mapPanNonce?: number;
}

// ... (createShopIcon 函数保持不变) ...
const createShopIcon = (shop: Shop, isSelected: boolean): L.DivIcon => {
  const iconDiv = document.createElement('div');
  iconDiv.className = 'custom-div-icon';
  iconDiv.style.width = '32px';
  iconDiv.style.height = '32px';
  iconDiv.style.display = 'flex';
  iconDiv.style.alignItems = 'center';
  iconDiv.style.justifyContent = 'center';
  iconDiv.style.position = 'relative';

  const circle = document.createElement('div');
  circle.style.width = '32px';
  circle.style.height = '32px';
  circle.style.borderRadius = '50%';
  circle.style.border = '2px solid white';
  circle.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
  circle.style.overflow = 'hidden';
  circle.style.backgroundColor = isSelected ? '#e11d48' : '#f43f5e';
  if (isSelected) {
    circle.style.transform = 'scale(1.25)';
    circle.style.transition = 'transform 0.2s ease';
  }

  const getRawPictureUrl = (pic: any): string | null => {
    if (!pic) return null;
    if (typeof pic === 'string') return pic;
    if (typeof pic === 'object' && typeof pic.url === 'string') return pic.url;
    return null;
  };

  const rawUrl = getRawPictureUrl(shop.pictures?.[0]);
  
  let finalImageUrl: string | null = null;

  if (rawUrl) {
    if (rawUrl.startsWith('http')) {
      finalImageUrl = rawUrl;
    } else {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000';
      const cleanPath = rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl;
      finalImageUrl = `${baseUrl}/uploads/${cleanPath}`;
    }
  }

  if (finalImageUrl) {
    const img = document.createElement('img');
    img.src = finalImageUrl;
    img.alt = shop.name || 'SPA';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.objectPosition = 'top';
    
    img.onerror = () => {
      if (img.parentNode) {
        img.remove();
      }
      if (!circle.querySelector('span')) {
        const span = document.createElement('span');
        span.textContent = 'SPA';
        span.style.color = 'white';
        span.style.fontSize = '10px';
        span.style.fontWeight = 'bold';
        span.style.display = 'flex';
        span.style.alignItems = 'center';
        span.style.justifyContent = 'center';
        span.style.height = '100%';
        circle.appendChild(span);
      }
    };
    circle.appendChild(img);
  } else {
    if (!circle.querySelector('span')) {
      const span = document.createElement('span');
      span.textContent = 'SPA';
      span.style.color = 'white';
      span.style.fontSize = '10px';
      span.style.fontWeight = 'bold';
      span.style.display = 'flex';
      span.style.alignItems = 'center';
      span.style.justifyContent = 'center';
      span.style.height = '100%';
      circle.appendChild(span);
    }
  }

  iconDiv.appendChild(circle);

  if (isSelected) {
    const triangle = document.createElement('div');
    triangle.style.position = 'absolute';
    triangle.style.bottom = '-4px';
    triangle.style.left = '50%';
    triangle.style.transform = 'translateX(-50%) rotate(45deg)';
    triangle.style.width = '8px';
    triangle.style.height = '8px';
    triangle.style.backgroundColor = '#e11d48';
    triangle.style.zIndex = '10';
    iconDiv.appendChild(triangle);
  }

  return L.divIcon({
    html: iconDiv,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    className: '',
  });
};

// ✅ 2. 组件签名接收 zoom
const MapComponent: React.FC<MapComponentProps> = ({ 
  shops, 
  center, 
  zoom = 5.5, // ✅ 接收 zoom，默认 5.5
  selectedShop, 
  onMarkerClick,
  userLocation,
  radiusKm = 0,
  mapPanNonce = 0,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const rangeCircleRef = useRef<L.Circle | null>(null);

  // 初始化地图
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // ✅ 3. 初始化时使用传入的 zoom
    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([center.lat, center.lng], zoom);

    const el = mapRef.current.getContainer();
    el.style.background = 'transparent';

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(mapRef.current);

    requestAnimationFrame(() => {
      mapRef.current?.invalidateSize({ animate: false });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []); // 只在挂载时运行一次

  // ✅ 4. 【核心修复】同时监听 center 和 zoom，并应用两者
  useEffect(() => {
    if (mapRef.current) {
      // 使用 setView 同时更新位置和缩放级别
      mapRef.current.setView([center.lat, center.lng], zoom);
      
      // 如果想要平滑动画，可以改用下面这行（取消注释即可）：
      // mapRef.current.flyTo([center.lat, center.lng], zoom, { duration: 1.0 });
    }
  }, [center, zoom]); // 👈 依赖项必须包含 zoom

  // 处理圆圈 (Range Circle)
  useEffect(() => {
    if (!mapRef.current) return;

    if (rangeCircleRef.current) {
      mapRef.current.removeLayer(rangeCircleRef.current);
      rangeCircleRef.current = null;
    }

    if (radiusKm > 0 && userLocation) {
      const circle = L.circle([userLocation.lat, userLocation.lng], {
        radius: radiusKm * 1000,
        color: '#f43f5e',
        fillColor: '#f43f5e',
        fillOpacity: 0.15,
        weight: 1
      }).addTo(mapRef.current);
      
      circle.bringToBack();
      rangeCircleRef.current = circle;
    }
  }, [radiusKm, userLocation]);

  // 处理标记 (Markers)
  useEffect(() => {
    if (!mapRef.current) return;

    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    shops.forEach(shop => {
      const key = shop.id ? String(shop.id) : `${shop.name}-${shop.lat}`;
      const isSelected = selectedShop?.id === shop.id || (selectedShop?.name === shop.name && selectedShop?.lat === shop.lat);
      
      const icon = createShopIcon(shop, isSelected);

      const marker = L.marker([shop.lat, shop.lng], { icon })
        .addTo(mapRef.current!)
        .on('click', () => onMarkerClick(shop));

      markersRef.current[key] = marker;
    });

    if (userLocation && mapRef.current) {
      const userIcon = L.divIcon({
        className: 'user-icon',
        html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md animate-pulse"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(mapRef.current);
    }
  }, [shops, selectedShop, userLocation]);

  // Pan/zoom to selection only when parent bumps mapPanNonce (fast fly; ShopCard in SHOP-anchor mode skips bump)
  useEffect(() => {
    if (!selectedShop || !mapRef.current || mapPanNonce === 0) return;
    const map = mapRef.current;

    const safeFlyTo = (lat: number, lng: number, z: number) => {
      try {
        map.flyTo([lat, lng], z, { duration: 0.35, easeLinearity: 0.5 });
      } catch {
        try {
          map.setView([lat, lng], z);
        } catch {
          /* ignore */
        }
      }
    };

    const latOk = (v: number) => Number.isFinite(v) && Math.abs(v) <= 90;
    const lngOk = (v: number) => Number.isFinite(v) && Math.abs(v) <= 180;
    const rk = Number(radiusKm);
    const canFitRing =
      rk > 0 &&
      userLocation &&
      latOk(userLocation.lat) &&
      lngOk(userLocation.lng);

    const run = () => {
      if (!mapRef.current) return;
      const m = mapRef.current;

      if (canFitRing && userLocation) {
        try {
          const ring = L.circle([userLocation.lat, userLocation.lng], {
            radius: rk * 1000,
          });
          const bounds = ring.getBounds();
          if (!bounds.isValid()) {
            safeFlyTo(selectedShop.lat, selectedShop.lng, 11);
            return;
          }
          m.flyToBounds(bounds, {
            padding: L.point(48, 48),
            maxZoom: 11.75,
            duration: 0.35,
          });
        } catch {
          safeFlyTo(selectedShop.lat, selectedShop.lng, 11);
        }
        return;
      }

      if (latOk(selectedShop.lat) && lngOk(selectedShop.lng)) {
        safeFlyTo(selectedShop.lat, selectedShop.lng, 11);
      }
    };

    requestAnimationFrame(run);
  }, [selectedShop, mapPanNonce, radiusKm, userLocation]);

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full overflow-hidden bg-transparent"
      style={{ 
        maxWidth: '100%',
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative', 
        zIndex: 0,
        background: 'transparent',
      }} 
    />
  );
};

export default MapComponent;