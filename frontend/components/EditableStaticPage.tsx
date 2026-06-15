import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import DOMPurify from 'dompurify';
import { AdminRichTextEditor } from './AdminRichTextEditor';
import { getApiBaseUrl } from '../config/api';

const API_BASE = getApiBaseUrl();

type PageKey = 'about' | 'terms';

const LEGACY_PAGE_MARKERS = [
  'massage',
  'therapist',
  'spa service',
  '18 years of age',
  '18+',
  'new zealand massage',
  'massageshop',
];

function isLegacyMassagePageHtml(html: string): boolean {
  const lower = html.toLowerCase();
  return LEGACY_PAGE_MARKERS.some((m) => lower.includes(m));
}

export type EditableStaticPageHandle = {
  openEditor: () => void;
};

interface EditableStaticPageProps {
  page: PageKey;
  /** If empty, no page heading is shown (e.g. Terms with its own layout header). */
  title: string;
  /** Shown when API returns no custom HTML */
  fallback: React.ReactNode;
  backLink?: React.ReactNode;
  /** Extra classes on the outer wrapper (e.g. `p-0 max-w-none` when nested in a styled main). */
  className?: string;
  /**
   * When true with an empty title, the inline "Edit page" row is omitted — use `ref.openEditor()`
   * from a parent (e.g. sticky header).
   */
  suppressInlineEditButton?: boolean;
}

function loadIsAdmin(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('is_admin') === 'true';
}

export const EditableStaticPage = forwardRef<EditableStaticPageHandle, EditableStaticPageProps>(
  function EditableStaticPage(
    { page, title, fallback, backLink, className = '', suppressInlineEditButton = false },
    ref
  ) {
    const [contentHtml, setContentHtml] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(loadIsAdmin);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [editorMountKey, setEditorMountKey] = useState(0);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
      const sync = () => setIsAdmin(loadIsAdmin());
      window.addEventListener('storage', sync);
      window.addEventListener('focus', sync);
      return () => {
        window.removeEventListener('storage', sync);
        window.removeEventListener('focus', sync);
      };
    }, []);

    const fetchPage = useCallback(async () => {
      if (!API_BASE) {
        setLoadError('API URL not configured');
        setContentHtml('');
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/page/${page}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setContentHtml(typeof data.content_html === 'string' ? data.content_html : '');
        setLoadError(null);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load');
        setContentHtml('');
      }
    }, [page]);

    useEffect(() => {
      fetchPage();
    }, [fetchPage]);

    const openEdit = useCallback(() => {
      const initial = contentHtml ?? '';
      setDraft(initial);
      setSaveError(null);
      setEditorMountKey((k) => k + 1);
      setEditing(true);
    }, [contentHtml]);

    useImperativeHandle(ref, () => ({ openEditor: openEdit }), [openEdit]);

    const saveDraft = async () => {
      const token = localStorage.getItem('auth_token') || '';
      if (!API_BASE) {
        setSaveError('API URL not configured');
        return;
      }
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch(`${API_BASE}/api/admin/page`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ page, content: draft }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
        }
        const saved = (data as { content_html?: string }).content_html;
        setContentHtml(typeof saved === 'string' ? saved : draft);
        setEditing(false);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Save failed');
      } finally {
        setSaving(false);
      }
    };

    const sanitized =
      contentHtml && contentHtml.trim() !== '' && !isLegacyMassagePageHtml(contentHtml)
        ? DOMPurify.sanitize(contentHtml, { USE_PROFILES: { html: true } })
        : '';

    const showTitleRow = title.trim() !== '' || (isAdmin && !suppressInlineEditButton);
    const editModalTitle = title.trim() || (page === 'terms' ? 'Terms & Conditions' : 'Page');

    return (
      <div className={`max-w-4xl mx-auto p-6 ${className}`.trim()}>
        {showTitleRow && (
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            {title.trim() !== '' ? (
              <h1 className="text-3xl font-bold text-gray-800">{title}</h1>
            ) : (
              <span className="flex-1 min-w-0" />
            )}
            {isAdmin && !suppressInlineEditButton && (
              <button
                type="button"
                onClick={openEdit}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 shadow shrink-0"
              >
                Edit page
              </button>
            )}
          </div>
        )}

        {loadError && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            Could not load saved content ({loadError}). Showing default content.
          </p>
        )}

        {sanitized ? (
          <div
            className="prose prose-gray max-w-none text-gray-700 mb-6 [&_img]:max-w-full [&_a]:text-rose-600"
            dangerouslySetInnerHTML={{ __html: sanitized }}
          />
        ) : (
          <div className="text-gray-700 mb-6">{fallback}</div>
        )}

        {backLink}

        {editing && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/50">
            <div
              className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="font-bold text-lg text-gray-800">Edit {editModalTitle}</h2>
                <button
                  type="button"
                  className="text-gray-500 hover:text-gray-800 px-2 py-1"
                  onClick={() => setEditing(false)}
                >
                  Close
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 min-h-[200px]">
                <AdminRichTextEditor
                  key={editorMountKey}
                  initialHtml={draft}
                  onHtmlChange={setDraft}
                />
              </div>
              {saveError && <p className="px-4 text-sm text-red-600">{saveError}</p>}
              <div className="flex justify-end gap-2 border-t px-4 py-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
                  onClick={saveDraft}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);
