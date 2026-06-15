import React, { useState, useRef } from 'react';
import { X, Upload, Info, DollarSign, MapPin, Table2, Download } from 'lucide-react';
import { ShopCreate, Shop } from './types';
import { CHINA_ECONOMIC_ZONES } from '../constants/filterRegions';
import { MOQ_TIER_FORM_OPTIONS } from '../constants/moqTiers';
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

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const nameKey = (newShop.name || '').trim().toLowerCase();
  const nameDuplicate =
    nameKey.length > 0 && existingShopNamesLower.includes(nameKey);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShop.name || !newShop.address || !newShop.phone || !newShop.lat || !newShop.lng || !newShop.main_product?.trim()) {
      setError('Please fill in all required fields (Factory name, Location, Phone, Coordinates, Main product).');
      return;
    }
    if (nameDuplicate) {
      setError('This factory name is already used. Please choose a different name (same spelling with different spacing/capitalization also counts as duplicate).');
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
    if (newShop.main_product?.trim()) {
      formData.append('main_product', newShop.main_product.trim());
    }
    if (newShop.min_spend != null && newShop.min_spend >= 1 && newShop.min_spend <= 4) {
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
              ? 'This factory name is already in use.'
              : 'Failed to add factory. Please try again.')
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
      const res = await fetch(`${base}/shop/bulk-import-excel`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Import failed');
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
      const created = result.created as Shop[] | undefined;
      if (created?.length && onBulkShopsImported) {
        onBulkShopsImported(created);
      }
    } catch (err) {
      console.error(err);
      setError('Network error during import');
      setBulkImportOk(false);
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">Add factory listing</h2>
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
                  Upload filled .xlsx
                </button>
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => void handleBulkExcelSelected(e)}
                />
              </div>
              {bulkSummary && (
                <pre
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

            {/* Factory name */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Factory name *</label>
              <input
                required
                className={`w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-rose-500 outline-none transition-all ${
                  nameDuplicate ? 'ring-2 ring-amber-400' : ''
                }`}
                value={newShop.name}
                onChange={e => setNewShop({ ...newShop, name: e.target.value })}
                placeholder="e.g. Shenzhen Bright Electronics Co., Ltd."
              />
              {nameDuplicate && (
                <p className="text-[11px] text-amber-700 font-semibold mt-1">
                  This name matches an existing factory (ignoring spaces and capital letters). Saving will be rejected — pick a unique name.
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

            {/* Credentials (comma → tags) */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Credentials (buyer-facing)
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
                  placeholder={tags.length === 0 ? "Type & Enter (e.g. Industry Leader, ISO 9001)" : ""}
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
                placeholder="WhatsApp / mobile for buyer inquiries"
              />
            </div>

            {/* Map region (home filter chips) */}
            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <MapPin size={14} /> Industrial zone
              </label>
              <select
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none text-sm text-gray-800"
                value={newShop.filter_city || ''}
                onChange={(e) => setNewShop({ ...newShop, filter_city: e.target.value })}
              >
                <option value="">Not set</option>
                {CHINA_ECONOMIC_ZONES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <DollarSign size={14} /> MOQ / trade capacity
              </label>
              <select
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none text-sm text-gray-800"
                value={
                  newShop.min_spend != null && newShop.min_spend >= 1 && newShop.min_spend <= 4
                    ? String(newShop.min_spend)
                    : '0'
                }
                onChange={(e) => {
                  const v = e.target.value;
                  setNewShop({ ...newShop, min_spend: v === '0' ? undefined : Number(v) });
                }}
              >
                {MOQ_TIER_FORM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Main product *</label>
              <input
                required
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                value={newShop.main_product || ''}
                onChange={(e) => setNewShop({ ...newShop, main_product: e.target.value })}
                placeholder="e.g. LED drivers, knitwear, CNC machined parts"
              />
            </div>

            {/* Capabilities */}
            <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
              <label className="block text-xs font-bold text-rose-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Info size={14} /> Factory profile / capabilities
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-white border border-rose-200 focus:ring-2 focus:ring-rose-500 outline-none transition-all text-sm text-gray-700 resize-none"
                value={newShop.about_me}
                onChange={e => setNewShop({ ...newShop, about_me: e.target.value })}
                placeholder="Lines, certifications, export markets, key customers (sanitized)…"
              />
              <p className="text-[10px] text-rose-400 mt-1">Shown on the factory detail page.</p>
            </div>

            {/* Commercial notes */}
            <div className="bg-green-50/50 p-4 rounded-2xl border border-green-100">
              <label className="block text-xs font-bold text-green-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                <DollarSign size={14} /> Pricing / lead time notes
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-white border border-green-200 focus:ring-2 focus:ring-green-500 outline-none transition-all text-sm text-gray-700 resize-none"
                value={newShop.additional_price}
                onChange={e => setNewShop({ ...newShop, additional_price: e.target.value })}
                placeholder={`FOB Shanghai\nTypical lead time: 25 days`}
              />
              <p className="text-[10px] text-green-500 mt-1">Use Enter for new lines.</p>
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
            {isSubmitting ? 'Saving…' : 'Add factory'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminPanel;