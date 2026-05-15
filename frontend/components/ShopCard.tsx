import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, MapPin, Phone, Upload, X, Check, ExternalLink } from 'lucide-react';
import { Shop, ShopEdit } from '../types';
import { dmsToDecimal } from '../utils/geoUtils';
import { getTagStyle } from '../constants';
import { CHINA_ECONOMIC_ZONES } from '../constants/filterRegions';
import { MOQ_TIER_FORM_OPTIONS, moqTierLabel } from '../constants/moqTiers';
import { credentialIdsFromBadgeText } from '../constants/factoryCredentials';

interface ShopCardProps {
  shop: Shop;
  isSelected: boolean;
  onClick: () => void;
  onDelete: (shop: Shop) => void;
  onSave: (updatedShop: Shop) => void;
  onPreview?: (shop: Shop, index: number) => void;
  deleting?: boolean;
  isLoggedIn?: boolean;
  isAdmin?: boolean;
  canDelete?: boolean;
  autoOpenEdit?: boolean;
  onAutoEditHandled?: () => void;
  /** Home: pause drawer / horizontal list gestures while any shop edit modal is open */
  onEditModalChange?: (isOpen: boolean) => void;
  /** Lowercase trimmed names of other shops (for duplicate-name hint while editing) */
  otherShopNamesLower?: string[];
}

type GestureState = 'idle' | 'tap' | 'scroll' | 'drag';

