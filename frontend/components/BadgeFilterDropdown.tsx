import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getTagStyle } from '../constants';

interface BadgeFilterDropdownProps {
  allTags: string[];
  selectedTags: string[];
  onChange: (next: string[]) => void;
}

const MENU_WIDTH = 256;
const GAP = 8;

const BadgeFilterDropdown: React.FC<BadgeFilterDropdownProps> = ({
  allTags,
  selectedTags,
  onChange,
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [menuRect, setMenuRect] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (open) {
      setDraftTags([...selectedTags]);
    }
  }, [open, selectedTags]);

  const updateMenuPosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, r.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8
    );
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

  // Empty selection = no badge filter (every shop). Do not say "All badges" — that reads like "every badge type selected".
  const summaryText =
    selectedTags.length === 0
      ? 'All factories'
      : `${selectedTags.length} credential${selectedTags.length === 1 ? '' : 's'}`;

  const toggleDraftTag = (tag: string) => {
    setDraftTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  /** Uncheck all in draft — apply with Confirm */
  const clearDraft = () => setDraftTags([]);

  /** Apply “no badge filter” immediately and close (default: all shops visible) */
  const handleShowAllShops = () => {
    onChange([]);
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const handleConfirm = () => {
    onChange(draftTags);
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
          aria-hidden
          className="fixed inset-0 z-[10000] bg-black/30"
          onClick={handleCancel}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="badge-filter-title"
          className="fixed z-[10001] flex max-h-[min(72vh,24rem)] w-64 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
          style={{ top: menuRect.top, left: menuRect.left, width: MENU_WIDTH }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 p-2">
            <span id="badge-filter-title" className="text-xs font-semibold text-gray-600">
              Credentials & capabilities
            </span>
            <div className="flex shrink-0 items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleShowAllShops}
                className="font-semibold text-gray-800 hover:text-gray-950 underline decoration-rose-400 decoration-2 underline-offset-2"
              >
                Show all factories
              </button>
              <span className="text-gray-300" aria-hidden>
                ·
              </span>
              <button
                type="button"
                onClick={clearDraft}
                className="text-blue-600 hover:text-blue-800"
              >
                Clear picks
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {allTags.length === 0 ? (
              <p className="px-2 py-2 text-xs text-gray-400">No credential types</p>
            ) : (
              allTags.map((tag) => {
                const checked = draftTags.includes(tag);
                const style = getTagStyle(tag);
                return (
                  <label
                    key={tag}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDraftTag(tag)}
                      className="accent-rose-500"
                    />
                    <span
                      className={[
                        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-black tracking-wide shadow-sm',
                        style.bg,
                      ].join(' ')}
                    >
                      <span className="text-sm leading-none">{style.icon}</span>
                      <span className={checked ? 'font-semibold' : ''}>
                        {style.text || tag}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
          <div className="flex shrink-0 gap-2 border-t border-gray-100 bg-gray-50/90 p-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 rounded-lg border border-gray-300 bg-white py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700"
            >
              Confirm
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
        className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-white/50 bg-white/40 px-2 py-0.5 text-[11px] font-semibold text-gray-800 shadow-sm backdrop-blur-sm hover:bg-white/55 sm:gap-2 sm:px-3 sm:py-1 sm:text-xs"
      >
        <span className="shrink-0">Credentials</span>
        <span className="min-w-0 truncate text-gray-500">{summaryText}</span>
        <span className="shrink-0 text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {overlay}
    </div>
  );
};

export default BadgeFilterDropdown;
