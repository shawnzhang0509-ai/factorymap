import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import {
  EditableStaticPage,
  type EditableStaticPageHandle,
} from '../components/EditableStaticPage';

function loadIsAdmin(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('is_admin') === 'true';
}

const TermsPage: React.FC = () => {
  const editorRef = useRef<EditableStaticPageHandle>(null);
  const [isAdmin, setIsAdmin] = useState(loadIsAdmin);

  useEffect(() => {
    const sync = () => setIsAdmin(loadIsAdmin());
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);
  const fallback = (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
      <div className="flex items-center gap-3 text-rose-600 bg-rose-50 p-4 rounded-xl">
        <ShieldCheck className="w-8 h-8 flex-shrink-0" />
        <div>
          <h2 className="font-bold text-lg">Terms of Use</h2>
          <p className="text-sm opacity-90">China Factory Map — B2B supplier directory</p>
        </div>
      </div>

      <section>
        <h3 className="text-lg font-bold text-gray-900 mb-2">1. Purpose of Service</h3>
        <p className="text-gray-600 leading-relaxed">
          China Factory Map is an information directory that helps international buyers discover manufacturing
          suppliers in China. We do not manufacture goods, broker contracts, or guarantee supplier performance.
          All sourcing, due diligence, negotiations, and transactions are conducted directly between you and the
          listed factory.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-bold text-gray-900 mb-2">2. Listing Accuracy</h3>
        <p className="text-gray-600 leading-relaxed">
          Factory profiles, credentials, MOQ tiers, and contact details are provided by suppliers or administrators
          and may change without notice. You are responsible for independently verifying business licenses, export
          qualifications, product samples, and compliance before placing orders.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-bold text-gray-900 mb-2">3. Acceptable Use</h3>
        <ul className="list-disc pl-5 space-y-2 text-gray-600">
          <li>Use the directory only for legitimate B2B sourcing and supplier research.</li>
          <li>Do not scrape, spam, harass suppliers, or misrepresent your identity or purchasing intent.</li>
          <li>Do not upload unlawful, misleading, or infringing content through admin tools.</li>
          <li>Violations may result in restricted access or removal of listings.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-bold text-gray-900 mb-2">4. Privacy & Data</h3>
        <p className="text-gray-600 leading-relaxed">
          Location data is used only to show nearby suppliers on the map and is not stored permanently without your
          consent. Admin accounts and listing edits are stored on our servers. See our privacy practices in the About
          section or contact us for questions.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-bold text-gray-900 mb-2">5. Limitation of Liability</h3>
        <p className="text-gray-600 leading-relaxed">
          We are not liable for disputes, product defects, payment losses, shipping issues, or other damages arising
          from your dealings with any listed supplier. Use of this directory is at your own risk.
        </p>
      </section>

      <div className="pt-6 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          Last Updated: June 2026
          <br />
          By using China Factory Map, you agree to these terms.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen h-screen bg-gray-50 flex flex-col overflow-y-auto">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1 min-w-0">Terms & Conditions</h1>
          {isAdmin && (
            <button
              type="button"
              onClick={() => editorRef.current?.openEditor()}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
            >
              Edit
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full p-6 pb-20">
        <EditableStaticPage
          ref={editorRef}
          page="terms"
          title=""
          fallback={fallback}
          className="p-0 max-w-none mx-0"
          suppressInlineEditButton
        />
      </main>
    </div>
  );
};

export default TermsPage;
