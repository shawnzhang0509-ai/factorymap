import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MIN_SPEND_OPTIONS } from '../constants/minSpend';

interface MinSpendFilterDropdownProps {
  /** null = no filter (all shops) */
  value: number | null;
  onChange: (next: number | null) => void;
}

const MENU_WIDTH = 220;
const GAP = 8;

const MinSpendFilterDropdown: React.FC<MinSpendFilterDropdownProps> = ({ value, onChange }) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number | null>(null);
  const [menuRect, setMenuRect] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const updateMenuPosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
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

  const summaryText =
    value == null
      ? 'All shops'
      : `Up to $${value}`;

  const apply = (next: number | null) => {
    onChange(next);
    setOpen(false);
  };

  const handleTriggerClick = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
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
          className="fixed z-[10001] flex max-h-[min(60vh,20rem)] w-56 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
          style={{ top: menuRect.top, left: menuRect.left, width: MENU_WIDTH }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-gray-100 p-2">
            <p className="text-xs font-semibold text-gray-600">Min. spend (filter)</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Show shops with at most this entry price, or no price set</p>
          </div>
          <div className="max-h-48 overflow-y-auto p-2 space-y-1">
            <button
              type="button"
              className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-rose-50"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              All shops
            </button>
            {MIN_SPEND_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                className={`w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-rose-50 ${
                  draft === n ? 'bg-rose-100 font-semibold text-rose-800' : 'text-gray-800'
                }`}
                onClick={() => setDraft(n)}
              >
                ${n}
              </button>
            ))}
          </div>
          <div className="flex gap-2 border-t border-gray-100 bg-gray-50/90 p-2">
            <button
              type="button"
              className="flex-1 rounded-lg border border-gray-300 py-1.5 text-sm font-medium text-gray-600"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg bg-rose-600 py-1.5 text-sm font-semibold text-white"
              onClick={() => apply(draft)}
            >
              Apply
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
        onClick={handleTriggerClick}
        className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-white/50 bg-white/40 px-2 py-0.5 text-[11px] font-semibold text-gray-800 shadow-sm backdrop-blur-sm hover:bg-white/55 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-xs"
      >
        <span className="shrink-0">Min. spend</span>
        <span className="min-w-0 truncate text-gray-500">{summaryText}</span>
        <span className="shrink-0 text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {overlay}
    </div>
  );
};

export default MinSpendFilterDropdown;