const ShopCard: React.FC<ShopCardProps> = ({
  shop,
  isSelected,
  onClick,
  onDelete,
  onSave,
  onPreview,
  deleting,
  isLoggedIn,
  isAdmin,
  canDelete,
  autoOpenEdit,
  onAutoEditHandled,
  onEditModalChange,
  otherShopNamesLower = [],
}) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const gestureStateRef = useRef<GestureState>('idle');
  const gestureStartRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const blockActionUntilRef = useRef(0);

  const TAP_MOVE_THRESHOLD = 6;
  const SCROLL_MOVE_THRESHOLD = 10;
  const DRAG_MOVE_THRESHOLD = 14;
  const TAP_MAX_DURATION_MS = 280;
  const ACTION_BLOCK_MS_AFTER_NON_TAP = 900;

  useEffect(() => {
    if (!isEditing) return;
    onEditModalChange?.(true);
    return () => {
      onEditModalChange?.(false);
    };
  }, [isEditing, onEditModalChange]);

  const getShopSlug = () => {
    return (shop.name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const buildSmsMessage = () => {
    const ownerName = (shop.name || '').trim() || 'there';
    const slug = getShopSlug();
    const detailPath = slug ? `/shop/${slug}` : `/shop/${shop.id}`;
    const detailUrl = `${window.location.origin}${detailPath}`;
    return `Hello ${ownerName}, we found your factory on China Factory Map and would like to discuss sourcing. Profile: ${detailUrl}`;
  };

  const setGestureState = (nextState: GestureState) => {
    gestureStateRef.current = nextState;
  };

  const blockActions = (ms = ACTION_BLOCK_MS_AFTER_NON_TAP) => {
    blockActionUntilRef.current = Math.max(blockActionUntilRef.current, Date.now() + ms);
  };

  const markGestureStart = (x: number, y: number) => {
    gestureStartRef.current = { x, y, at: Date.now() };
    setGestureState('tap');
  };

  const markGestureMove = (x: number, y: number) => {
    const start = gestureStartRef.current;
    if (!start) return;

    const dx = x - start.x;
    const dy = y - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const maxDelta = Math.max(absX, absY);

    if (maxDelta <= TAP_MOVE_THRESHOLD) return;

    if (absY >= SCROLL_MOVE_THRESHOLD && absY >= absX) {
      if (gestureStateRef.current !== 'scroll') {
        setGestureState('scroll');
      }
      blockActions();
      return;
    }

    if (absX >= DRAG_MOVE_THRESHOLD && absX > absY) {
      if (gestureStateRef.current !== 'drag') {
        setGestureState('drag');
      }
      blockActions();
      return;
    }

    if (maxDelta >= SCROLL_MOVE_THRESHOLD) {
      setGestureState('scroll');
      blockActions();
    }
  };

  const markGestureEnd = () => {
    const state = gestureStateRef.current;
    const start = gestureStartRef.current;

    if (state === 'tap' && start) {
      const tapDuration = Date.now() - start.at;
      if (tapDuration > TAP_MAX_DURATION_MS) {
        blockActions(250);
      }
    } else if (state === 'scroll' || state === 'drag') {
      blockActions();
    }

    gestureStartRef.current = null;
    setGestureState('idle');
  };

  const markScrollInteraction = () => {
    setGestureState('scroll');
    blockActions();
  };

  const shouldBlockAction = () => {
    const state = gestureStateRef.current;
    if (state === 'scroll' || state === 'drag') return true;
    return Date.now() < blockActionUntilRef.current;
  };

  const resetGestureMachine = () => {
    gestureStartRef.current = null;
    setGestureState('idle');
    blockActionUntilRef.current = 0;
  };

  const openEditor = () => {
    resetGestureMachine();
    setShowConfirmSave(false);
    setIsEditing(true);
  };

  const closeEditor = () => {
    resetGestureMachine();
    setShowConfirmSave(false);
    setIsEditing(false);
  };

  const runGuardedAction = (event: React.SyntheticEvent, action: () => void) => {
    event.stopPropagation();
    if (shouldBlockAction()) {
      event.preventDefault();
      return;
    }
    action();
  };

  useEffect(() => {
    if (!isEditing || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    // Lock page scroll only — do NOT set touch-action: none on body; that blocks
    // touch scrolling inside the modal (overflow-y) on mobile.
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isEditing]);

  useEffect(() => {
    if (!autoOpenEdit || !isLoggedIn || !shop.can_edit) return;
    openEditor();
    onAutoEditHandled?.();
  }, [autoOpenEdit, isLoggedIn, shop.can_edit, onAutoEditHandled]);

  // ✅ 关键修正：字段名与后端 shop.py 严格对应 (about_me, additional_price)
  const [editData, setEditData] = useState<ShopEdit>({
    ...shop,
    name: shop.name || '',
    address: shop.address || '',
    phone: shop.phone || '',
    lat: typeof shop.lat === 'number' ? shop.lat : 31.2304,
    lng: typeof shop.lng === 'number' ? shop.lng : 121.4737,
    pictures: Array.isArray(shop.pictures) ? [...shop.pictures] : [],
    new_girls_last_15_days: !!shop.new_girls_last_15_days,
    badge_text: shop.badge_text || '',
    
    // 👇 这里必须用 about_me 和 additional_price
    about_me: shop.about_me || '',
    additional_price: shop.additional_price || '',
    main_product: (shop as Shop & { main_product?: string }).main_product || '',
    filter_city: (shop as Shop & { filter_city?: string }).filter_city || '',
    min_spend:
      typeof (shop as Shop & { min_spend?: number }).min_spend === 'number' &&
      (shop as Shop & { min_spend?: number }).min_spend! > 0
        ? (shop as Shop & { min_spend?: number }).min_spend
        : undefined,

    newPictures: [],
    removePictureIds: [],
  });

  const editNameKey = (editData.name || '').trim().toLowerCase();
  const nameClashesWithOther =
    editNameKey.length > 0 && otherShopNamesLower.includes(editNameKey);

 const handleActionClick = (type: 'sms' | 'call' | 'profile', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (type === 'profile') {
      const slug = getShopSlug();
      navigate(slug ? `/shop/${slug}` : `/shop/${shop.id}`);
      return;
    }

    const phone = shop.phone || '';
    if (!phone) {
        alert('No phone number available');
        return;
    }

    // 2. 准备数据
    const apiUrl = import.meta.env.VITE_API_BASE_URL;
    const trackData = {
        shop_id: shop.id,
        type: type,
        phone: phone,
        address: shop.address || '',
        timestamp: new Date().toISOString()
    };

    // 3. 发送统计请求 (关键修复：加上 mode: 'cors')
    // 我们使用 .catch(() => {}) 来忽略错误，防止报错影响后续跳转
    const url = `${apiUrl}/track/action`;
    console.log(url);
    fetch(url, {
        method: 'POST',
        mode: 'cors', // 👈 强制开启跨域模式，告诉浏览器这是AJAX请求，不是导航
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(trackData)
    })
    .then(response => {
        if (!response.ok) {
            console.error('Tracking failed:', response.status);
        }
    })
    .catch(error => {
        console.error('Tracking error:', error);
    });

    // 4. 执行真正的跳转（发短信或打电话）
    // 注意：这里必须放在 fetch 之后，且不等待 fetch 完成
    if (type === 'sms') {
        const bodyText = encodeURIComponent(buildSmsMessage());
        window.location.href = `sms:${phone}?body=${bodyText}`;
    } else if (type === 'call') {
        window.location.href = `tel:${phone}`;
    }
};
     // ... 原有的 handleSave 代码 ...
  const handleSave = async () => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
    if (!API_BASE_URL) {
      alert('❌ 错误：API URL 未配置');
      return;
    }

    const formData = new FormData();
    formData.append('name', editData.name);
    formData.append('address', editData.address);
    formData.append('phone', editData.phone);
    formData.append('lat', String(editData.lat));
    formData.append('lng', String(editData.lng));
    
    // ✅ 关键修正：发送的 key 必须与后端 Flask request.form.get() 的 key 一致
    formData.append('about_me', editData.about_me || '');
    formData.append('additional_price', editData.additional_price || '');
    formData.append('main_product', editData.main_product || '');

    formData.append('badge_text', editData.badge_text || '');
    if (isAdmin) {
      formData.append('filter_city', editData.filter_city || '');
    }
    if (shop.can_edit) {
      const ms = editData.min_spend;
      formData.append('min_spend', ms != null && ms > 0 ? String(ms) : '');
    }
    formData.append('new_girls_last_15_days', editData.new_girls_last_15_days ? '1' : '0');
    formData.append('remove_picture_ids', editData.removePictureIds.join(','));

    editData.newPictures.forEach(file => {
      formData.append('pictures', file);
    });

    const url = `${API_BASE_URL}/shop/update/${shop.id}`;
    
    try {
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch(url, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData
      });
      const responseText = await res.text();

      if (!res.ok) {
        let errorMsg = `服务器拒绝请求 (Status: ${res.status})`;
        try {
          const jsonErr = JSON.parse(responseText);
          if (jsonErr.error) errorMsg = String(jsonErr.error);
          else if (jsonErr.message) errorMsg += `\n详情：${jsonErr.message}`;
          else if (jsonErr.details) errorMsg += `\n详情：${jsonErr.details}`;
        } catch (e) {
          /* plain text body */
        }
        alert(`❌ 更新失败:\n${errorMsg}`);
        return;
      }

      let updatedShop;
      try {
        updatedShop = JSON.parse(responseText);
      } catch (e) {
        throw new Error('服务器返回的数据不是有效的 JSON');
      }

      const fixedPictures = (updatedShop.pictures || []).map((pic: any) => {
        if (!pic.url) return pic;
        const fullUrl = pic.url.startsWith('http') ? pic.url : `${API_BASE_URL}${pic.url}`;
        return { ...pic, url: fullUrl };
      });

      const minSpendVal =
        updatedShop.min_spend != null &&
        Number(updatedShop.min_spend) >= 1 &&
        Number(updatedShop.min_spend) <= 4
          ? Number(updatedShop.min_spend)
          : undefined;
      const finalData = {
        ...updatedShop,
        pictures: fixedPictures,
        new_girls_last_15_days: editData.new_girls_last_15_days,
        badge_text: editData.badge_text || '',
        about_me: editData.about_me,
        additional_price: editData.additional_price,
        main_product: editData.main_product || '',
        filter_city: editData.filter_city || '',
        min_spend: minSpendVal,
      };

      onSave(finalData);
      setEditData(prev => ({ 
        ...prev, 
        pictures: fixedPictures, 
        newPictures: [], 
        removePictureIds: [],
        about_me: editData.about_me,
        additional_price: editData.additional_price,
        main_product: editData.main_product || '',
        filter_city: editData.filter_city || '',
        min_spend: minSpendVal,
      }));
      setIsEditing(false);
      setShowConfirmSave(false);
      
      setTimeout(() => alert('✅ 保存成功！'), 100);

    } catch (error) {
      console.error('💥 保存过程发生异常:', error);
      alert(`❌ 发生错误：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // ==========================================
  // ✅ 编辑模式 (Portal)
  // ==========================================
  if (isEditing && typeof document !== 'undefined') {
    const modalContent = (
      <>
        {/* No tap-to-dismiss: fast scroll often lands on backdrop and was closing the editor */}
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]" aria-hidden />

        <div
          className="fixed z-[99999] bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
          style={{
            top: '50%',
            left: '50%',
            width: '90%',
            maxWidth: '400px',
            transform: 'translate(-50%, -50%)',
            maxHeight: '85vh',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()} // 👈 【重要】防止点击弹窗白色区域本身触发冒泡
          onTouchStartCapture={(e) => {
            const touch = e.touches[0];
            if (!touch) return;
            markGestureStart(touch.clientX, touch.clientY);
          }}
          onTouchMoveCapture={(e) => {
            const touch = e.touches[0];
            if (!touch) return;
            markGestureMove(touch.clientX, touch.clientY);
          }}
          onTouchEndCapture={markGestureEnd}
          onTouchCancelCapture={markGestureEnd}
          onPointerDownCapture={(e) => {
            if (e.pointerType !== 'touch') return;
            markGestureStart(e.clientX, e.clientY);
          }}
          onPointerMoveCapture={(e) => {
            if (e.pointerType !== 'touch') return;
            markGestureMove(e.clientX, e.clientY);
          }}
          onPointerUpCapture={(e) => {
            if (e.pointerType !== 'touch') return;
            markGestureEnd();
          }}
          onPointerCancelCapture={(e) => {
            if (e.pointerType !== 'touch') return;
            markGestureEnd();
          }}
        >
          <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-2xl">
            <h3 className="font-bold text-lg text-gray-800">Edit Shop</h3>
            <button 
              onClick={(e) => {
                runGuardedAction(e, closeEditor);
              }}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div
            className="p-4 overflow-y-auto flex-1 min-h-0 overscroll-contain space-y-4 custom-scrollbar touch-pan-y"
          >
            {/* NAME */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">NAME</label>
              <input
                value={editData.name || ''}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                onClick={(e) => e.stopPropagation()} // 👈 已补全
                className={`w-full font-bold text-lg p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                  nameClashesWithOther ? 'ring-2 ring-amber-400' : ''
                }`}
                autoFocus
              />
              {nameClashesWithOther && (
                <p className="text-[11px] text-amber-700 font-semibold mt-1">
                  Another shop already uses this name (ignoring spaces and capitals). Save will be rejected until you change it.
                </p>
              )}
            </div>

            {/* ADDRESS */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">ADDRESS</label>
              <textarea
                value={editData.address || ''}
                onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                onClick={(e) => e.stopPropagation()} // 👈 已补全
                className="w-full text-sm p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                rows={2}
              />
            </div>

            {/* PHONE */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">PHONE</label>
              <input
                value={editData.phone || ''}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                className="w-full text-sm p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* MAIN PRODUCT */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">MAIN PRODUCT</label>
              <input
                type="text"
                value={editData.main_product || ''}
                onChange={(e) => setEditData({ ...editData, main_product: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder="e.g. Consumer electronics, textiles, machinery"
                className="w-full text-sm p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* ABOUT / CAPABILITIES */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">CAPABILITIES & NOTES</label>
              <textarea
                value={editData.about_me || ''}
                onChange={(e) => setEditData({ ...editData, about_me: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder="Equipment, certifications, production lines, export markets…"
                className="w-full text-sm p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                rows={3}
              />
            </div>

            {/* PRICING / TERMS */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">PRICING / LEAD TIME NOTES</label>
              <input
                type="text"
                value={editData.additional_price || ''}
                onChange={(e) => setEditData({ ...editData, additional_price: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder="e.g. FOB terms, typical lead time, tooling fees"
                className="w-full text-sm p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* ECONOMIC ZONE (admin only) */}
            {isAdmin && (
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">INDUSTRIAL ZONE</label>
                <select
                  value={editData.filter_city || ''}
                  onChange={(e) => setEditData({ ...editData, filter_city: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-sm p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">— Not set —</option>
                  {CHINA_ECONOMIC_ZONES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {shop.can_edit && (
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">MOQ / TRADE CAPACITY</label>
                <select
                  value={
                    editData.min_spend != null && editData.min_spend >= 1 && editData.min_spend <= 4
                      ? String(editData.min_spend)
                      : '0'
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    setEditData({
                      ...editData,
                      min_spend: v === '0' ? undefined : Number(v),
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-sm p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  {MOQ_TIER_FORM_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">Shown on the map card for overseas buyers</p>
              </div>
            )}

            {/* COORDINATES */}
            <div className="bg-gray-50 p-3 rounded-lg border">
              <label className="block text-xs font-bold text-gray-500 mb-1">COORDINATES</label>
              <input
                type="text"
                placeholder="Paste from Google Maps..."
                className="w-full px-3 py-2 text-sm border rounded-lg font-mono bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  const parts = value.split(/[,，\s]+/).filter(p => p !== '');
                  if (parts.length >= 2) {
                    const latNum = parseFloat(parts[0]);
                    const lngNum = parseFloat(parts[1]);
                    if (!isNaN(latNum) && !isNaN(lngNum)) {
                      setEditData({ ...editData, lat: latNum, lng: lngNum });
                      return;
                    }
                    const latDms = dmsToDecimal(parts[0]);
                    const lngDms = dmsToDecimal(parts[1]);
                    if (latDms !== null && lngDms !== null) {
                      setEditData({ ...editData, lat: latDms, lng: lngDms });
                    }
                  }
                }}
              />
              <p className="text-[10px] text-gray-400 mt-1 text-right">
                {editData.lat?.toFixed(4)}, {editData.lng?.toFixed(4)}
              </p>
            </div>

            {/* IMAGES */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">IMAGES</label>
              <label 
                className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Add Picture</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setEditData(prev => ({ ...prev, newPictures: [...prev.newPictures, file] }));
                    }
                    e.target.value = '';
                  }}
                />
              </label>
              
              <div className="mt-3 grid grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                {editData.pictures.map((pic, idx) => (
                  <div key={`old-${idx}`} className="relative aspect-square">
                    <img src={pic.url} alt="" className="w-full h-full object-cover rounded-lg border" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditData(prev => ({
                          ...prev,
                          pictures: prev.pictures.filter((_, i) => i !== idx),
                          removePictureIds: [...prev.removePictureIds, pic.id],
                        }));
                      }}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-sm hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {editData.newPictures.map((file, idx) => (
                  <div key={`new-${idx}`} className="relative aspect-square">
                    <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover rounded-lg border border-blue-400" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditData({ ...editData, newPictures: editData.newPictures.filter((_, i) => i !== idx) })
                      }}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-sm hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* CREDENTIALS (comma-separated English labels) */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">CREDENTIALS</label>
              <input
                type="text"
                value={editData.badge_text || ''}
                onChange={(e) => setEditData({ ...editData, badge_text: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder="e.g. Industry Leader, ISO 9001 Certified, Export Experience"
                disabled={!isAdmin}
                className={`w-full px-3 py-2 text-sm border rounded-lg outline-none ${
                  isAdmin
                    ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white'
                    : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              />
              {!isAdmin && (
                <p className="text-[10px] text-amber-600 mt-1">
                  Credentials are admin-only and cannot be changed by supplier users.
                </p>
              )}
              <p className="text-[10px] text-gray-500 mt-1">
                Use the buyer-facing phrases from the map filter (comma-separated), e.g. Industry Leader, OEM/ODM
                Specialist, Trade Assurance.
              </p>

              {editData.badge_text && editData.badge_text.trim() !== '' && (
                <div className="mt-3 flex flex-wrap gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider self-center mr-1">Preview:</span>
                  {editData.badge_text.split(',').map((tag, idx) => {
                    const t = tag.trim();
                    if (!t) return null;
                    const lower = t.toLowerCase();
                    const config = getTagStyle(lower);
                    const display = config.text || (t.charAt(0).toUpperCase() + t.slice(1));
                    
                    return (
                      <span 
                        key={idx} 
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black tracking-wide shadow-md ${config.bg}`}
                      >
                        {config.icon && <span className="text-base leading-none shrink-0 filter drop-shadow-sm">{config.icon}</span>}
                        <span className="whitespace-nowrap">{display}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Buttons */}
          <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex gap-3">
            <button
              onClick={(e) => {
                runGuardedAction(e, closeEditor);
              }}
              className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={nameClashesWithOther}
              onClick={(e) => {
                if (nameClashesWithOther) return;
                runGuardedAction(e, () => setShowConfirmSave(true));
              }}
              className={`flex-1 py-3 font-bold rounded-xl shadow-lg transition-all active:scale-95 ${
                nameClashesWithOther
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                  : 'bg-green-500 text-white hover:bg-green-600 shadow-green-200'
              }`}
            >
              Save Changes
            </button>
          </div>
        </div>

        {/* Confirm Modal */}
        {showConfirmSave && (
          <>
            <div
              className="fixed inset-0 bg-black/70 z-[100000]"
              onClick={(e) => {
                runGuardedAction(e, () => setShowConfirmSave(false));
              }}
            />
            <div 
              className="fixed z-[100001] bg-white rounded-2xl p-6 w-[90%] max-w-sm shadow-2xl"
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-lg font-bold text-gray-800 mb-2">Confirm Save?</h4>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to save changes to "<strong>{editData.name}</strong>"?
              </p>
              {nameClashesWithOther && (
                <p className="text-xs text-amber-700 font-semibold mb-3">
                  Fix the shop name first — it matches another listing.
                </p>
              )}
              <div className="flex gap-3">
                <button 
                  onClick={(e) => {
                    runGuardedAction(e, () => setShowConfirmSave(false));
                  }} 
                  className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  disabled={nameClashesWithOther}
                  onClick={(e) => {
                    if (nameClashesWithOther) return;
                    runGuardedAction(e, () => {
                      handleSave();
                    });
                  }} 
                  className={`flex-1 py-2 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    nameClashesWithOther
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  <Check className="w-4 h-4" /> Confirm
                </button>
              </div>
            </div>
          </>
        )}
      </>
    );

    return createPortal(modalContent, document.body);
  }

  // ==========================================
  // ✅ 展示模式
  // ==========================================
  return (
    <div
      onClick={onClick}
      className={`
        flex-shrink-0 w-[260px] bg-white rounded-2xl shadow-lg border overflow-hidden 
        transition-all duration-300 transform cursor-pointer relative group
        ${isSelected 
          ? 'border-rose-500 ring-4 ring-rose-200 bg-yellow-50 scale-[1.02]' 
          : 'border-gray-200 hover:shadow-xl hover:-translate-y-1'}
      `}
    >
      {/* 操作按钮 */}
      {isLoggedIn && shop.can_edit && (
        <div className="absolute top-2 right-2 z-50 flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openEditor(); }}
            className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm shadow-md hover:bg-blue-600 transition-colors"
          >
            ✏️
          </button>
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!deleting && window.confirm(`Delete "${shop.name}"?`)) onDelete(shop);
              }}
              disabled={deleting}
              className={`w-7 h-7 rounded-full flex items-center justify-center shadow-md text-sm transition-colors ${
                deleting ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600'
              }`}
            >
              {deleting ? '…' : '×'}
            </button>
          )}
        </div>
      )}

      {/* Credential badges */}
      {(() => {
        const ids = credentialIdsFromBadgeText(shop.badge_text);
        if (!ids.length) return null;
        return (
        <div className="absolute top-3 left-3 z-40 flex flex-wrap gap-2 max-w-[85%] pointer-events-none">
          {ids.map((id) => {
            const config = getTagStyle(id);
            const displayText = config.text || id;

            return (
              <span 
                key={id} 
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black tracking-wide shadow-lg backdrop-blur-sm ${config.bg}`}
              >
                {config.icon && <span className="text-lg leading-none shrink-0 filter drop-shadow-md">{config.icon}</span>}
                <span className="whitespace-nowrap">{displayText}</span>
              </span>
            );
          })}
        </div>
        );
      })()}

      {/* 图片区域 */}
      <div
        className="relative h-24 overflow-hidden bg-gray-100 select-none"
        style={{ 
          touchAction: 'pan-y', 
          WebkitOverflowScrolling: 'touch' 
        }}
        onClick={(e) => {
          if (shop.pictures && shop.pictures.length > 0) {
            onPreview?.(shop, 0);
          }
        }}
        onWheel={(e) => e.preventDefault()} 
      >
        <div className="flex gap-1 h-full p-1 w-full overflow-hidden pointer-events-none"> 
                    {shop.pictures && shop.pictures.length > 0 ? (
            shop.pictures.map((pic, idx) => {
              const rawUrl = pic.url;
              // 🔍 调试：打印原始 URL
              console.log(`[ShopCard] Raw URL ${idx}:`, rawUrl);

              let optimizedUrl = rawUrl;

              // 1️⃣ 如果是 http 开头，直接使用（CDN：Cloudinary、Cloudflare Images、等）
              if (rawUrl && rawUrl.startsWith('http')) {
                optimizedUrl = rawUrl;
              }
              // 2️⃣ Cloudflare Images delivery (defensive if ever stored relative)
              else if (rawUrl && rawUrl.includes('imagedelivery.net')) {
                optimizedUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl.replace(/^\/\//, '')}`;
              }
              // 3️⃣ Cloudinary 相对路径 (/upload/...)
              else if (rawUrl && rawUrl.includes('/upload/')) {
                const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
                if (cloudName) {
                  const baseUrl = `https://res.cloudinary.com/${cloudName}`;
                  const pathAfterUpload = rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl;
                  const transformParams = 'f_auto,q_auto,w_200,c_fill';
                  optimizedUrl = `${baseUrl}/image/upload/${transformParams}/${pathAfterUpload}`;
                } else {
                  console.warn('[ShopCard] Missing VITE_CLOUDINARY_CLOUD_NAME, falling back to API');
                  optimizedUrl = rawUrl;
                }
              }

              // 4️⃣ 其他相对路径 → API uploads
              if (!optimizedUrl.startsWith('http')) {
                const apiBase = import.meta.env.VITE_API_BASE_URL || '';
                const base = apiBase.endsWith('/') ? apiBase : `${apiBase}/`;
                const path = optimizedUrl.startsWith('/') ? optimizedUrl.slice(1) : optimizedUrl;
                optimizedUrl = `${base}uploads/${path}`;
              }

              // 5️⃣ 缓存破坏：仅对自管 API 路径；CDN URL 保持可缓存（利于 LCP/INP）
              const isCdn =
                optimizedUrl.includes('imagedelivery.net') ||
                optimizedUrl.includes('res.cloudinary.com');
              const finalUrl = isCdn
                ? optimizedUrl
                : `${optimizedUrl}${optimizedUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`;

              console.log(`[ShopCard] ✅ Final URL ${idx}:`, finalUrl);

              return (
                <div key={idx} className="w-24 h-full flex-shrink-0 relative rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={finalUrl}
                    alt={shop.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover pointer-events-auto transition-opacity duration-300 opacity-0"
                    onLoad={(e) => {
                      console.log(`[ShopCard] ✅ Loaded:`, finalUrl);
                      (e.target as HTMLImageElement).classList.remove('opacity-0');
                    }}
                    onError={(e) => {
                      console.error(`[ShopCard] ❌ Failed:`, finalUrl);
                      const target = e.target as HTMLImageElement;
                      // 显示简单的文字占位，方便调试
                      target.style.background = '#e5e7eb';
                      target.style.display = 'flex';
                      target.style.alignItems = 'center';
                      target.style.justifyContent = 'center';
                      target.style.fontSize = '10px';
                      target.style.color = '#6b7280';
                      target.src = ''; 
                      target.innerText = 'IMG ERR'; 
                      target.classList.remove('opacity-0');
                    }}
                  />
                </div>
              );
            })
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-medium bg-gray-50 pointer-events-none">
              No Image
            </div>
          )} 
      </div>
    </div>

      {/* 底部信息区 */}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2 min-h-[1.25rem] pr-6">
          <h3 className="font-bold text-gray-900 text-base truncate min-w-0 flex-1">{shop.name}</h3>
          {shop.filter_city?.trim() ? (
            <span
              className="shrink-0 max-w-[45%] truncate rounded-md border border-rose-200/90 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-rose-700 sm:text-[11px]"
              title={shop.filter_city.trim()}
            >
              {shop.filter_city.trim()}
            </span>
          ) : null}
        </div>
        {shop.main_product?.trim() ? (
          <p className="text-[10px] font-semibold text-slate-700 sm:text-[11px]">
            Main product: {shop.main_product.trim()}
          </p>
        ) : null}
        {shop.min_spend != null && shop.min_spend >= 1 && shop.min_spend <= 4 && (
          <p className="text-[10px] font-semibold text-gray-600 sm:text-[11px]">
            {moqTierLabel(shop.min_spend)}
          </p>
        )}
        <div className="flex items-start gap-1.5 text-gray-500 text-xs leading-tight min-h-[2rem] overflow-hidden">
          <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5 text-rose-400" />
          <p className="line-clamp-2" title={shop.address}>
            {shop.address}
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={(e) => handleActionClick('profile', e)}
            className="flex-1 border border-rose-500 text-rose-600 hover:bg-rose-50 font-semibold py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            <span>View Profile</span>
          </button>
          <button
            type="button"
            onClick={(e) => handleActionClick('sms', e)}
            className="flex-1 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-semibold py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors text-sm"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Contact Supplier</span>
          </button>

          <button
            type="button"
            onClick={(e) => handleActionClick('call', e)}
            className="bg-gray-100 hover:bg-gray-200 p-2 rounded-xl text-gray-600 transition-colors shrink-0"
            aria-label="Call supplier"
          >
            <Phone className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShopCard;