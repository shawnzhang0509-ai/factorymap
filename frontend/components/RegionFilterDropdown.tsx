import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  SOCIAL_REGIONS,
  getRegionByKey,
  loadStoredDefaultRegion,
  saveDefaultRegion,
  type SocialRegionKey,
} from '../constants/filterRegions';
import { UI } from '../constants/i18n';

interface RegionFilterDropdownProps {
  value: SocialRegionKey;
  onChange: (next: SocialRegionKey) => void;
}

const MENU_WIDTH = 280;
const GAP = 8;

const RegionFilterDropdown: React.FC<RegionFilterDropdownProps> = ({ value, onChange }) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SocialRegionKey>(value);
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [menuRect, setMenuRect] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (open) {
      setDraft(value);
      setSetAsDefault(loadStoredDefaultRegion() === value);
    }
  }, [open, value]);

  const updateMenuPosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left), window.innerWidth - MENU_WIDTH - 8);
    setMenuRect({ top: r.bottom + GAP, left });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => updateMenuPosition();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const summaryText = getRegionByKey(value).label;
  const defaultRegion = loadStoredDefaultRegion();
  const defaultLabel = getRegionByKey(defaultRegion).label;

  const apply = () => {
    onChange(draft);
    if (setAsDefault) {
      saveDefaultRegion(draft);
    }
    setOpen(false);
  };

  const overlay =
    open &&
    typeof document !== 'undefined' &&
    createPortal(
      <>
        <div
          role="presentation"
          className="fixed inset-0 z-[10000] bg-black/25"
          onClick={() => setOpen(false)}
        />
        <div
          role="dialog"
          className="fixed z-[10001] flex max-h-[min(68vh,24rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
          style={{ top: menuRect.top, left: menuRect.left, width: MENU_WIDTH }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-gray-100 p-2.5">
            <p className="text-xs font-semibold text-gray-700">{UI.regionFilter}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{UI.regionFilterHint}</p>
            <p className="text-[10px] text-violet-600 mt-1">
              {UI.defaultRegionNow(defaultLabel)}
            </p>
          </div>
          <div className="max-h-52 overflow-y-auto p-2 space-y-1">
            {SOCIAL_REGIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`w-full rounded-lg px-2.5 py-2 text-left text-sm hover:bg-violet-50 ${
                  draft === opt.key ? 'bg-violet-100 font-semibold text-violet-800' : 'text-gray-800'
                }`}
                onClick={() => setDraft(opt.key)}
              >
                <span className="block font-medium">{opt.label}</span>
                {opt.key !== 'all' && opt.key !== 'other' ? (
                  <span className="block text-[10px] text-gray-500 font-normal mt-0.5">
                    {UI.regionMapHint}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 px-3 py-2 border-t border-gray-100 text-xs text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={setAsDefault}
              onChange={(e) => setSetAsDefault(e.target.checked)}
              className="accent-violet-600"
            />
            {UI.setDefaultRegion}
          </label>
          <div className="flex gap-2 border-t border-gray-100 bg-gray-50/90 p-2">
            <button
              type="button"
              className="flex-1 rounded-lg border border-gray-300 py-1.5 text-sm font-medium text-gray-600"
              onClick={() => setOpen(false)}
            >
              {UI.cancel}
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg bg-violet-600 py-1.5 text-sm font-semibold text-white"
              onClick={apply}
            >
              {UI.apply}
            </button>
          </div>
        </div>
      </>,
      document.body
    );

  return (
    <div className="relative max-w-full min-w-0 pointer-events-auto">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-white/50 bg-white/40 px-2 py-0.5 text-[11px] font-semibold text-gray-800 shadow-sm backdrop-blur-sm hover:bg-white/55 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-xs"
        aria-expanded={open}
      >
        <span className="shrink-0">{UI.region}</span>
        <span className="min-w-0 truncate text-gray-500">{summaryText}</span>
        <span className="shrink-0 text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {overlay}
    </div>
  );
};

export default RegionFilterDropdown;
