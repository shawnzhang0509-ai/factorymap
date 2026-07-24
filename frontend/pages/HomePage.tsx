import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AgeVerificationModal from '../components/AgeVerificationModal';
import { REGION_FILTER_OPTIONS } from '../constants/filterRegions';
import MapComponent from '../components/MapComponent';
import ShopCard from '../components/ShopCard';
import AdminPanel from '../components/AdminPanel';
import { Shop, UserLocation } from '../types';
import { CHINA_CENTER } from '../constants';
import { calculateDistance } from '../utils';
import LoginPanel from '../components/LoginPanel';
import ImagePreviewModal from '../components/ImagePreviewPanel';
import { Plus, Navigation, Filter, Share2, Search, ChevronUp, ChevronDown, MapPin } from 'lucide-react';
import BadgeFilterDropdown from '../components/BadgeFilterDropdown';
import MinSpendFilterDropdown from '../components/MinSpendFilterDropdown';
import { parseMinSpend } from '../constants/minSpend';
import { credentialIdsFromBadgeText, FACTORY_CREDENTIAL_IDS } from '../constants/factoryCredentials';
import type { MoqFilterKey } from '../constants/moqTiers';
import { shopPassesMoqFilter } from '../constants/moqTiers';
import { getApiBaseUrl } from '../config/api';

const STORAGE_KEY = 'china_factory_map_v2';
const LEGACY_STORAGE_KEY = 'nz_massage_shops_v1';
const SHARE_TOOLTIP_SEEN_KEY = 'china_factory_share_tip_v1';
/** Session only: show location FAB hint again on new visit / new tab */
const LOCATION_FAB_TIP_DISMISSED_KEY = 'china_factory_loc_tip_session';
const TERMS_ACCEPTED_KEY = 'china_factory_map_terms_v1';
const LEGACY_TERMS_KEY = 'age_verified';
const API_BASE_URL = getApiBaseUrl();

/** Align list payload with UI: picture URLs, MOQ tier, main product */
function normalizeShopFromApi(shop: any, apiBase: string): Shop {
  const pictures =
    shop.pictures?.map((pic: any) => ({
      ...pic,
      url: pic.url && pic.url.startsWith('/files/') ? `${apiBase}${pic.url}` : pic.url,
    })) || [];
  const rawBadge = shop.badge_text;
  const badge_text =
    rawBadge != null && String(rawBadge).trim() !== '' ? String(rawBadge).trim() : '';
  const minSpend = parseMinSpend(shop.min_spend);
  return {
    ...shop,
    pictures,
    badge_text,
    filter_city: shop.filter_city || '',
    min_spend: minSpend ?? undefined,
    main_product: shop.main_product || '',
  };
}

function loadShopsFromStorage(apiBase: string): Shop[] {
  if (typeof window === 'undefined') return [];
  const keys = [STORAGE_KEY, LEGACY_STORAGE_KEY];
  for (const key of keys) {
    const saved = localStorage.getItem(key);
    if (!saved) continue;
    try {
      const parsed = JSON.parse(saved) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) continue;
      const shops = parsed.map((s) => normalizeShopFromApi(s, apiBase));
      if (key === LEGACY_STORAGE_KEY) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(shops));
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
          /* ignore */
        }
      }
      return shops;
    } catch {
      /* try next key */
    }
  }
  return [];
}

/** Keep collapsed strip low so map stays large; affordance is the FAB + safe-area anchoring */
const COLLAPSED_HEIGHT = 84;
const EXPANDED_HEIGHT = 380;
const CLICK_THRESHOLD = 5; 
const AUTO_SCROLL_SPEED = 0.8; 
const RESUME_DELAY = 2500; 

export type NearbyCenterType = 'USER' | 'SHOP';

function buildNearbyRangeTitle(
  centerType: NearbyCenterType,
  centerName: string,
  radiusKm: number
): string {
  const xx = radiusKm;
  if (centerType === 'USER') {
    return `Factories near you within ${xx}km`;
  }
  const name = (centerName || 'this supplier').trim();
  return `Factories surrounding ${name} within ${xx}km`;
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [shops, setShops] = useState<Shop[]>(() => loadShopsFromStorage(API_BASE_URL));
  const [shopsLoadStatus, setShopsLoadStatus] = useState<'loading' | 'ready' | 'error' | 'empty'>(() => {
    if (typeof window === 'undefined') return 'loading';
    return loadShopsFromStorage(API_BASE_URL).length > 0 ? 'ready' : 'loading';
  });
  /** Whether the current list came from the server or local cache only */
  const [shopsDataSource, setShopsDataSource] = useState<'server' | 'cache' | 'cache-stale'>(() => {
    if (typeof window === 'undefined') return 'server';
    return loadShopsFromStorage(API_BASE_URL).length > 0 ? 'cache' : 'server';
  });

  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [zoom, setZoom] = useState<number>(5.5); 
  const [center, setCenter] = useState<UserLocation>(CHINA_CENTER);
  

  // ✅ 新增：年龄验证状态
  const [isAgeVerified, setIsAgeVerified] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem(TERMS_ACCEPTED_KEY) === 'true' ||
        localStorage.getItem(LEGACY_TERMS_KEY) === 'true'
      );
    }
    return false;
  });
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [showShareTooltip, setShowShareTooltip] = useState(false);
  const [showLocationFabTip, setShowLocationFabTip] = useState(false);

  const dismissLocationFabTip = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      sessionStorage.setItem(LOCATION_FAB_TIP_DISMISSED_KEY, '1');
    } catch {
      /* ignore */
    }
    setShowLocationFabTip(false);
  };

  const dismissShareTooltip = () => {
    try {
      localStorage.setItem(SHARE_TOOLTIP_SEEN_KEY, 'true');
    } catch {
      /* ignore */
    }
    setShowShareTooltip(false);
  };

  const [showCreateAd, setShowCreateAd] = useState(false);
  const [useNearbyFilter, setUseNearbyFilter] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10);
  /** What the distance filter is centered on (GPS vs a shop as anchor) */
  const [nearbyCenterType, setNearbyCenterType] = useState<NearbyCenterType>('USER');
  const [nearbyCenterName, setNearbyCenterName] = useState('');
  const [nearbyCenterShopId, setNearbyCenterShopId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  
  const [isLoggedIn, setIsLoggedIn] = useState(() => typeof window !== 'undefined' && localStorage.getItem("admin_logged_in") === "true");
  const [username, setUsername] = useState<string | null>(() => typeof window !== 'undefined' ? localStorage.getItem('admin_username') : null);
  const [isAdmin, setIsAdmin] = useState(() => typeof window !== 'undefined' && localStorage.getItem('is_admin') === 'true');
  const [isAdManager, setIsAdManager] = useState(() => typeof window !== 'undefined' && localStorage.getItem('is_ad_manager') === 'true');
  const canManageAllAds = isAdmin || isAdManager;

  const [previewShop, setPreviewShop] = useState<Shop | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  /** Map region filter (OR); empty = all. "All China" in selection disables regional restriction. */
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  /** MOQ / trade capacity filter */
  const [moqFilter, setMoqFilter] = useState<MoqFilterKey | null>(null);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearchKeyword, setAppliedSearchKeyword] = useState('');
  /** FAB + dropdown — treat as one control so second FAB click confirms, not “outside” */
  const searchControlRef = useRef<HTMLDivElement>(null);
  const [pendingEditShopId, setPendingEditShopId] = useState<number | null>(null);
  const handledAutoEditKeyRef = useRef<string | null>(null);
  /** Any ShopCard edit modal is open — block drawer + horizontal list touch handlers */
  const [shopCardEditOpen, setShopCardEditOpen] = useState(false);
  /** Increment when the map should pan/zoom to the current selectedShop (not on ShopCard tap while anchor is SHOP) */
  const [mapPanNonce, setMapPanNonce] = useState(0);

  const [drawerHeight, setDrawerHeight] = useState(COLLAPSED_HEIGHT);
  const isExpanded = drawerHeight > COLLAPSED_HEIGHT + 50;
  /** Live height during drawer drag (state updates async; end handler needs this) */
  const drawerHeightRef = useRef(COLLAPSED_HEIGHT);
  useEffect(() => {
    drawerHeightRef.current = drawerHeight;
  }, [drawerHeight]);

  // 1. 原有的 URL 处理逻辑 (保持不变)
  useEffect(() => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const focusId = searchParams.get('focus');
    const shouldAutoEdit = searchParams.get('edit') === '1';
    const autoEditKey = shouldAutoEdit && focusId ? focusId : null;
    
    if (lat && lng) {
      setUserLocation({ lat: parseFloat(lat), lng: parseFloat(lng) });
      setUseNearbyFilter(true);

      if (focusId) {
        const target = shops.find(
          (s) => s.id.toString() === focusId || s.id === parseInt(focusId, 10)
        );
        if (target) {
          setSelectedShop(target);
          setNearbyCenterType('SHOP');
          setNearbyCenterName(target.name || '');
          setNearbyCenterShopId(target.id);
          setMapPanNonce((n) => n + 1);
          setTimeout(() => setDrawerHeight(EXPANDED_HEIGHT), 100);
          if (autoEditKey && handledAutoEditKeyRef.current !== autoEditKey) {
            setPendingEditShopId(target.id);
            handledAutoEditKeyRef.current = autoEditKey;
          }
        }
      } else {
        setNearbyCenterType('USER');
        setNearbyCenterName('');
        setNearbyCenterShopId(null);
      }
    } else if (focusId) {
      // My Ads "Edit" uses /?focus=<id>&edit=1 without lat/lng — still open card + edit modal
      const target = shops.find(
        (s) => s.id.toString() === focusId || s.id === parseInt(focusId, 10)
      );
      if (target) {
        setSelectedShop(target);
        setMapPanNonce((n) => n + 1);
        setTimeout(() => setDrawerHeight(EXPANDED_HEIGHT), 100);
        if (autoEditKey && handledAutoEditKeyRef.current !== autoEditKey) {
          setPendingEditShopId(target.id);
          handledAutoEditKeyRef.current = autoEditKey;
        }
      }
    }
    if (!autoEditKey) {
      handledAutoEditKeyRef.current = null;
    }
  }, [searchParams, shops]);

  // 2. ✅ 新增：检查年龄验证 (独立的 useEffect)
  useEffect(() => {
    if (!isAgeVerified) {
      const timer = setTimeout(() => setShowAgeModal(true), 300);
      return () => clearTimeout(timer);
    }
  }, [isAgeVerified]);

  // First visit after age gate: show share hint once
  useEffect(() => {
    if (!isAgeVerified || showAgeModal) return;
    try {
      if (localStorage.getItem(SHARE_TOOLTIP_SEEN_KEY) === 'true') return;
    } catch {
      return;
    }
    setShowShareTooltip(true);
  }, [isAgeVerified, showAgeModal]);

  // Location FAB: hint each session until user taps the bubble (sessionStorage — new visit shows again)
  useEffect(() => {
    if (!isAgeVerified || showAgeModal) return;
    try {
      if (sessionStorage.getItem(LOCATION_FAB_TIP_DISMISSED_KEY) === '1') return;
    } catch {
      return;
    }
    setShowLocationFabTip(true);
  }, [isAgeVerified, showAgeModal]);

  // 3. ✅ 新增：处理确认函数 (独立函数)
  const handleAgeConfirm = () => {
    localStorage.setItem(TERMS_ACCEPTED_KEY, 'true');
    setIsAgeVerified(true);
    setShowAgeModal(false);
  };

  // 4. ✅ 新增：处理拒绝函数 (独立函数)
  const handleAgeReject = () => {
    window.location.href = 'https://www.google.com';
  };

  const getShopTags = (shop: Shop): string[] => credentialIdsFromBadgeText(shop.badge_text);

  const allTags = FACTORY_CREDENTIAL_IDS;

  const existingShopNamesLower = useMemo(
    () => shops.map((s) => (s.name || '').trim().toLowerCase()).filter(Boolean),
    [shops]
  );

  /** Below two region rows: badge + min. spend filters */
  const badgeBarTopClass = 'top-[calc(env(safe-area-inset-top,0px)+3.95rem)]';

  const nearbyRangeTitle = useMemo(
    () => buildNearbyRangeTitle(nearbyCenterType, nearbyCenterName, radiusKm),
    [nearbyCenterType, nearbyCenterName, radiusKm]
  );
  const nearbyCenterShop = useMemo(
    () => shops.find((shop) => shop.id === nearbyCenterShopId) || null,
    [nearbyCenterShopId, shops]
  );

  const filteredShops = useMemo(() => {
    let result = [...shops];
    // 1. 【核心】先执行距离过滤
    if (useNearbyFilter && userLocation) {
      result = result.filter(shop => {
        const dist = calculateDistance(userLocation, { lat: shop.lat, lng: shop.lng });
        return dist <= radiusKm;
      });
    }

    // 2. 执行标签过滤（多选：匹配任意一个）
    if (selectedTags.length > 0) {
      const targetTags = new Set(selectedTags);
      result = result.filter((shop) =>
        getShopTags(shop).some((tag) => targetTags.has(tag))
      );
    }

    if (selectedRegions.length > 0 && !selectedRegions.includes('All China')) {
      const regionSet = new Set(selectedRegions);
      result = result.filter((shop) => {
        const fc = (shop as Shop & { filter_city?: string }).filter_city?.trim();
        return fc && regionSet.has(fc);
      });
    }

    if (moqFilter != null) {
      result = result.filter((shop) =>
        shopPassesMoqFilter((shop as Shop & { min_spend?: number }).min_spend, moqFilter)
      );
    }

    // 3. ✅ 综合排序 (credentials > distance)
    const getPriority = (shop: Shop) => {
      const tags = getShopTags(shop);
      if (tags.includes('industry-leader')) return 3;
      if (tags.includes('trade-assurance')) return 2;
      if (tags.includes('export-experience')) return 1;
      return 0;
    };

    result.sort((a, b) => {
      const priorityA = getPriority(a);
      const priorityB = getPriority(b);

      // A. 先比优先级 (Diamond/VIP 排前面)
      if (priorityA !== priorityB) {
        return priorityB - priorityA; // 降序：3 -> 2 -> 0
      }

      // B. 优先级相同，再比距离 (近的排前面)
      if (userLocation) {
        const distA = calculateDistance(userLocation, { lat: a.lat, lng: a.lng });
        const distB = calculateDistance(userLocation, { lat: b.lat, lng: b.lng });
        return distA - distB; // 升序：近 -> 远
      }

      return 0;
    });

    // 4. 【修复】处理选中店铺的逻辑
    // 只有当 selectedShop 真的在过滤后的列表里，或者是为了高亮显示时才操作
    // 如果 selectedShop 超出了半径范围，且开启了附近过滤，我们暂时不强制把它加回来，以免误导用户
    if (selectedShop) {
      const isSelectedInList = result.some(s => s.id === selectedShop.id);
      
      // 只有在以下情况才把 selectedShop 置顶：
      // A. 它本来就在列表里 (在半径内) -> 只是调整顺序置顶
      // B. 没有开启附近过滤 (useNearbyFilter 为 false) -> 显示所有店，选中店置顶
      if (isSelectedInList || !useNearbyFilter) {
        const others = result.filter(s => s.id !== selectedShop.id);
        result = [selectedShop, ...others];
      } else {
        // 🔴 关键修复：如果开启了附近过滤，且选中的店不在范围内，就不强制显示它
        // 这样用户就能明确知道“这个店不在范围内”，而不是看到一个突兀的店出现在列表里
        console.log(`ℹ️ 选中的店铺 ${selectedShop.name} 超出 ${radiusKm}km 范围，已按规则隐藏。`);
      }
    }

    return result;
  }, [shops, useNearbyFilter, userLocation, radiusKm, selectedTags, selectedRegions, moqFilter, selectedShop]);

  // Scrolling Logic
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingList = useRef(false);
  const startX = useRef(0);
  const currentTranslateX = useRef(0); 
  const dragStartX = useRef(0); 
  const animationFrameId = useRef<number | null>(null);
  const resumeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedByUser = useRef(false);
  /** Coalesce list translate updates to one frame per tick (INP) */
  const listTranslateRafId = useRef<number | null>(null);
  /** At most one drawer height React commit per animation frame while dragging */
  const drawerHeightRafId = useRef<number | null>(null);

  const resetListToStart = () => {
    currentTranslateX.current = 0;
    if (scrollRef.current) {
      scrollRef.current.style.transform = 'translateX(0px)';
    }
  };

  const startAutoScroll = () => {
    if (animationFrameId.current || !isExpanded || isPausedByUser.current || selectedShop) return;
    const run = () => {
      const container = scrollRef.current;
      if (!container) {
        animationFrameId.current = requestAnimationFrame(run);
        return;
      }
      const cardWidth = 260 + 16;
      const len = filteredShops.length;
      if (len === 0) {
        animationFrameId.current = requestAnimationFrame(run);
        return;
      }
      const stripWidth = len * cardWidth;
      currentTranslateX.current -= AUTO_SCROLL_SPEED;
      while (currentTranslateX.current <= -stripWidth) {
        currentTranslateX.current += stripWidth;
      }
      container.style.transform = `translateX(${currentTranslateX.current}px)`;
      animationFrameId.current = requestAnimationFrame(run);
    };
    animationFrameId.current = requestAnimationFrame(run);
  };

  const stopAutoScroll = () => {
    if (animationFrameId.current) { cancelAnimationFrame(animationFrameId.current); animationFrameId.current = null; }
  };
  
  const scheduleResume = () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      if (!isDraggingList.current && isExpanded && !selectedShop) {
        isPausedByUser.current = false;
        startAutoScroll();
      }
    }, RESUME_DELAY);
  };

  useEffect(() => {
    stopAutoScroll();
    if (isExpanded && filteredShops.length > 0 && !selectedShop && !isPausedByUser.current) {
      const timer = setTimeout(() => startAutoScroll(), 500);
      return () => clearTimeout(timer);
    }
    return () => { stopAutoScroll(); if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current); };
  }, [isExpanded, filteredShops.length, selectedShop]);

  /** Single strip: keep translate in [-oneLoop, 0] after filter/list changes */
  useEffect(() => {
    const len = filteredShops.length;
    if (len === 0) return;
    const cardWidth = 260 + 16;
    const stripWidth = len * cardWidth;
    let x = currentTranslateX.current;
    while (x <= -stripWidth) x += stripWidth;
    while (x > 0) x -= stripWidth;
    currentTranslateX.current = x;
    const el = scrollRef.current;
    if (el) el.style.transform = `translateX(${x}px)`;
  }, [filteredShops]);

  const handleListDragStart = (clientX: number) => {
    if (shopCardEditOpen) return;
    isDraggingList.current = true;
    isPausedByUser.current = true;
    startX.current = clientX;
    dragStartX.current = clientX;
    if (scrollRef.current) { scrollRef.current.style.cursor = 'grabbing'; scrollRef.current.style.transition = 'none'; }
    stopAutoScroll();
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    window.addEventListener('mousemove', handleListMouseMove);
    window.addEventListener('mouseup', handleListMouseUp);
    window.addEventListener('touchmove', handleListTouchMove, { passive: false }); 
    window.addEventListener('touchend', handleListMouseUp);
  };
  const flushListTranslate = () => {
    listTranslateRafId.current = null;
    const el = scrollRef.current;
    if (el) el.style.transform = `translateX(${currentTranslateX.current}px)`;
  };
  const handleListMouseMove = (e: MouseEvent) => {
    if (!isDraggingList.current || !scrollRef.current) return;
    const walk = e.clientX - startX.current;
    currentTranslateX.current += walk;
    startX.current = e.clientX;
    if (listTranslateRafId.current == null) {
      listTranslateRafId.current = requestAnimationFrame(flushListTranslate);
    }
  };
  const handleListTouchMove = (e: TouchEvent) => {
    if (!isDraggingList.current || !scrollRef.current) return;
    const walk = e.touches[0].clientX - startX.current;
    currentTranslateX.current += walk;
    startX.current = e.touches[0].clientX;
    if (listTranslateRafId.current == null) {
      listTranslateRafId.current = requestAnimationFrame(flushListTranslate);
    }
  };
  const handleListMouseUp = () => {
    if (!isDraggingList.current) return;
    isDraggingList.current = false;
    if (listTranslateRafId.current != null) {
      cancelAnimationFrame(listTranslateRafId.current);
      listTranslateRafId.current = null;
      flushListTranslate();
    }
    if (scrollRef.current) { scrollRef.current.style.cursor = 'grab'; scrollRef.current.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'; }
    window.removeEventListener('mousemove', handleListMouseMove);
    window.removeEventListener('mouseup', handleListMouseUp);
    window.removeEventListener('touchmove', handleListTouchMove);
    window.removeEventListener('touchend', handleListMouseUp);
    scheduleResume();
  };

  useEffect(() => {
    if (!shopCardEditOpen) return;
    stopAutoScroll();
    if (isDraggingList.current) handleListMouseUp();
    isDraggingDrawer.current = false;
  }, [shopCardEditOpen]);

  // Two-Step Click Logic
  const handleCardClick = (shop: Shop, currentEventClientX: number) => {
    const distance = Math.abs(currentEventClientX - dragStartX.current);
    if (distance > CLICK_THRESHOLD) return;

    if (selectedShop && selectedShop.id === shop.id) {
      const slug = shop.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      navigate(`/shop/${slug}`);
      return;
    }

    const anchorIsShop = useNearbyFilter && nearbyCenterType === 'SHOP';
    stopAutoScroll();
    setSelectedShop(shop);
    if (!useNearbyFilter) {
      setUseNearbyFilter(true);
      setUserLocation({ lat: shop.lat, lng: shop.lng });
      setNearbyCenterType('SHOP');
      setNearbyCenterName(shop.name || '');
      setNearbyCenterShopId(shop.id);
      setRadiusKm(5);
      setMapPanNonce((n) => n + 1);
    } else if (!anchorIsShop) {
      setMapPanNonce((n) => n + 1);
    }
    if (drawerHeightRef.current <= COLLAPSED_HEIGHT + 50) {
      drawerHeightRef.current = EXPANDED_HEIGHT;
      setDrawerHeight(EXPANDED_HEIGHT);
    }
  };

  const handleBackToNearbyCenterShop = (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.stopPropagation();
    if (!nearbyCenterShop) return;
    stopAutoScroll();
    setSelectedShop(nearbyCenterShop);
    setUserLocation({ lat: nearbyCenterShop.lat, lng: nearbyCenterShop.lng });
    setNearbyCenterType('SHOP');
    setNearbyCenterName(nearbyCenterShop.name || '');
    setNearbyCenterShopId(nearbyCenterShop.id);
    resetListToStart();
    setMapPanNonce((n) => n + 1);
    if (drawerHeightRef.current <= COLLAPSED_HEIGHT + 50) {
      drawerHeightRef.current = EXPANDED_HEIGHT;
      setDrawerHeight(EXPANDED_HEIGHT);
    }
  };

  const markerClickHandlerRef = useRef<(shop: Shop) => void>(() => {});
  markerClickHandlerRef.current = (shop: Shop) => {
    if (selectedShop && selectedShop.id === shop.id) {
      const slug = shop.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      navigate(`/shop/${slug}`);
      return;
    }
    stopAutoScroll();
    setSelectedShop(shop);
    if (!useNearbyFilter) {
      setUseNearbyFilter(true);
      setUserLocation({ lat: shop.lat, lng: shop.lng });
      setNearbyCenterType('SHOP');
      setNearbyCenterName(shop.name || '');
      setNearbyCenterShopId(shop.id);
    } else if (nearbyCenterType === 'SHOP') {
      setUserLocation({ lat: shop.lat, lng: shop.lng });
      setNearbyCenterName(shop.name || '');
      setNearbyCenterShopId(shop.id);
    }
    setMapPanNonce((n) => n + 1);
    if (drawerHeightRef.current <= COLLAPSED_HEIGHT + 50) {
      drawerHeightRef.current = EXPANDED_HEIGHT;
      setDrawerHeight(EXPANDED_HEIGHT);
    }
  };

  const handleMarkerClickStable = useCallback((shop: Shop) => {
    markerClickHandlerRef.current(shop);
  }, []);

  // Drawer Logic
  const drawerRef = useRef<HTMLDivElement>(null);
  const isDraggingDrawer = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const resolveDrawerSnap = (currentHeight: number) => {
    const range = EXPANDED_HEIGHT - COLLAPSED_HEIGHT;
    const snapUpThreshold = COLLAPSED_HEIGHT + range * 0.42;
    return currentHeight > snapUpThreshold ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;
  };

  const handleDrawerTouchStart = (e: React.TouchEvent) => {
    if (shopCardEditOpen) return;
    const el = e.target as HTMLElement;
    if (el.closest('button')) return;
    const onHandle = !!el.closest('.drawer-drag-handle');
    if (drawerHeightRef.current > COLLAPSED_HEIGHT + 50) {
      if (!onHandle) return;
    } else if (el.closest('.no-drag')) {
      return;
    }
    isDraggingDrawer.current = true;
    startY.current = e.touches[0].clientY;
    startHeight.current = drawerHeightRef.current;
    stopAutoScroll();
  };
  const flushDrawerHeight = () => {
    drawerHeightRafId.current = null;
    setDrawerHeight(drawerHeightRef.current);
  };

  const scheduleDrawerHeightCommit = () => {
    if (drawerHeightRafId.current != null) return;
    drawerHeightRafId.current = requestAnimationFrame(() => {
      drawerHeightRafId.current = null;
      flushDrawerHeight();
    });
  };

  const handleDrawerTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingDrawer.current) return;
    const deltaY = startY.current - e.touches[0].clientY;
    let newHeight = startHeight.current + deltaY;
    if (newHeight < COLLAPSED_HEIGHT) newHeight = COLLAPSED_HEIGHT;
    if (newHeight > EXPANDED_HEIGHT) newHeight = EXPANDED_HEIGHT;
    drawerHeightRef.current = newHeight;
    scheduleDrawerHeightCommit();
  };
  const handleDrawerTouchEnd = () => {
    if (!isDraggingDrawer.current) return;
    isDraggingDrawer.current = false;
    if (drawerHeightRafId.current != null) {
      cancelAnimationFrame(drawerHeightRafId.current);
      drawerHeightRafId.current = null;
    }
    const next = resolveDrawerSnap(drawerHeightRef.current);
    drawerHeightRef.current = next;
    setDrawerHeight(next);
    const willExpand = next === EXPANDED_HEIGHT;
    if (willExpand && !selectedShop) resumeTimerRef.current = setTimeout(() => { if (!isDraggingList.current) startAutoScroll(); }, 500);
    else stopAutoScroll();
  };
  const handleDrawerMouseDown = (e: React.MouseEvent) => {
    if (shopCardEditOpen) return;
    const el = e.target as HTMLElement;
    if (el.closest('button')) return;
    const onHandle = !!el.closest('.drawer-drag-handle');
    if (drawerHeightRef.current > COLLAPSED_HEIGHT + 50) {
      if (!onHandle) return;
    } else if (el.closest('.no-drag')) {
      return;
    }
    isDraggingDrawer.current = true;
    startY.current = e.clientY;
    startHeight.current = drawerHeightRef.current;
    stopAutoScroll();
    window.addEventListener('mousemove', handleDrawerMouseMove);
    window.addEventListener('mouseup', handleDrawerMouseUp);
  };
  const handleDrawerMouseMove = (e: MouseEvent) => {
    if (!isDraggingDrawer.current) return;
    const deltaY = startY.current - e.clientY;
    let newHeight = startHeight.current + deltaY;
    if (newHeight < COLLAPSED_HEIGHT) newHeight = COLLAPSED_HEIGHT;
    if (newHeight > EXPANDED_HEIGHT) newHeight = EXPANDED_HEIGHT;
    drawerHeightRef.current = newHeight;
    scheduleDrawerHeightCommit();
  };
  const handleDrawerMouseUp = () => {
    if (!isDraggingDrawer.current) return;
    isDraggingDrawer.current = false;
    if (drawerHeightRafId.current != null) {
      cancelAnimationFrame(drawerHeightRafId.current);
      drawerHeightRafId.current = null;
    }
    window.removeEventListener('mousemove', handleDrawerMouseMove);
    window.removeEventListener('mouseup', handleDrawerMouseUp);
    const next = resolveDrawerSnap(drawerHeightRef.current);
    drawerHeightRef.current = next;
    setDrawerHeight(next);
    const willExpand = next === EXPANDED_HEIGHT;
    if (willExpand && !selectedShop) resumeTimerRef.current = setTimeout(() => { if (!isDraggingList.current) startAutoScroll(); }, 500);
    else stopAutoScroll();
  };
  const toggleDrawer = () => {
    const willExpand = !isExpanded;
    setDrawerHeight(willExpand ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT);
    if (willExpand && !selectedShop) resumeTimerRef.current = setTimeout(() => { if (!isDraggingList.current) startAutoScroll(); }, 500);
    else stopAutoScroll();
  };

  // Business Logic
  const fetchShops = async (attempt = 1) => {
    const MAX_ATTEMPTS = 4;
    setShopsLoadStatus('loading');
    try {
      const token = localStorage.getItem('auth_token') || '';
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 45000);
      const response = await fetch(`${API_BASE_URL}/shops`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const fixedData = data.map((shop: any) => normalizeShopFromApi(shop, API_BASE_URL));
      if (fixedData.length > 0) {
        setShops(fixedData);
        setShopsLoadStatus('ready');
        setShopsDataSource('server');
      } else {
        const cached = loadShopsFromStorage(API_BASE_URL);
        if (cached.length > 0) {
          console.warn('API returned no factories — keeping cached listings');
          setShops(cached);
          setShopsLoadStatus('ready');
          setShopsDataSource('cache-stale');
        } else {
          setShops([]);
          setShopsLoadStatus('empty');
          setShopsDataSource('server');
        }
      }
    } catch (error) {
      console.error('❌ Load failed:', error);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 8000 * attempt));
        return fetchShops(attempt + 1);
      }
      const cached = loadShopsFromStorage(API_BASE_URL);
      if (cached.length > 0) {
        setShops(cached);
        setShopsLoadStatus('ready');
        setShopsDataSource('cache');
      } else {
        setShopsLoadStatus('error');
        setShopsDataSource('server');
      }
    }
  };

  const emptyListMessage = useMemo(() => {
    if (shops.length === 0) {
      if (shopsLoadStatus === 'loading') return 'Loading factories…';
      if (shopsLoadStatus === 'error') {
        return 'Cannot reach the server. Check your network, or wait for the backend to wake up, then tap Retry below.';
      }
      if (shopsLoadStatus === 'empty') {
        return 'No factories in the database yet. An admin can upload an Excel file from the + button.';
      }
    }
    if (useNearbyFilter && userLocation) {
      return `No factories within ${radiusKm}km of your location. Tap the green filter button (top right) to show all of China.`;
    }
    if (selectedTags.length > 0) return 'No factories match the selected credentials.';
    if (selectedRegions.length > 0 && !selectedRegions.includes('All China')) {
      return 'No factories in the selected regions.';
    }
    if (moqFilter != null) return 'No factories match the MOQ filter.';
    return 'No factories match the current filters.';
  }, [
    shops.length,
    shopsLoadStatus,
    useNearbyFilter,
    userLocation,
    radiusKm,
    selectedTags.length,
    selectedRegions,
    moqFilter,
  ]);

  const handleSearch = async (keyword: string) => {
    setIsSearching(true);
    try {
      let url = `${API_BASE_URL}/shop/shops`;
      if (keyword) url += `?keyword=${encodeURIComponent(keyword)}`;
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error('Network response was not ok');
      const raw = await res.json();
      const results = raw.map((shop: any) => normalizeShopFromApi(shop, API_BASE_URL));
      setShops(results.length > 0 ? results : loadShopsFromStorage(API_BASE_URL));
      setAppliedSearchKeyword(keyword.trim());
    } catch (err) { alert("Search failed"); } 
    finally { setIsSearching(false); }
  };

  const openSearchPanel = () => {
    setSearchDraft(appliedSearchKeyword);
    setSearchPanelOpen(true);
  };

  const cancelSearchPanel = () => {
    setSearchDraft(appliedSearchKeyword);
    setSearchPanelOpen(false);
  };

  const confirmSearchPanel = () => {
    const q = searchDraft.trim();
    void handleSearch(q);
    setSearchPanelOpen(false);
  };

  const handleSearchFabClick = () => {
    if (searchPanelOpen) {
      confirmSearchPanel();
    } else {
      openSearchPanel();
    }
  };

  useEffect(() => {
    if (!searchPanelOpen) return;
    const onDoc = (e: PointerEvent) => {
      const el = searchControlRef.current;
      if (el && !el.contains(e.target as Node)) {
        setSearchDraft(appliedSearchKeyword);
        setSearchPanelOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [searchPanelOpen, appliedSearchKeyword]);

  const toggleRegion = (r: string) => {
    setSelectedRegions((prev) => {
      if (r === 'All China') {
        return prev.includes('All China') ? [] : ['All China'];
      }
      const withoutAll = prev.filter((x) => x !== 'All China');
      if (withoutAll.includes(r)) return withoutAll.filter((x) => x !== r);
      return [...withoutAll, r];
    });
  };

  const handleLoginSuccess = (payload: { username: string; token: string; isAdmin: boolean; isAdManager: boolean }) => {
    const { username: u, token, isAdmin: adminFlag, isAdManager: managerFlag } = payload;
    setIsLoggedIn(true);
    setUsername(u);
    setIsAdmin(adminFlag);
    setIsAdManager(managerFlag);
    localStorage.setItem("admin_logged_in", "true");
    localStorage.setItem('admin_username', u);
    localStorage.setItem('auth_token', token || '');
    localStorage.setItem('is_admin', adminFlag ? 'true' : 'false');
    localStorage.setItem('is_ad_manager', managerFlag ? 'true' : 'false');
    window.dispatchEvent(new Event('auth_changed'));
  };
  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername(null);
    setIsAdmin(false);
    setIsAdManager(false);
    localStorage.removeItem("admin_logged_in");
    localStorage.removeItem('admin_username');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('is_admin');
    localStorage.removeItem('is_ad_manager');
    window.dispatchEvent(new Event('auth_changed'));
  };

  const handleShareMap = async () => {
    dismissShareTooltip();
    // Plain https link only (no hash) — WeChat/Android often mis-handle share({ title, text, url }) as a file
    let shareUrl = '';
    if (typeof window !== 'undefined') {
      try {
        const u = new URL(window.location.href);
        shareUrl = `${u.origin}${u.pathname}${u.search}`;
      } catch {
        shareUrl = window.location.href.split('#')[0];
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({ url: shareUrl });
        return;
      } catch {
        /* user cancelled or url-only unsupported */
      }
      try {
        await navigator.share({ text: shareUrl });
        return;
      } catch {
        /* fall through to clipboard */
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied — send it to a buyer or sourcing colleague.');
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert('Link copied — send it to a buyer or sourcing colleague.');
      } catch {
        alert(shareUrl || 'Unable to copy link');
      }
    }
  };
  
  const requestLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser 😞");
      return;
    }

    // 先给个反馈，让用户知道正在定位
    // (可选) 如果你不想用 alert，可以做一个小的 Toast 提示
    // console.log("📍 Locating..."); 

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLoc = { 
          lat: pos.coords.latitude, 
          lng: pos.coords.longitude 
        };

        // 1. 更新用户位置 (红点)
        setUserLocation(newLoc);
        setNearbyCenterType('USER');
        setNearbyCenterName('');
        setNearbyCenterShopId(null);
        
        // 2. 开启附近过滤
        setUseNearbyFilter(true); 
        
        // 3. 设置合理的默认半径 (比如 5km 更适合城市浏览)
        const DEFAULT_RADIUS = 5;
        setRadiusKm(DEFAULT_RADIUS); 

        // 🚀 关键修复：强制移动地图镜头！
        // 将地图中心移到用户位置
        setCenter(newLoc);
        
        // 将缩放级别调整为“街道/社区”级别 (13-14 比较合适)
        // 5.5 是国家级别，13 是城市级别，15 是街道级别
        setZoom(13.5); 

        // 4. 正确的提示语 (使用我们刚定义的常量)
        setTimeout(() => {
          alert(`📍 Showing verified factories within ${DEFAULT_RADIUS}km of your location.`);
        }, 100);
      },
      (err) => {
        console.error(err);
        let msg = "Location access denied.";
        if (err.code === 1) msg = "You denied location access. Please enable it in browser settings to use 'Nearby' filter.";
        if (err.code === 2) msg = "Location unavailable. Check your GPS settings.";
        if (err.code === 3) msg = "Location request timed out.";
        alert(msg);
      },
      {
        enableHighAccuracy: true, // 尝试获取高精度 GPS
        timeout: 10000,           // 10秒超时
        maximumAge: 0             // 不使用缓存
      }
    );
  };

  const handleAddShop = (newShop: Shop) => {
    if (shops.some(s => s.name.trim().toLowerCase() === newShop.name.trim().toLowerCase())) {
      alert(`Factory "${newShop.name}" already exists`);
      return;
    }
    setShops([...shops, newShop]); setShowCreateAd(false);
    const slug = newShop.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    navigate(`/shop/${slug}`);
  };

  const handleDeleteShop = async (shop: Shop) => {
    if (!confirm(`Delete "${shop.name}"? This cannot be undone.`)) return;
    setDeletingId(shop.id);
    try {
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch(`${API_BASE_URL}/shop/del`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id: shop.id, token: "my_super_secret_delete_token" }),
      });
      const result = await res.json();
      if (!res.ok || result.error) { alert(result.error || "Delete failed"); return; }
      setShops(prev => prev.filter(s => s.id !== shop.id));
      if (selectedShop?.id === shop.id) {
        setSelectedShop(null);
        navigate('/');
      }
    } catch (err) { console.error(err); alert("Network error"); } 
    finally { setDeletingId(null); }
  };

  const handleCreateAdClick = () => {
    if (!isLoggedIn) {
      setShowLogin(true);
      return;
    }
    if (!canManageAllAds) {
      alert('Only admin or ad manager can add factory listings. Please contact an administrator.');
      return;
    }
    setShowCreateAd(true);
  };

  useEffect(() => {
    if (shops.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shops));
    } catch {
      /* ignore */
    }
  }, [shops]);
  useEffect(() => { fetchShops(); }, []);

  return (
    <div className="relative h-screen w-full bg-transparent flex flex-col overflow-hidden">
      {/* Region chips: no panel fill — only glass pills; map visible behind */}
      <div className="absolute top-0 left-0 right-[72px] sm:right-0 z-[996] pointer-events-none bg-transparent">
        <div className="max-w-7xl mx-auto px-0.5 sm:px-3 pt-[max(2px,env(safe-area-inset-top,0px))] pb-0 pointer-events-auto bg-transparent">
          {[REGION_FILTER_OPTIONS.slice(0, 3), REGION_FILTER_OPTIONS.slice(3)].map((row, rowIdx) => (
            <div key={rowIdx} className="flex justify-center gap-0 sm:gap-1.5 mb-px last:mb-0">
              {row.map((r) => {
                const on = selectedRegions.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRegion(r)}
                    className={`min-w-0 flex-1 max-w-[25%] sm:max-w-none sm:flex-initial rounded-md sm:rounded-full px-0.5 py-0.5 sm:px-2.5 sm:py-1 text-[11px] leading-snug sm:text-sm sm:leading-normal font-bold border transition text-center backdrop-blur-sm ${
                      on
                        ? 'bg-rose-600/90 text-white border-rose-500/85 shadow-sm'
                        : 'bg-white/25 text-gray-900 border-white/40 shadow-sm hover:bg-white/40 hover:border-rose-300/70'
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div
        className={`absolute left-0 right-[72px] sm:right-0 z-[996] px-2 sm:px-3 pointer-events-none bg-transparent ${badgeBarTopClass}`}
      >
        <div className="max-w-7xl mx-auto w-full flex flex-nowrap items-center justify-between gap-1.5 px-1 sm:px-2 py-0 pointer-events-auto">
          <div className="min-w-0 flex-1 flex items-center justify-start">
            <BadgeFilterDropdown
              allTags={allTags}
              selectedTags={selectedTags}
              onChange={setSelectedTags}
            />
          </div>
          <div className="shrink-0 flex items-center justify-end">
            <MinSpendFilterDropdown value={moqFilter} onChange={setMoqFilter} />
          </div>
        </div>
      </div>

      {/*
        Map must fill this panel (absolute inset-0), not sit below padding-top —
        otherwise the padded strip shows the page background (looks like a grey bar).
        Region / credentials / MOQ rows float above the map with higher z-index.
      */}
      <div className="flex-1 relative overflow-hidden min-h-0 pt-[calc(env(safe-area-inset-top,0px)+5.45rem)]">
        <div className="absolute inset-0 z-0">
          <MapComponent
            shops={filteredShops}
            center={userLocation || CHINA_CENTER}
            zoom={zoom}
            selectedShop={selectedShop}
            userLocation={userLocation}
            onMarkerClick={handleMarkerClickStable}
            radiusKm={useNearbyFilter && userLocation ? radiusKm : 0}
            mapPanNonce={mapPanNonce}
          />
        </div>

        {shopsDataSource !== 'server' && shops.length > 0 && (
          <div className="absolute left-3 right-3 top-[calc(env(safe-area-inset-top,0px)+6.5rem)] z-[1002] pointer-events-auto">
            <div className="rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-950 shadow-lg">
              <p className="font-semibold">Showing cached data on this device only</p>
              <p className="mt-1 text-xs opacity-90">
                {shopsDataSource === 'cache-stale'
                  ? 'The server returned 0 factories, but this browser still has an old local copy. Other phones will not see these listings until import succeeds on the server.'
                  : 'Cannot reach the server right now. Other devices will not see this data.'}
              </p>
              <button
                type="button"
                onClick={() => void fetchShops()}
                className="mt-2 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold"
              >
                Retry from server
              </button>
            </div>
          </div>
        )}

        {shops.length === 0 && shopsLoadStatus === 'error' && (
          <div className="absolute left-3 right-3 top-[calc(env(safe-area-inset-top,0px)+6.5rem)] z-[1002] pointer-events-auto">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-950 shadow-lg">
              <p className="font-semibold">Could not load factory data</p>
              <p className="mt-1 text-xs opacity-90">
                Your phone may not have cached data like your computer. Check network or tap Retry.
              </p>
              <button
                type="button"
                onClick={() => void fetchShops()}
                className="mt-2 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {showShareTooltip && (
          <button
            type="button"
            aria-label="Dismiss share tip"
            className="fixed inset-0 z-[998] bg-transparent cursor-default"
            onClick={dismissShareTooltip}
          />
        )}

        {/* Below fixed hamburger (top-4 ~56px tall) — avoid overlap */}
        <div className="absolute top-[calc(env(safe-area-inset-top,0px)+4.5rem)] right-4 z-[1001] flex flex-col gap-3 items-end">
          <div ref={searchControlRef} className="relative flex flex-col items-end">
            <button
              type="button"
              onClick={handleSearchFabClick}
              className={`p-3 rounded-full shadow-lg ${searchPanelOpen ? 'bg-rose-600 text-white' : 'bg-white text-gray-800'}`}
              title={searchPanelOpen ? 'Search (confirm)' : 'Search factories'}
              aria-expanded={searchPanelOpen}
              aria-label={searchPanelOpen ? 'Confirm search' : 'Open search'}
            >
              {isSearching ? (
                <span className="block h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-6 h-6" strokeWidth={2.25} />
              )}
            </button>
            {searchPanelOpen && (
              <div
                className="absolute right-0 top-[calc(100%+8px)] w-[min(calc(100vw-5rem),18rem)] rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl z-[10002]"
                onClick={(e) => e.stopPropagation()}
              >
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Factory name</label>
                <input
                  type="text"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmSearchPanel();
                    if (e.key === 'Escape') cancelSearchPanel();
                  }}
                  placeholder="Search…"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                  autoFocus
                />
              </div>
            )}
          </div>

          <div className="relative flex items-center justify-end">
            {showLocationFabTip && (
              <button
                type="button"
                onClick={dismissLocationFabTip}
                className="absolute right-[calc(100%+10px)] top-1/2 -translate-y-1/2 w-[min(calc(100vw-5.5rem),240px)] z-[1002] text-left cursor-pointer"
                aria-label="Dismiss location tip"
              >
                <div className="relative rounded-2xl bg-white px-3.5 py-2.5 shadow-xl border border-sky-100/90 pointer-events-auto">
                  <div
                    className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-r border-t border-sky-100/90 rotate-45"
                    aria-hidden
                  />
                  <p className="text-sm font-bold text-sky-700 leading-tight pr-1">
                    Find verified factories in industrial zones
                  </p>
                  <p className="text-[11px] text-gray-600 leading-snug mt-1 pr-1">
                    Tap the blue arrow to use your location; we will highlight suppliers around you on the map.
                  </p>
                  <p className="text-[10px] text-sky-500 font-semibold mt-1.5 pr-1">Tap here to close</p>
                </div>
              </button>
            )}
            <button
              type="button"
              onClick={requestLocation}
              className={`relative p-3 rounded-full shadow-lg ${userLocation ? 'bg-blue-500 text-white' : 'bg-white'}`}
              title="Use my location"
              aria-label="Use my location for nearby"
            >
              <Navigation className="w-6 h-6" />
            </button>
          </div>
          <button
            type="button"
            onClick={handleCreateAdClick}
            className="p-3 bg-white text-rose-500 rounded-full shadow-lg"
            title={!isLoggedIn ? 'Login to manage listings' : (canManageAllAds ? 'Add factory listing' : 'Admin / ad manager only')}
          >
            <Plus className="w-6 h-6" />
          </button>
          <button type="button" onClick={() => setUseNearbyFilter(!useNearbyFilter)} className={`p-3 rounded-full shadow-lg ${useNearbyFilter ? 'bg-green-500 text-white' : 'bg-white'}`}><Filter className="w-6 h-6" /></button>

          <div className="relative flex items-center mt-0.5">
            {showShareTooltip && (
              <div
                className="absolute right-[calc(100%+10px)] top-1/2 -translate-y-1/2 w-[min(calc(100vw-6rem),220px)] pointer-events-none text-left"
                role="tooltip"
              >
                <div className="relative rounded-2xl bg-white px-3.5 py-2.5 shadow-xl border border-rose-100/80">
                  <div
                    className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-r border-t border-rose-100/80 rotate-45"
                    aria-hidden
                  />
                  <p className="text-sm font-bold text-rose-600 leading-tight pr-1">Share directory</p>
                  <p className="text-[11px] text-gray-600 leading-snug mt-1 pr-1">
                    Know a buyer who needs this supplier? Share this factory!
                  </p>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={handleShareMap}
              className="relative p-3 rounded-full shadow-lg bg-gradient-to-br from-orange-400 via-rose-400 to-pink-300 text-white animate-share-fab-pulse ring-2 ring-white/90"
              title="Share this map"
              aria-label="Share this map"
            >
              <Share2 className="w-6 h-6" strokeWidth={2.25} />
            </button>
          </div>
        </div>

        {useNearbyFilter && userLocation && (
          <div className="absolute top-4 left-4 right-20 z-[999] bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-xl flex items-center gap-4">
            <span className="text-xs font-bold text-gray-400 uppercase">Range</span>
            <input type="range" min="1" max="20" value={radiusKm} onChange={(e) => setRadiusKm(parseInt(e.target.value))} className="flex-1 accent-rose-500" />
            <span className="text-sm font-bold text-rose-600 w-10 text-right">{radiusKm}km</span>
            <button
              type="button"
              onClick={() => {
                setUseNearbyFilter(false);
                setUserLocation(null);
                setSelectedShop(null);
                setNearbyCenterType('USER');
                setNearbyCenterName('');
                setNearbyCenterShopId(null);
                setCenter(CHINA_CENTER);
                setZoom(5.5);
              }}
              className="ml-1 sm:ml-2 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-lg shadow-rose-500/25 ring-2 ring-white/90 transition hover:from-rose-600 hover:to-orange-500 active:scale-95 animate-pulse"
              aria-label="Clear nearby range filter"
              title="Clear nearby range filter"
            >
              Clear
            </button>
          </div>
        )}

        {/* Drawer */}
        <div 
          ref={drawerRef}
          className="absolute bottom-0 left-0 right-0 z-[999] flex flex-col touch-manipulation"
          style={{
            height: `${drawerHeight}px`,
            paddingBottom: 'max(4px, env(safe-area-inset-bottom, 0px))',
            transition: isDraggingDrawer.current ? 'none' : 'height 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            boxShadow: '0 -6px 28px rgba(0,0,0,0.18), 0 -1px 0 rgba(255,255,255,0.5) inset',
            background: 'linear-gradient(to top, rgba(255, 130, 90, 0.92), rgba(255, 190, 120, 0.75), rgba(255, 248, 235, 0.55))',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
          onTouchStart={handleDrawerTouchStart}
          onTouchMove={handleDrawerTouchMove}
          onTouchEnd={handleDrawerTouchEnd}
          onMouseDown={handleDrawerMouseDown}
          onMouseMove={handleDrawerMouseMove}
          onMouseUp={handleDrawerMouseUp}
        >
          <div className="flex-1 relative overflow-hidden w-full flex flex-col min-h-0" style={{ borderRadius: '24px 24px 0 0', paddingTop: '4px' }}>
            {/* Drag handle: large touch target; swipe down to collapse (FAB still works) */}
            <div className="drawer-drag-handle shrink-0 flex justify-center px-3 pt-1 pb-2 cursor-grab active:cursor-grabbing touch-none">
              <div
                className="h-1.5 w-16 sm:w-20 rounded-full bg-white/95 shadow-[0_1px_8px_rgba(0,0,0,0.35)] ring-1 ring-amber-900/20 pointer-events-none"
                aria-hidden
              />
              <span className="sr-only">Drag down to minimise the list</span>
            </div>
            {isExpanded ? (
              <div className="h-full w-full pt-2 pb-3 px-3 sm:px-4 flex flex-col min-h-0">
                {useNearbyFilter && userLocation && (
                  <div className="drawer-drag-handle shrink-0 mb-2 mx-auto w-full max-w-[min(100%,560px)] touch-none cursor-grab active:cursor-grabbing">
                    <div
                      className="rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 px-3 py-2 sm:py-2.5 text-center shadow-sm ring-1 ring-amber-100/80 pointer-events-auto"
                      role="status"
                      aria-live="polite"
                    >
                      {nearbyCenterType === 'SHOP' && nearbyCenterShop ? (
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {selectedShop?.id !== nearbyCenterShop.id && (
                            <>
                              <span className="text-[11px] sm:text-xs font-semibold text-amber-950 leading-snug tracking-tight">
                                Factories surrounding
                              </span>
                              <button
                                type="button"
                                onClick={handleBackToNearbyCenterShop}
                                className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-rose-600 shadow-sm ring-1 ring-rose-100 transition hover:bg-rose-50 active:scale-95"
                                aria-label={`Back to ${nearbyCenterShop.name}`}
                              >
                                <MapPin size={12} />
                                {nearbyCenterShop.name} (back to me)
                              </button>
                              <span className="text-[11px] sm:text-xs font-semibold text-amber-950 leading-snug tracking-tight">
                                within {radiusKm}km
                              </span>
                            </>
                          )}
                          {selectedShop?.id === nearbyCenterShop.id && (
                            <span className="text-[11px] sm:text-xs font-semibold text-amber-950 leading-snug tracking-tight">
                              Factories surrounding {nearbyCenterShop.name} within {radiusKm}km
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] sm:text-xs font-semibold text-amber-950 leading-snug tracking-tight">
                          {nearbyRangeTitle}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div className="relative flex-1 min-h-0 min-w-0 w-full">
                  <div
                    ref={scrollRef}
                    className="flex items-center h-full min-h-0 min-w-0 pr-12"
                    style={{ width: 'max-content', cursor: 'grab', touchAction: 'none', userSelect: 'none', willChange: 'transform', transform: `translateX(${currentTranslateX.current}px)` }}
                    onMouseDown={(e) => handleListDragStart(e.clientX)}
                    onTouchStart={(e) => handleListDragStart(e.touches[0].clientX)}
                  >
                    {filteredShops.length > 0 ? (
                      filteredShops.map((shop) => {
                        const isSelected = selectedShop?.id === shop.id;
                        const shouldAutoOpenEdit = pendingEditShopId === shop.id;

                        return (
                          <div
                            key={shop.id}
                            className="block flex-shrink-0 flex-grow-0 no-drag relative"
                            style={{ width: '260px', minWidth: '260px', maxWidth: '260px', marginRight: '16px', cursor: 'pointer' }}
                            onClick={(e) => {
                              const clientX = 'touches' in e ? (e as any).touches?.[0]?.clientX || 0 : e.clientX;
                              const finalX = 'changedTouches' in e && (e as any).changedTouches?.length > 0 ? (e as any).changedTouches[0].clientX : clientX;
                              e.stopPropagation();
                              handleCardClick(shop, finalX);
                            }}
                          >
                            <ShopCard
                              shop={shop}
                              isSelected={isSelected}
                              onClick={() => {}}
                              onDelete={handleDeleteShop}
                              isAdmin={canManageAllAds}
                              canDelete={isAdmin}
                              otherShopNamesLower={existingShopNamesLower.filter(
                                (n) => n !== (shop.name || '').trim().toLowerCase()
                              )}
                              onSave={(updated) => {
                                const safeUpdated = { ...updated, pictures: updated.pictures ? [...updated.pictures] : [], new_girls_last_15_days: !!updated.new_girls_last_15_days, badge_text: updated.badge_text || (updated.new_girls_last_15_days ? 'New' : '') };
                                setShops(prev => prev.map(s => s.id === safeUpdated.id ? safeUpdated : s));
                              }}
                              deleting={deletingId === shop.id}
                              isLoggedIn={isLoggedIn}
                              onPreview={(s, i) => { setPreviewShop(s); setPreviewIndex(i); }}
                              autoOpenEdit={shouldAutoOpenEdit}
                              onAutoEditHandled={() => setPendingEditShopId(null)}
                              onEditModalChange={setShopCardEditOpen}
                            />
                            {isSelected && (
                              <div className="mt-2 text-center text-xs font-bold text-rose-700 bg-white/90 rounded py-1 shadow-sm border border-rose-100 animate-pulse">
                                Tap again for details
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-white font-bold bg-black/40 backdrop-blur-md p-8 rounded-xl text-center min-w-[300px] shadow-lg space-y-3">
                        <p>{emptyListMessage}</p>
                        {shopsLoadStatus === 'error' && (
                          <button
                            type="button"
                            onClick={() => void fetchShops()}
                            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
                          >
                            Retry
                          </button>
                        )}
                        {shops.length > 0 && useNearbyFilter && userLocation && (
                          <button
                            type="button"
                            onClick={() => setUseNearbyFilter(false)}
                            className="px-4 py-2 rounded-lg bg-white text-gray-800 text-sm font-semibold hover:bg-gray-100"
                          >
                            Show all factories
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    className="absolute right-2 sm:right-3 z-[1000] pointer-events-auto"
                    style={{ bottom: 'max(6px, env(safe-area-inset-bottom, 0px))', top: 'auto', transform: 'none' }}
                  >
                    <button
                      type="button"
                      onClick={toggleDrawer}
                      className="min-h-12 min-w-12 w-12 h-12 rounded-full flex items-center justify-center text-white bg-slate-900 hover:bg-slate-800 active:scale-95 shadow-[0_4px_20px_rgba(0,0,0,0.45)] ring-[3px] ring-white/90 border-2 border-white/50 motion-reduce:shadow-lg"
                      aria-label="Collapse factory list"
                    >
                      <ChevronDown size={26} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 w-full flex items-center px-3 sm:px-4 pb-1 no-drag pr-[4.5rem]" onClick={toggleDrawer}>
                {selectedShop ? (
                  <div className="flex items-center gap-2 text-white w-full min-w-0">
                    <div className="w-10 h-10 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-md ring-1 ring-white/35">
                      <MapPin size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm sm:text-base truncate text-white drop-shadow">{selectedShop.name}</h3>
                      <p className="text-[10px] sm:text-xs text-white/90 font-medium truncate drop-shadow">Tap again for details</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-white w-full min-w-0">
                    <MapPin size={16} className="flex-shrink-0 drop-shadow" />
                    <span className="font-bold text-[11px] sm:text-xs leading-tight drop-shadow">
                      Select a factory on the map
                    </span>
                  </div>
                )}
                <div
                  className="absolute right-2 sm:right-3 z-[1000]"
                  style={{ bottom: 'max(6px, env(safe-area-inset-bottom, 0px))', top: 'auto', transform: 'none' }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDrawer();
                    }}
                    className="min-h-12 min-w-12 w-12 h-12 rounded-full flex items-center justify-center text-white bg-gradient-to-br from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 active:scale-95 shadow-[0_4px_22px_rgba(225,29,72,0.55)] ring-[3px] ring-white/95 border-2 border-white/60 animate-pulse motion-reduce:animate-none"
                    aria-label="Expand factory list"
                  >
                    <ChevronUp size={28} strokeWidth={3} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateAd && (
        <AdminPanel
          onAddShop={handleAddShop}
          onClose={() => setShowCreateAd(false)}
          existingShopNamesLower={existingShopNamesLower}
          onBulkShopsImported={(newShops) => {
            setShopsDataSource('server');
            setShops((prev) => {
              const seen = new Set(prev.map((s) => s.name.trim().toLowerCase()));
              const merged = [...prev];
              for (const s of newShops) {
                const k = s.name.trim().toLowerCase();
                if (!seen.has(k)) {
                  seen.add(k);
                  merged.push(s);
                }
              }
              return merged;
            });
          }}
        />
      )}
      {showLogin && <LoginPanel onLoginSuccess={(payload) => { handleLoginSuccess(payload); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}
      {previewShop && <ImagePreviewModal shop={previewShop} index={previewIndex} onChangeIndex={setPreviewIndex} onClose={() => setPreviewShop(null)} />}
      
      {/* ✅ 新增：年龄验证弹窗 */}
      <AgeVerificationModal 
        isOpen={showAgeModal} 
        onConfirm={handleAgeConfirm} 
        onReject={handleAgeReject} 
      />
    </div>
  );
};

export default HomePage;
