import React, { useState } from 'react';
import { X, Upload, Info, DollarSign, MapPin } from 'lucide-react';
import { ShopCreate, Shop } from './types';
import { REGION_OPTIONS } from '../constants/filterRegions';
import { MIN_SPEND_OPTIONS } from '../constants/minSpend';

interface AdminPanelProps {
  onAddShop: (shop: Shop) => void;
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onAddShop, onClose }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [newShop, setNewShop] = useState<Partial<ShopCreate>>({
    name: '',
    address: '',
    phone: '',
    lat: -36.8485,
    lng: 174.7633,
    new_girls_last_15_days: false,
    badge_text: '',
    pictures: [],
    // 🔥 初始化新字段
    about_me: '',
    additional_price: '',
    filter_city: '',
    min_spend: undefined,
  });

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShop.name || !newShop.address || !newShop.phone || !newShop.lat || !newShop.lng) {
      setError("Please fill in all required fields (Name, Address, Phone, Location).");
      return;
    }

    setIsSubmitting(true); 
    setError('');

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
    const add_api_url = `${API_BASE_URL}/shop/add`;
    const formData = new FormData();
    
    formData.append("name", newShop.name!);
    formData.append("address", newShop.address!);
    formData.append("phone", newShop.phone!);
    formData.append("lat", String(newShop.lat));
    formData.append("lng", String(newShop.lng));
    
    const tagsString = tags.join(",");
    formData.append("badge_text", tagsString); 
    
    formData.append("new_girls_last_15_days", String(newShop.new_girls_last_15_days || false));

    // 🔥 添加新字段到 FormData
    if (newShop.about_me) {
      formData.append("about_me", newShop.about_me);
    }
    if (newShop.additional_price) {
      formData.append("additional_price", newShop.additional_price);
    }
    if ((newShop.filter_city || '').trim()) {
      formData.append("filter_city", (newShop.filter_city || '').trim());
    }
    if (newShop.min_spend != null && newShop.min_spend > 0) {
      formData.append("min_spend", String(newShop.min_spend));
    }

    (newShop.pictures as File[] | undefined)?.forEach(file => {
      if (file instanceof File) formData.append("pictures", file);
    });

    try {
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch(add_api_url, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData
      });
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Failed to add shop. Please try again.");
        setIsSubmitting(false);
        return;
      }

      onAddShop(result);

      // Reset Form
      setNewShop({
        name: '',
        address: '',
        phone: '',
        lat: -36.8485,
        lng: 174.7633,
        new_girls_last_15_days: false,
        badge_text: '',
        pictures: [],
        about_me: '',
        additional_price: '',
        filter_city: '',
        min_spend: undefined,
      });
      setTags([]);
      setTagInput("");
      onClose();

    } catch (err) {
      setError("Network error. Please check your connection.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setNewShop(prev => ({ ...prev, pictures: [...(prev.pictures as any[]), ...Array.from(files)] }));
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">Add New Shop</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto no-scrollbar">
          <div className="space-y-4">
            
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-100">
                {error}
              </div>
            )}

            {/* Shop Name */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Shop Name *</label>
              <input
                required
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                value={newShop.name}
                onChange={e => setNewShop({ ...newShop, name: e.target.value })}
                placeholder="e.g. Relaxation Spa"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Full Address *</label>
              <input
                required
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                value={newShop.address}
                onChange={e => setNewShop({ ...newShop, address: e.target.value })}
                placeholder="Street address for SMS template"
              />
            </div>

            {/* Tags / Badges */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Tags / Badges
              </label>
              <div 
                className={`
                  flex flex-wrap items-center gap-2 
                  w-full px-3 py-2 
                  bg-gray-50 border-2 
                  rounded-xl 
                  transition-all outline-none
                  ${tagInput ? 'border-rose-500 ring-2 ring-rose-100' : 'border-transparent focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-100'}
                `}
              >
                {tags.map((tag, idx) => (
                  <span 
                    key={idx} 
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 text-xs font-bold animate-in fade-in zoom-in duration-200"
                  >
                    {tag}
                    <button 
                      type="button" 
                      onClick={() => setTags(tags.filter(t => t !== tag))}
                      className="hover:bg-rose-200 rounded-full p-0.5 transition-colors"
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = tagInput.trim();
                      if (val && !tags.includes(val)) {
                        setTags([...tags, val]);
                        setTagInput("");
                      }
                    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                      setTags(tags.slice(0, -1));
                    }
                  }}
                  placeholder={tags.length === 0 ? "Type & Enter (e.g. 24h, Thai)" : ""}
                  className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400 py-1"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1 ml-1">Press Enter to add, Backspace to remove last.</p>
            </div>

            {/* Coordinates */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Coordinates (Paste from Google Maps) *
              </label>
             <input
              type="text"
              placeholder="e.g. 36°55'33.2S 174°48'09.5E"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-rose-500 outline-none transition-all font-mono text-sm"
              onChange={(e) => {
                const value = e.target.value;
                const parts = value.split(/\s+/).filter(p => p.trim());
                if (parts.length >= 2) {
                  const latDec = parseFloat(parts[0]);
                  const lngDec = parseFloat(parts[1]);
                  if (!isNaN(latDec) && !isNaN(lngDec)) {
                    setNewShop(prev => ({ ...prev, lat: latDec, lng: lngDec }));
                  }
                }
              }}
            />
              {newShop.lat && newShop.lng && (
                <p className="text-xs text-green-600 font-bold mt-1 flex items-center gap-1">
                  ✓ Parsed: {newShop.lat.toFixed(6)}, {newShop.lng.toFixed(6)}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Phone Number *</label>
              <input
                required
                type="tel"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                value={newShop.phone}
                onChange={e => setNewShop({ ...newShop, phone: e.target.value })}
                placeholder="Mobile number for SMS"
              />
            </div>

            {/* Map region (home filter chips) */}
            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <MapPin size={14} /> Map region
              </label>
              <select
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none text-sm text-gray-800"
                value={newShop.filter_city || ''}
                onChange={(e) => setNewShop({ ...newShop, filter_city: e.target.value })}
              >
                <option value="">Not set</option>
                {REGION_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <DollarSign size={14} /> Min. spend (entry, NZD)
              </label>
              <select
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none text-sm text-gray-800"
                value={newShop.min_spend != null && newShop.min_spend > 0 ? String(newShop.min_spend) : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setNewShop({ ...newShop, min_spend: v ? Number(v) : undefined });
                }}
              >
                <option value="">Not set</option>
                {MIN_SPEND_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    ${n}
                  </option>
                ))}
              </select>
            </div>

            {/* 🔥 NEW: About Me */}
            <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
              <label className="block text-xs font-bold text-rose-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Info size={14} /> About Me / Therapist Intro
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 focus:ring-2 focus:ring-rose-500 outline-none transition-all text-sm text-gray-700 resize-none"
                value={newShop.about_me}
                onChange={e => setNewShop({ ...newShop, about_me: e.target.value })}
                placeholder="Hi, I'm Sarah. Specializing in deep tissue..."
              />
              <p className="text-[10px] text-rose-400 mt-1">Displayed in a highlighted box on the detail page.</p>
            </div>

            {/* 🔥 NEW: Additional Price */}
            <div className="bg-green-50/50 p-4 rounded-2xl border border-green-100">
              <label className="block text-xs font-bold text-green-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                <DollarSign size={14} /> Additional Price Info
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-white border border-green-200 focus:ring-2 focus:ring-green-500 outline-none transition-all text-sm text-gray-700 resize-none"
                value={newShop.additional_price}
                onChange={e => setNewShop({ ...newShop, additional_price: e.target.value })}
                placeholder={`Extra 30 mins: $50\nOil upgrade: $10`}
              />
              <p className="text-[10px] text-green-500 mt-1">Use Enter for new lines. Displayed in a green box.</p>
            </div>

            {/* New Badge Checkbox */}
            <label className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer border border-transparent hover:border-gray-200">
              <input
                type="checkbox"
                className="w-5 h-5 accent-rose-500 rounded"
                checked={newShop.new_girls_last_15_days}
                onChange={e => setNewShop({ ...newShop, new_girls_last_15_days: e.target.checked })}
              />
              <span className="text-sm font-semibold text-gray-700">Display 🆕 "New" Badge</span>
            </label>

            {/* Photos */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Photos</label>
              <div className="flex gap-2 flex-wrap mb-2">
                {(newShop.pictures as File[] | undefined)?.map((file, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={file instanceof File ? URL.createObjectURL(file) : typeof file === 'string' ? file : ''}
                      className="w-16 h-16 object-cover rounded-lg border border-gray-100 shadow-sm"
                      alt="preview"
                    />
                  </div>
                ))}
              </div>
              <label className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:text-rose-500 hover:border-rose-500 hover:bg-rose-50 transition-all cursor-pointer">
                <Upload className="w-5 h-5" />
                <span className="text-sm font-medium">Upload Images</span>
                <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full bg-rose-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-rose-200 active:scale-95 transition-transform sticky bottom-0
              ${isSubmitting ? 'opacity-70 cursor-not-allowed bg-gray-400 shadow-none' : 'hover:bg-rose-600'}`}
          >
            {isSubmitting ? "Saving to Database..." : "Add Shop"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminPanel;