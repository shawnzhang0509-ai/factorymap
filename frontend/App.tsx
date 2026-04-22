import React, { useState, useEffect, useRef, useMemo } from 'react';
// 1. 引入刚才写的汉堡包按钮
import HamburgerButton from './components/HamburgerButton'; 
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AgeVerificationModal from './components/AgeVerificationModal';
import TermsPage from './pages/TermsPage'; 
import AboutPage from './pages/AboutPage';
import { REGION_OPTIONS } from './constants/filterRegions';
import SidebarMenu from './components/SidebarMenu'; // 引入侧边栏
import MapComponent from './components/MapComponent';
import ShopCard from './components/ShopCard';
import AdminPanel from './components/AdminPanel';
import ShopDetailPage from './pages/ShopDetailPage';
import { Shop, UserLocation } from './types';
import { NZ_CENTER } from './constants';
import { calculateDistance } from './utils';
import LoginPanel from './components/LoginPanel';
import ImagePreviewModal from './components/ImagePreviewPanel';
import { Plus, Navigation, Filter, Share2, Search, X, ChevronUp, ChevronDown, MapPin } from 'lucide-react';
import AdminStats from './pages/Adminstats';
import MyAdsPage from './pages/MyAdsPage';
import AssignAdsPage from './pages/AssignAdsPage';
import BadgeFilterDropdown from './components/BadgeFilterDropdown';
import MinSpendFilterDropdown from './components/MinSpendFilterDropdown';
import { parseMinSpend } from './constants/minSpend';

const STORAGE_KEY = 'nz_massage_shops_v1';
const SHARE_TOOLTIP_SEEN_KEY = 'nz_share_tooltip_seen_v1';
/** Session only: show location FAB hint again on new visit / new tab */
const LOCATION_FAB_TIP_DISMISSED_KEY = 'nz_location_fab_tip_dismissed_session';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

/** Align list payload with UI: picture URLs, and badge_text fallback from new_girls_last_15_days */
function normalizeShopFromApi(shop: any, apiBase: string): Shop {
  const pictures =
    shop.pictures?.map((pic: any) => ({
      ...pic,
      url: pic.url && pic.url.startsWith('/files/') ? `${apiBase}${pic.url}` : pic.url,
    })) || [];
  const rawBadge = shop.badge_text;
  const hasBadge = rawBadge != null && String(rawBadge).trim() !== '';
  const badge_text = hasBadge
    ? String(rawBadge).trim()
    : shop.new_girls_last_15_days
      ? 'New'
      : '';
  const minSpend = parseMinSpend(shop.min_spend);
  return {
    ...shop,
    pictures,
    badge_text,
    filter_city: shop.filter_city || '',
    min_spend: minSpend ?? undefined,
  };
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
    return `Shops near you within ${xx}km`;
  }
  const name = (centerName || 'this shop').trim();
  return `Shops surrounding ${name} within ${xx}km`;
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [shops, setShops] = useState<Shop[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved) as any[];
      return Array.isArray(parsed)
        ? parsed.map((s) => normalizeShopFromApi(s, API_BASE_URL))
        : [];
    } catch {
      return [];
    }
  });

  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [zoom, setZoom] = useState<number>(5.5); 
  const [center, setCenter] = useState<UserLocation>(NZ_CENTER); // 使用你导入的 NZ_CENTER 作为默认值
  

  // ✅ 新增：年龄验证状态
  const [isAgeVerified, setIsAgeVerified] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('age_verified') === 'true';
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
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  
  const [isLoggedIn, setIsLoggedIn] = useState(() => typeof window !== 'undefined' && localStorage.getItem("admin_logged_in") === "true");
  const [username, setUsername] = useState<string | null>(() => typeof window !== 'undefined' ? localStorage.getItem('admin_username') : null);
  const [isAdmin, setIsAdmin] = useState(() => typeof window !== 'undefined' && localStorage.getItem('is_admin') === 'true');

  const [previewShop, setPreviewShop] = useState<Shop | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  /** Map region filter (OR); empty = all regions */
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  /** Min spend filter: show shops with no min_spend or min_spend <= value */
  const [maxMinSpend, setMaxMinSpend] = useState<number | null>(null);
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
        const target = shops.find(s => s.id.toString() === focusId || s.id === parseInt(focusId));
        if (target) {
          setSelectedShop(target);
          setNearbyCenterType('SHOP');
          setNearbyCenterName(target.name || '');
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
    localStorage.setItem('age_verified', 'true');
    setIsAgeVerified(true);
    setShowAgeModal(false);
  };

  // 4. ✅ 新增：处理拒绝函数 (独立函数)
  const handleAgeReject = () => {
    window.location.href = 'https://www.google.com';
  };

  const normalizeTag = (tag: string): string => {
    let clean = (tag || '').trim().toLowerCase();
    if (!clean) return '';
    clean = clean.replace(/^🆕\s*/, '');
    clean = clean.replace(/\s+/g, ' ');
    clean = clean
      .replace(/^[^a-z0-9\u4e00-\u9fa5]+/gi, '')
      .replace(/[^a-z0-9\u4e00-\u9fa5]+$/gi, '')
      .trim();

    const aliasMap: Record<string, string> = {
      'new girl': 'new',
      'new girls': 'new',
      'vip seller': 'vip',
      'diamond seller': 'diamond',
      'adultdollseller': 'adult doll seller',
    };
    return aliasMap[clean] || clean;
  };

  const getShopTags = (shop: Shop): string[] => {
    const text = shop.badge_text;
    const fromText =
      text && typeof text === 'string' && text.trim() !== ''
        ? text
            .split(/[,\n，|/]+/)
            .map((t) => normalizeTag(t))
            .filter(Boolean)
        : [];
    if (shop.new_girls_last_15_days && !fromText.includes('new')) {
      fromText.push('new');
    }
    return fromText;
  };

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    shops.forEach(shop => getShopTags(shop).forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [shops]);

  /** Below two region rows: badge + min. spend filters */
  const badgeBarTopClass = 'top-[calc(env(safe-area-inset-top,0px)+3.95rem)]';

  const nearbyRangeTitle = useMemo(
    () => buildNearbyRangeTitle(nearbyCenterType, nearbyCenterName, radiusKm),
    [nearbyCenterType, nearbyCenterName, radiusKm]
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
      const targetTags = new Set(selectedTags.map((t) => normalizeTag(t)));
      result = result.filter((shop) =>
        getShopTags(shop).some((tag) => targetTags.has(tag))
      );
    }

    if (selectedRegions.length > 0) {
      const regionSet = new Set(selectedRegions);
      result = result.filter((shop) => {
        const fc = (shop as Shop & { filter_city?: string }).filter_city?.trim();
        return fc && regionSet.has(fc);
      });
    }

    if (maxMinSpend != null) {
      result = result.filter((shop) => {
        const v = (shop as Shop & { min_spend?: number }).min_spend;
        if (v == null || v === undefined) return true;
        return v <= maxMinSpend;
      });
    }

    // 3. ✅ 新增：综合排序逻辑 (优先级 > 距离)
    // 定义优先级辅助函数
    const getPriority = (shop: Shop) => {
      const tags = getShopTags(shop);
      if (tags.includes('diamond')) return 3; // 最高优先级
      if (tags.includes('vip')) return 2;      // 次高优先级
      return 0;                                // 普通店铺
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
  }, [shops, useNearbyFilter, userLocation, radiusKm, selectedTags, selectedRegions, maxMinSpend, selectedShop]);

  // Scrolling Logic
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingList = useRef(false);
  const startX = useRef(0);
  const currentTranslateX = useRef(0); 
  const dragStartX = useRef(0); 
  const animationFrameId = useRef<number | null>(null);
  const resumeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedByUser = useRef(false);

  const startAutoScroll = () => {
    if (animationFrameId.current || !isExpanded || isPausedByUser.current || selectedShop) return;
    const run = () => {
      const container = scrollRef.current;
      if (!container) { animationFrameId.current = requestAnimationFrame(run); return; }
      const cardWidth = 260 + 16;
      const totalContentWidth = filteredShops.length * cardWidth;
      currentTranslateX.current -= AUTO_SCROLL_SPEED;
      if (Math.abs(currentTranslateX.current) >= totalContentWidth) currentTranslateX.current = 0;
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
  const handleListMouseMove = (e: MouseEvent) => {
    if (!isDraggingList.current || !scrollRef.current) return;
    const walk = e.clientX - startX.current;
    currentTranslateX.current += walk;
    scrollRef.current.style.transform = `translateX(${currentTranslateX.current}px)`;
    startX.current = e.clientX; 
  };
  const handleListTouchMove = (e: TouchEvent) => {
    if (!isDraggingList.current || !scrollRef.current) return;
    const walk = e.touches[0].clientX - startX.current;
    currentTranslateX.current += walk;
    scrollRef.current.style.transform = `translateX(${currentTranslateX.current}px)`;
    startX.current = e.touches[0].clientX;
  };
  const handleListMouseUp = () => {
    if (!isDraggingList.current) return;
    isDraggingList.current = false;
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
    setSelectedShop(shop);
    if (!useNearbyFilter) {
      setUseNearbyFilter(true);
      setUserLocation({ lat: shop.lat, lng: shop.lng });
      setNearbyCenterType('SHOP');
      setNearbyCenterName(shop.name || '');
      setRadiusKm(5);
      setMapPanNonce((n) => n + 1);
    } else if (!anchorIsShop) {
      setMapPanNonce((n) => n + 1);
    }
    // ShopCard while "nearby around this shop": keep filter center; do not bump mapPanNonce
    if (!isExpanded) setDrawerHeight(EXPANDED_HEIGHT);
    stopAutoScroll();
  };

  const handleMarkerClick = (shop: Shop) => {
    if (selectedShop && selectedShop.id === shop.id) {
      const slug = shop.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      navigate(`/shop/${slug}`);
      return;
    }
    setSelectedShop(shop);
    if (!useNearbyFilter) {
      setUseNearbyFilter(true);
      setUserLocation({ lat: shop.lat, lng: shop.lng });
      setNearbyCenterType('SHOP');
      setNearbyCenterName(shop.name || '');
    } else if (nearbyCenterType === 'SHOP') {
      setUserLocation({ lat: shop.lat, lng: shop.lng });
      setNearbyCenterName(shop.name || '');
    }
    setMapPanNonce((n) => n + 1);
    if (!isExpanded) setDrawerHeight(EXPANDED_HEIGHT);
    stopAutoScroll();
  };

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
  const handleDrawerTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingDrawer.current) return;
    const deltaY = startY.current - e.touches[0].clientY;
    let newHeight = startHeight.current + deltaY;
    if (newHeight < COLLAPSED_HEIGHT) newHeight = COLLAPSED_HEIGHT;
    if (newHeight > EXPANDED_HEIGHT) newHeight = EXPANDED_HEIGHT;
    drawerHeightRef.current = newHeight;
    setDrawerHeight(newHeight);
  };
  const handleDrawerTouchEnd = () => {
    if (!isDraggingDrawer.current) return;
    isDraggingDrawer.current = false;
    const next = resolveDrawerSnap(drawerHeightRef.current);
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
    setDrawerHeight(newHeight);
  };
  const handleDrawerMouseUp = () => {
    if (!isDraggingDrawer.current) return;
    isDraggingDrawer.current = false;
    window.removeEventListener('mousemove', handleDrawerMouseMove);
    window.removeEventListener('mouseup', handleDrawerMouseUp);
    const next = resolveDrawerSnap(drawerHeightRef.current);
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
  const fetchShops = async () => {
    try {
      console.log(API_BASE_URL);
      const token = localStorage.getItem('auth_token') || '';
      const response = await fetch(`${API_BASE_URL}/shops`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const fixedData = data.map((shop: any) => normalizeShopFromApi(shop, API_BASE_URL));
      setShops(fixedData);
    } catch (error) {
      console.error('❌ Load failed:', error);
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setShops(JSON.parse(saved));
    }
  };

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
      setShops(raw.map((shop: any) => normalizeShopFromApi(shop, API_BASE_URL)));
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
    setSelectedRegions((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  };

  const handleLoginSuccess = (payload: { username: string; token: string; isAdmin: boolean }) => {
    const { username: u, token, isAdmin: adminFlag } = payload;
    setIsLoggedIn(true);
    setUsername(u);
    setIsAdmin(adminFlag);
    localStorage.setItem("admin_logged_in", "true");
    localStorage.setItem('admin_username', u);
    localStorage.setItem('auth_token', token || '');
    localStorage.setItem('is_admin', adminFlag ? 'true' : 'false');
  };
  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername(null);
    setIsAdmin(false);
    localStorage.removeItem("admin_logged_in");
    localStorage.removeItem('admin_username');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('is_admin');
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
      alert('Link copied — share it with a friend!');
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert('Link copied — share it with a friend!');
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
          alert(`📍 Filtering cute faces around ${DEFAULT_RADIUS}km… just for you 😎.`);
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
    if (shops.some(s => s.name.trim().toLowerCase() === newShop.name.trim().toLowerCase())) { alert(`Shop "${newShop.name}" already exists`); return; }
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
    if (!isAdmin) {
      alert('Only admin can create new ads. Please contact admin to get ads assigned.');
      return;
    }
    setShowCreateAd(true);
  };

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(shops)); } catch (e) {} }, [shops]);
  useEffect(() => { fetchShops(); }, []);

  return (
    <div className="relative h-screen w-full bg-transparent flex flex-col overflow-hidden">
      {/* Region chips: no panel fill — only glass pills; map visible behind */}
      <div className="absolute top-0 left-0 right-[72px] sm:right-0 z-[996] pointer-events-none bg-transparent">
        <div className="max-w-7xl mx-auto px-0.5 sm:px-3 pt-[max(2px,env(safe-area-inset-top,0px))] pb-0 pointer-events-auto bg-transparent">
          {[REGION_OPTIONS.slice(0, 4), REGION_OPTIONS.slice(4)].map((row, rowIdx) => (
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
            <MinSpendFilterDropdown value={maxMinSpend} onChange={setMaxMinSpend} />
          </div>
        </div>
      </div>

      {/*
        Map must fill this panel (absolute inset-0), not sit below padding-top —
        otherwise the padded strip shows the page background (looks like a grey bar).
        Region / badge / min-spend rows float above the map with higher z-index.
      */}
      <div className="flex-1 relative overflow-hidden min-h-0 pt-[calc(env(safe-area-inset-top,0px)+5.45rem)]">
        <div className="absolute inset-0 z-0">
          <MapComponent
            shops={filteredShops}
            center={userLocation || NZ_CENTER}
            zoom={zoom}
            selectedShop={selectedShop}
            userLocation={userLocation}
            onMarkerClick={handleMarkerClick}
            radiusKm={useNearbyFilter && userLocation ? radiusKm : 0}
            mapPanNonce={mapPanNonce}
          />
        </div>

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
              title={searchPanelOpen ? 'Search (confirm)' : 'Search shops'}
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
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Shop name</label>
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
                  <p className="text-sm font-bold text-sky-700 leading-tight pr-1">Find who is near your place</p>
                  <p className="text-[11px] text-gray-600 leading-snug mt-1 pr-1">
                    Tap the blue arrow to turn on your location; we will show listings around you on the map.
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
            title={!isLoggedIn ? 'Login to add ad' : (isAdmin ? 'Add your ad' : 'Admin-only: assign required')}
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
                  <p className="text-sm font-bold text-rose-600 leading-tight pr-1">Share the Love</p>
                  <p className="text-[11px] text-gray-600 leading-snug mt-1 pr-1">
                    Know a friend who needs a massage? Send them this spot!
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
              onClick={() => {
                setUseNearbyFilter(false);
                setUserLocation(null);
                setSelectedShop(null);
                setNearbyCenterType('USER');
                setNearbyCenterName('');
                setCenter(NZ_CENTER);
                setZoom(5.5);
              }} 
              className="ml-2 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded-lg font-bold transition"
            >
              ✕ Reset
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
                  <div className="drawer-drag-handle shrink-0 mb-2 mx-auto w-full max-w-[min(100%,520px)] touch-none cursor-grab active:cursor-grabbing">
                    <div
                      className="rounded-xl border border-amber-200/90 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 px-3 py-2 sm:py-2.5 text-center shadow-sm ring-1 ring-amber-100/80 pointer-events-none"
                      role="status"
                      aria-live="polite"
                    >
                      <p className="text-[11px] sm:text-xs font-semibold text-amber-950 leading-snug tracking-tight">
                        {nearbyRangeTitle}
                      </p>
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
                      [...filteredShops, ...filteredShops].map((shop, index) => {
                        const uniqueKey = `${shop.id}-copy${Math.floor(index / filteredShops.length)}`;
                        const slug = shop.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                        const isSelected = selectedShop?.id === shop.id;
                        const isFirstCopy = Math.floor(index / filteredShops.length) === 0;
                        const shouldAutoOpenEdit = pendingEditShopId === shop.id && isFirstCopy;
                        
                        return (
                          <div
                            key={uniqueKey}
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
                              isAdmin={isAdmin}
                              canDelete={isAdmin}
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
                      <div className="text-white font-bold bg-black/40 backdrop-blur-md p-8 rounded-xl text-center min-w-[300px] shadow-lg">
                        {selectedTags.length > 0 ? `No shops found with selected badges.` : "No shops found nearby."}
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
                      aria-label="Collapse shop list"
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
                      Select a shop on the map
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
                    aria-label="Expand shop list"
                  >
                    <ChevronUp size={28} strokeWidth={3} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateAd && <AdminPanel onAddShop={handleAddShop} onClose={() => setShowCreateAd(false)} />}
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

/** Old /stats/:id links → shop detail (slug or numeric id both work on ShopDetailPage) */
const StatsToShopRedirect: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>();
  if (!shopId) return <Navigate to="/" replace />;
  return <Navigate to={`/shop/${encodeURIComponent(shopId)}`} replace />;
};

const App: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [authVersion, setAuthVersion] = useState(0);
  const [isAdmin, setIsAdmin] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('is_admin') === 'true'
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = () => {
      setIsAdmin(localStorage.getItem('is_admin') === 'true');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  
  return (
    <BrowserRouter>
      <HamburgerButton 
        onClick={() => setIsMenuOpen(true)} 
        style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 9999 }} 
      />
      
      <Routes>
        {/* 首页路由 */}
        <Route path="/" element={<HomePage key={`home-${authVersion}`} />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/terms" element={<TermsPage />} />
        
        {/* ✅ 新增：店铺详情页路由 (关键修复) */}
        {/* :slug 是一个动态参数，可以匹配 relax, massage, abc 等任意值 */}
        <Route path="/shop/:slug" element={<ShopDetailPage />} />

        <Route path="/stats/:shopId" element={<StatsToShopRedirect />} />
        {/* 👇 新增：全站统计路由 */}
        <Route path="/admin/stats" element={<AdminStats />} />
        <Route path="/admin/assign-ads" element={<AssignAdsPage />} />
        <Route path="/my-ads" element={<MyAdsPage />} />
      </Routes>

      <SidebarMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onAuthChanged={() => {
          setAuthVersion((prev) => prev + 1);
          setIsAdmin(typeof window !== 'undefined' && localStorage.getItem('is_admin') === 'true');
        }}
        isAdmin={isAdmin}
      />
    </BrowserRouter>
  );
};

export default App;