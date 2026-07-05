import React, { useState } from 'react';
import { X, Upload, Info, DollarSign, MapPin, Navigation } from 'lucide-react';
import { ShopCreate, Shop } from './types';
import { MBTI_TYPES } from '../constants/mbtiTypes';
import { LOOKING_FOR_OPTIONS } from '../constants/socialTags';
import { getApiBaseUrl } from '../config/api';
import { UI } from '../constants/i18n';
import { SELECTABLE_REGIONS } from '../constants/filterRegions';
import { geocodeAddressWithOffset } from '../utils/geocode';

interface AdminPanelProps {
  onAddShop: (shop: Shop) => void;
  onClose: () => void;
  /** Lowercase trimmed names of existing shops (duplicate name blocked server-side too) */
  existingShopNamesLower?: string[];
}

const AdminPanel: React.FC<AdminPanelProps> = ({
  onAddShop,
  onClose,
  existingShopNamesLower = [],
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [newShop, setNewShop] = useState<Partial<ShopCreate>>({
    name: '',
    address: '',
    phone: '',
    lat: 31.2304,
    lng: 121.4737,
    new_girls_last_15_days: false,
    badge_text: '',
    pictures: [],
    about_me: '',
    additional_price: '',
    filter_city: '',
    min_spend: undefined,
    main_product: '',
  });

  const [mbtiType, setMbtiType] = useState<string>('ENFP');
  const [lookingFor, setLookingFor] = useState<string[]>(['friends']);
  const [coordInput, setCoordInput] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [coordsFromAddress, setCoordsFromAddress] = useState(false);
  const [geocodeMessage, setGeocodeMessage] = useState('');

  const nameKey = (newShop.name || '').trim().toLowerCase();
  const nameDuplicate =
    nameKey.length > 0 && existingShopNamesLower.includes(nameKey);

  const handleGeocodeFromAddress = async () => {
    const address = (newShop.address || '').trim();
    if (address.length < 2) {
      setGeocodeMessage(UI.geocodeFailed);
      return;
    }
    setGeocoding(true);
    setGeocodeMessage('');
    try {
      const result = await geocodeAddressWithOffset(address);
      setNewShop((prev) => ({ ...prev, lat: result.lat, lng: result.lng }));
      setCoordInput(`${result.lat.toFixed(6)} ${result.lng.toFixed(6)}`);
      setCoordsFromAddress(true);
      setGeocodeMessage(UI.geocodeSuccess(result.offset_km));
    } catch (err) {
      setGeocodeMessage(err instanceof Error ? err.message : UI.geocodeFailed);
      setCoordsFromAddress(false);
    } finally {
      setGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShop.name || !newShop.address || !newShop.phone || !mbtiType) {
      setError(UI.requiredFields);
      return;
    }
    if (nameDuplicate) {
      setError(UI.nameTaken);
      return;
    }

    setIsSubmitting(true);
    setError('');

    let lat = newShop.lat;
    let lng = newShop.lng;
    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
      try {
        const result = await geocodeAddressWithOffset(newShop.address!.trim());
        lat = result.lat;
        lng = result.lng;
      } catch (err) {
        setError(err instanceof Error ? err.message : UI.requiredCoords);
        setIsSubmitting(false);
        return;
      }
    }
    const API_BASE_URL = getApiBaseUrl();
    const add_api_url = `${API_BASE_URL}/shop/add`;
    const formData = new FormData();

    formData.append('name', newShop.name!);
    formData.append('address', newShop.address!);
    formData.append('phone', newShop.phone!);
    formData.append('lat', String(lat));
    formData.append('lng', String(lng));
    formData.append('badge_text', mbtiType);
    formData.append('additional_price', lookingFor.join(','));
    formData.append('new_girls_last_15_days', String(newShop.new_girls_last_15_days || false));

    if (newShop.about_me) {
      formData.append('about_me', newShop.about_me);
    }
    if ((newShop.filter_city || '').trim()) {
      formData.append('filter_city', (newShop.filter_city || '').trim());
    }
    if (newShop.main_product?.trim()) {
      formData.append('main_product', newShop.main_product.trim());
    }
    if (newShop.min_spend != null && newShop.min_spend >= 16) {
      formData.append('min_spend', String(newShop.min_spend));
    }

    (newShop.pictures as File[] | undefined)?.forEach((file) => {
      if (file instanceof File) formData.append('pictures', file);
    });

    try {
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch(add_api_url, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const result = await res.json();

      if (!res.ok) {
        setError(
          result.error ||
            (res.status === 409
              ? UI.nameTaken
              : UI.addFailed)
        );
        setIsSubmitting(false);
        return;
      }

      onAddShop(result);

      setNewShop({
        name: '',
        address: '',
        phone: '',
        lat: 31.2304,
        lng: 121.4737,
        new_girls_last_15_days: false,
        badge_text: '',
        pictures: [],
        about_me: '',
        additional_price: '',
        filter_city: '',
        min_spend: undefined,
        main_product: '',
      });
      setMbtiType('ENFP');
      setLookingFor(['friends']);
      setCoordInput('');
      setCoordsFromAddress(false);
      setGeocodeMessage('');
      onClose();
    } catch (err) {
      setError(UI.networkError);
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setNewShop((prev) => ({ ...prev, pictures: [...(prev.pictures as File[]), ...Array.from(files)] }));
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">{UI.addProfile}</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto no-scrollbar">
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-100">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{UI.displayName} *</label>
              <input
                required
                className={`w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-violet-500 outline-none transition-all ${
                  nameDuplicate ? 'ring-2 ring-amber-400' : ''
                }`}
                value={newShop.name}
                onChange={(e) => setNewShop({ ...newShop, name: e.target.value })}
                placeholder="e.g. Alex, 小雨"
              />
              {nameDuplicate && (
                <p className="text-[11px] text-amber-700 font-semibold mt-1">
                  {UI.nameDuplicateHint}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{UI.location} *</label>
              <input
                required
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                value={newShop.address}
                onChange={(e) => {
                  setNewShop({ ...newShop, address: e.target.value });
                  setCoordsFromAddress(false);
                  setGeocodeMessage('');
                }}
                placeholder={UI.addressPlaceholder}
              />
              <button
                type="button"
                onClick={() => void handleGeocodeFromAddress()}
                disabled={geocoding || !(newShop.address || '').trim()}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Navigation className="w-3.5 h-3.5" />
                {geocoding ? UI.geocoding : UI.geocodeFromAddress}
              </button>
              <p className="text-[10px] text-gray-500 mt-1.5 leading-snug">{UI.geocodeHint}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{UI.mbtiType} *</label>
              <select
                required
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-violet-500 outline-none transition-all"
                value={mbtiType}
                onChange={(e) => setMbtiType(e.target.value)}
              >
                {MBTI_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{UI.lookingFor}</label>
              <div className="flex flex-wrap gap-2">
                {LOOKING_FOR_OPTIONS.map((opt) => {
                  const on = lookingFor.includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() =>
                        setLookingFor((prev) =>
                          on ? prev.filter((k) => k !== opt.key) : [...prev, opt.key]
                        )
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                        on ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-700 border-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                {UI.coordinates} {UI.coordsOptional}
              </label>
              <input
                type="text"
                value={coordInput}
                placeholder="31.230416 121.473701"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-rose-500 outline-none transition-all font-mono text-sm"
                onChange={(e) => {
                  const value = e.target.value;
                  setCoordInput(value);
                  setCoordsFromAddress(false);
                  setGeocodeMessage('');
                  const parts = value.split(/\s+/).filter((p) => p.trim());
                  if (parts.length >= 2) {
                    const latDec = parseFloat(parts[0]);
                    const lngDec = parseFloat(parts[1]);
                    if (!isNaN(latDec) && !isNaN(lngDec)) {
                      setNewShop((prev) => ({ ...prev, lat: latDec, lng: lngDec }));
                    }
                  }
                }}
              />
              {newShop.lat != null && newShop.lng != null && !coordsFromAddress && coordInput && (
                <p className="text-xs text-green-600 font-bold mt-1 flex items-center gap-1">
                  {UI.parsedCoords(newShop.lat, newShop.lng)}
                </p>
              )}
              {geocodeMessage && (
                <p className={`text-xs font-semibold mt-1 ${coordsFromAddress ? 'text-green-600' : 'text-amber-700'}`}>
                  {geocodeMessage}
                </p>
              )}
              {newShop.lat != null && newShop.lng != null && coordsFromAddress && (
                <p className="text-xs text-green-600 font-bold mt-1">
                  {UI.parsedCoords(newShop.lat, newShop.lng)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{UI.phone} *</label>
              <input
                required
                type="tel"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                value={newShop.phone}
                onChange={(e) => setNewShop({ ...newShop, phone: e.target.value })}
                placeholder="WeChat / mobile for connecting"
              />
            </div>

            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <MapPin size={14} /> {UI.region}
              </label>
              <select
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-violet-500 outline-none text-sm text-gray-800"
                value={newShop.filter_city || ''}
                onChange={(e) => setNewShop({ ...newShop, filter_city: e.target.value })}
              >
                <option value="">{UI.selectRegion}</option>
                {SELECTABLE_REGIONS.map((r) => (
                  <option key={r.key} value={r.label}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <DollarSign size={14} /> {UI.age}{UI.optional}
              </label>
              <input
                type="number"
                min={16}
                max={99}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-violet-500 outline-none text-sm text-gray-800"
                value={newShop.min_spend ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setNewShop({ ...newShop, min_spend: v ? Number(v) : undefined });
                }}
                placeholder="e.g. 25"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{UI.interests}</label>
              <input
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-violet-500 outline-none transition-all"
                value={newShop.main_product || ''}
                onChange={(e) => setNewShop({ ...newShop, main_product: e.target.value })}
                placeholder="e.g. Coffee, hiking, photography"
              />
            </div>

            <div className="bg-violet-50/50 p-4 rounded-2xl border border-violet-100">
              <label className="block text-xs font-bold text-violet-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Info size={14} /> {UI.aboutMe}
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-white border border-violet-200 focus:ring-2 focus:ring-violet-500 outline-none transition-all text-sm text-gray-700 resize-none"
                value={newShop.about_me}
                onChange={(e) => setNewShop({ ...newShop, about_me: e.target.value })}
                placeholder="A short intro — hobbies, vibe, what you are like…"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{UI.photos}</label>
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
                <span className="text-sm font-medium">{UI.uploadImages}</span>
                <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full bg-violet-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-violet-200 active:scale-95 transition-transform sticky bottom-0
              ${isSubmitting ? 'opacity-70 cursor-not-allowed bg-gray-400 shadow-none' : 'hover:bg-violet-700'}`}
          >
            {isSubmitting ? UI.saving : UI.addProfile}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminPanel;
