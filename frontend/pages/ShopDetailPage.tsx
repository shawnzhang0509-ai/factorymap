// src/pages/ShopDetailPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shop } from '../components/types';
import { ArrowLeft, MapPin, Phone, ExternalLink, Share2, Info, DollarSign } from 'lucide-react';
// ✅ 引入新的图片组件
import ImageGallery from '../components/ImageGallery'; 

import { getApiBaseUrl } from '../config/api';

const API_BASE_URL = getApiBaseUrl();

const ShopDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  const handleShare = async () => {
    const currentUrl = window.location.href;
    const shopName = shop?.name || 'This factory';

    if (navigator.share) {
      try {
        await navigator.share({
          title: shopName,
          text: `View ${shopName} on China Factory Map — verified supplier profile.`,
          url: currentUrl,
        });
        return; 
      } catch (err) {
        console.log('Share canceled or failed', err);
      }
    }

    try {
      await navigator.clipboard.writeText(currentUrl);
      alert('✅ Link copied to clipboard!');
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = currentUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('✅ Link copied!');
    }
  };

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    const fetchShop = async () => {
      try {
        const token = localStorage.getItem('auth_token') || '';
        const detailUrl = `${API_BASE_URL}/shop/detail/${encodeURIComponent(slug)}`;
        const res = await fetch(detailUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (res.ok) {
          const raw = await res.json();
          const pictures =
            raw.pictures?.map((pic: any) => ({
              ...pic,
              url:
                pic.url && pic.url.startsWith('/files/')
                  ? `${API_BASE_URL}${pic.url}`
                  : pic.url,
            })) || [];
          setShop({ ...raw, pictures } as Shop);
          return;
        }
        if (res.status === 404) {
          setShop(null);
          return;
        }
        // Fallback for older backends without /shop/detail
        const listRes = await fetch(`${API_BASE_URL}/shops`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data = await listRes.json();
        const found = data.find((s: any) => {
          const generatedSlug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          return generatedSlug === slug || s.id.toString() === slug;
        });
        if (found) {
          const pictures =
            found.pictures?.map((pic: any) => ({
              ...pic,
              url:
                pic.url && pic.url.startsWith('/files/')
                  ? `${API_BASE_URL}${pic.url}`
                  : pic.url,
            })) || [];
          setShop({ ...found, pictures } as Shop);
        } else {
          setShop(null);
        }
      } catch (e) {
        console.error('Fetch error:', e);
        setShop(null);
      } finally {
        setLoading(false);
      }
    };
    fetchShop();
  }, [slug]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-rose-500 font-bold text-lg animate-pulse">Loading details...</div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Factory not found</h2>
        <p className="text-gray-500 mb-4">The factory you are looking for does not exist or has been removed.</p>
        <button onClick={() => navigate('/')} className="mt-4 px-6 py-2 bg-rose-500 text-white rounded-full font-bold text-sm hover:bg-rose-600 transition">Back to Map</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <button onClick={() => navigate('/')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition">
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <span className="font-bold text-gray-800 truncate max-w-[60%]">{shop.name}</span>
        <button 
          onClick={handleShare} 
          className="p-2 -mr-2 hover:bg-gray-100 rounded-full transition active:scale-95"
          aria-label="Share this factory"
        >
          <Share2 size={20} className="text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-10">
        
        {/* ✅ 使用新的 ImageGallery 组件 */}
        <ImageGallery 
          pictures={shop.pictures || []} 
          baseUrl={API_BASE_URL}
          altText={shop.name}
          badgeText={shop.badge_text}
          autoPlay={true}  // 👈 必须有这一行
        />

        {/* Info Card */}
        <div className="bg-white -mt-6 relative rounded-t-3xl px-6 pt-8 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{shop.name}</h1>
          {shop.main_product?.trim() ? (
            <p className="text-sm font-semibold text-slate-600 mb-4">
              Main product: <span className="text-slate-900">{shop.main_product.trim()}</span>
            </p>
          ) : null}

          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1">
              Verified supplier listing
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
              <div className="p-2 bg-white rounded-full shadow-sm text-rose-500">
                <MapPin size={20} />
              </div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Location</span>
              <p className="text-sm text-gray-700 line-clamp-2 leading-tight font-medium">{shop.address || 'Address not available'}</p>
            </div>
            
            {shop.phone && (
              <div className="bg-gray-50 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                <a href={`tel:${shop.phone}`} className="p-2 bg-white rounded-full shadow-sm text-rose-500 w-fit">
                  <Phone size={20} />
                </a>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Call supplier</span>
                <p className="text-sm text-gray-700 font-bold">{shop.phone}</p>
              </div>
            )}
          </div>

          {shop.about_me && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Info size={18} className="text-rose-500" />
                <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide">Factory profile</h3>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
                {shop.about_me}
              </p>
            </div>
          )}

          {shop.additional_price && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={18} className="text-green-600" />
                <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide">Commercial terms</h3>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line bg-green-50/50 p-4 rounded-2xl border border-green-100 font-medium">
                {shop.additional_price}
              </p>
            </div>
          )}

          {shop.description && (
            <div className="mb-8">
              <h3 className="font-bold text-gray-900 mb-2 text-sm uppercase tracking-wide">Description</h3>
              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                {shop.description}
              </p>
            </div>
          )}

          <button 
            onClick={() => navigate(`/?lat=${shop.lat}&lng=${shop.lng}&focus=${shop.id}`)}
            className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition shadow-lg flex items-center justify-center gap-2 active:scale-95 transform duration-100 text-sm uppercase tracking-wide"
          >
            <MapPin size={18} />
            <span>View on Map</span>
            <ExternalLink size={16} className="opacity-70" />
          </button>
          
          <div className="mt-4 text-center">
             <button onClick={() => navigate('/')} className="text-xs text-gray-400 hover:text-gray-600 font-medium underline">
               Back to Browse
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopDetailPage;