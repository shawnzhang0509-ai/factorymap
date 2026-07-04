import React, { useState, useRef } from 'react';
import { X, Upload, Info, DollarSign, MapPin, Table2, Download } from 'lucide-react';
import { ShopCreate, Shop } from './types';
import { MBTI_TYPES } from '../constants/mbtiTypes';
import { LOOKING_FOR_OPTIONS } from '../constants/socialTags';
import { getApiBaseUrl } from '../config/api';

interface AdminPanelProps {
  onAddShop: (shop: Shop) => void;
  onClose: () => void;
  /** Lowercase trimmed names of existing shops (duplicate name blocked server-side too) */
  existingShopNamesLower?: string[];
  /** After bulk Excel import, parent can merge `created` into map state. */
  onBulkShopsImported?: (shops: Shop[]) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({
  onAddShop,
  onClose,
  existingShopNamesLower = [],
  onBulkShopsImported,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);
  const [bulkImportOk, setBulkImportOk] = useState<boolean | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const bulkSummaryRef = useRef<HTMLPreElement>(null);

  const revealBulkSummary = () => {
    requestAnimationFrame(() => {
      bulkSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };
  
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

  const nameKey = (newShop.name || '').trim().toLowerCase();
  const nameDuplicate =
    nameKey.length > 0 && existingShopNamesLower.includes(nameKey);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShop.name || !newShop.address || !newShop.phone || !newShop.lat || !newShop.lng || !mbtiType) {
      setError('Please fill in all required fields (Display name, Location, Phone, Coordinates, MBTI type).');
      return;
    }
    if (nameDuplicate) {
      setError('This display name is already used. Please choose a different name.');
      return;
    }

    setIsSubmitting(true); 
    setError('');

    const API_BASE_URL = getApiBaseUrl();
    const add_api_url = `${API_BASE_URL}/shop/add`;
    const formData = new FormData();
    
    formData.append("name", newShop.name!);
    formData.append("address", newShop.address!);
    formData.append("phone", newShop.phone!);
    formData.append("lat", String(newShop.lat));
    formData.append("lng", String(newShop.lng));
    
    formData.append("badge_text", mbtiType);
    formData.append("additional_price", lookingFor.join(','));

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
    if (newShop.main_product?.trim()) {
      formData.append('main_product', newShop.main_product.trim());
    }
    if (newShop.min_spend != null && newShop.min_spend >= 16) {
      formData.append('min_spend', String(newShop.min_spend));
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
        setError(
          result.error ||
            (res.status === 409
              ? 'This display name is already in use.'
              : 'Failed to add profile. Please try again.')
        );
        setIsSubmitting(false);
        return;
      }

      onAddShop(result);

      // Reset Form
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

  const downloadBulkTemplate = async () => {
    setBulkSummary(null);
    setBulkImportOk(null);
    setError('');
    const base = getApiBaseUrl();
    setBulkLoading(true);
    try {
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch(`${base}/shop/bulk-import-template`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error || 'Failed to download template');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'factory_bulk_import_template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setError('Network error downloading template');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkExcelSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBulkSummary(null);
    setBulkImportOk(null);
    setError('');
    const base = getApiBaseUrl();
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Please choose a .xlsx file');
      return;
    }
    setBulkLoading(true);
    try {
      const token = localStorage.getItem('auth_token') || '';
      const fd = new FormData();
      fd.append('file', file);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 120000);
      const res = await fetch(`${base}/shop/bulk-import-excel`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      const rawText = await res.text();
      let result: {
        error?: string;
        summary?: { created_count?: number; skipped_count?: number; error_count?: number };
        errors?: { row: number; message: string }[];
        created?: Shop[];
      };
      try {
        result = JSON.parse(rawText);
      } catch {
        setError(
          res.ok
            ? 'Import failed: server returned an invalid response.'
            : `Import failed (HTTP ${res.status}). The backend may still be waking up — wait 1 minute and try again.`
        );
        setBulkImportOk(false);
        return;
      }

      if (!res.ok) {
        setError(result.error || `Import failed (HTTP ${res.status})`);
        setBulkImportOk(false);
        return;
      }
      const createdCount = result.summary?.created_count ?? 0;
      const skippedCount = result.summary?.skipped_count ?? 0;
      const errorCount = result.summary?.error_count ?? 0;

      let dbCount: number | null = null;
      try {
        const countRes = await fetch(`${base}/shop/shops/count`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (countRes.ok) {
          const countData = await countRes.json();
          dbCount = typeof countData.count === 'number' ? countData.count : null;
        }
      } catch {
        /* server may still be waking up */
      }

      const lines = [
        `API server: ${base}`,
        dbCount != null
          ? `Database total: ${dbCount} factories`
          : 'Database total: could not verify (server slow or offline)',
        `Created: ${createdCount}`,
        `Skipped (duplicate name): ${skippedCount}`,
        `Errors: ${errorCount}`,
      ];
      if (result.errors?.length) {
        const parts = (result.errors as { row: number; message: string }[])
          .slice(0, 5)
          .map((x) => `row ${x.row}: ${x.message}`);
        lines.push(`First errors: ${parts.join('; ')}`);
      }
      if (createdCount === 0) {
        lines.push('');
        if (skippedCount > 0) {
          lines.push('No new rows saved — these factory names already exist in the database.');
        } else if (errorCount > 0) {
          lines.push('No rows saved — fix the Excel errors above and try again.');
        } else {
          lines.push('No new factories were added (empty file or no valid rows).');
        }
        lines.push('Other devices only see data stored on the server. Hard-refresh this page to confirm.');
        setBulkImportOk(false);
      } else {
        lines.push('');
        lines.push(
          `${createdCount} factories saved to the server. Mobile should see them after refresh (wait ~1 min if backend is waking up).`
        );
        setBulkImportOk(true);
      }
      setBulkSummary(lines.join('\n'));
      revealBulkSummary();
      const created = result.created;
      if (created?.length && onBulkShopsImported) {
        onBulkShopsImported(created);
      }
    } catch (err) {
      console.error(err);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Import timed out after 2 minutes. The server may still be waking up — wait and try again.');
      } else {
        setError('Network error during import. Check your connection and try again.');
      }
      setBulkImportOk(false);
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">Add profile</h2>
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

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <Table2 size={14} /> Bulk import (Excel)
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Upload your industrial-belt sheet as-is when headers include{' '}
                <span className="font-mono text-slate-700">企业名称, 详细地址, 联系电话, 纬度, 经度</span>
                (or English <span className="font-mono">name, address, phone, lat, lng</span>). Extra columns such as{' '}
                统一社会信用代码 / 注册资本 / 企业状态 / 数据来源 are saved into the factory profile (description). Up to
                500 rows; photos are not imported.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={bulkLoading}
                  onClick={() => void downloadBulkTemplate()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-rose-400 hover:text-rose-600 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Template .xlsx
                </button>
                <button
                  type="button"
                  disabled={bulkLoading}
                  onClick={() => excelInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 disabled:opacity-50"
                >
                  <Table2 className="w-4 h-4" />
                  {bulkLoading ? 'Importing…' : 'Upload filled .xlsx'}
                </button>
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => void handleBulkExcelSelected(e)}
                />
              </div>
              {bulkLoading && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-900 leading-relaxed">
                  <p className="font-bold">Import in progress…</p>
                  <p className="mt-0.5">
                    Uploading and saving rows to the server. This can take 1–2 minutes on first request while
                    Render wakes up. Keep this window open.
                  </p>
                </div>
              )}
              {bulkSummary && (
                <pre
                  ref={bulkSummaryRef}
                  className={`text-[11px] whitespace-pre-wrap font-sans rounded-lg p-3 border ${
                    bulkImportOk
                      ? 'text-emerald-900 bg-emerald-50 border-emerald-200'
                      : 'text-amber-950 bg-amber-50 border-amber-200'
                  }`}
                >
                  {bulkSummary}
                </pre>
              )}
            </div>

            {/* Display name */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Display name *</label>
              <input
                required
                className={`w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-violet-500 outline-none transition-all ${
                  nameDuplicate ? 'ring-2 ring-amber-400' : ''
                }`}
                value={newShop.name}
                onChange={e => setNewShop({ ...newShop, name: e.target.value })}
                placeholder="e.g. Alex, 小雨"
              />
              {nameDuplicate && (
                <p className="text-[11px] text-amber-700 font-semibold mt-1">
                  This name is already taken. Pick a unique display name.
                </p>
              )}
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Location (city, province) *</label>
              <input
                required
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                value={newShop.address}
                onChange={e => setNewShop({ ...newShop, address: e.target.value })}
                placeholder="e.g. No.88 Zhangjiang Rd, Pudong, Shanghai"
              />
            </div>

            {/* MBTI type */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">MBTI type *</label>
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

            {/* Looking for */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Looking for</label>
              <div className="flex flex-wrap gap-2">
                {LOOKING_FOR_OPTIONS.map((opt) => {
                  const on = lookingFor.includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setLookingFor((prev) =>
                        on ? prev.filter((k) => k !== opt.key) : [...prev, opt.key]
                      )}
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

            {/* Coordinates */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Coordinates (Paste from Google Maps) *
              </label>
             <input
              type="text"
              placeholder="e.g. 31.230416 121.473701"
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
                placeholder="WeChat / mobile for connecting"
              />
            </div>

            {/* City */}
            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <MapPin size={14} /> City
              </label>
              <input
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-violet-500 outline-none text-sm text-gray-800"
                value={newShop.filter_city || ''}
                onChange={(e) => setNewShop({ ...newShop, filter_city: e.target.value })}
                placeholder="e.g. Shanghai, Beijing"
              />
            </div>

            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <DollarSign size={14} /> Age (optional)
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
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Interests</label>
              <input
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-violet-500 outline-none transition-all"
                value={newShop.main_product || ''}
                onChange={(e) => setNewShop({ ...newShop, main_product: e.target.value })}
                placeholder="e.g. Coffee, hiking, photography"
              />
            </div>

            <div className="bg-violet-50/50 p-4 rounded-2xl border border-violet-100">
              <label className="block text-xs font-bold text-violet-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Info size={14} /> About me
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-white border border-violet-200 focus:ring-2 focus:ring-violet-500 outline-none transition-all text-sm text-gray-700 resize-none"
                value={newShop.about_me}
                onChange={e => setNewShop({ ...newShop, about_me: e.target.value })}
                placeholder="A short intro — hobbies, vibe, what you are like…"
              />
            </div>

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
            disabled={isSubmitting || bulkLoading}
            className={`w-full bg-rose-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-rose-200 active:scale-95 transition-transform sticky bottom-0
              ${isSubmitting ? 'opacity-70 cursor-not-allowed bg-gray-400 shadow-none' : 'hover:bg-rose-600'}`}
          >
            {isSubmitting ? 'Saving…' : 'Add profile'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminPanel;