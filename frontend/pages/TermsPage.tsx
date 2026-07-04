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
          <p className="text-sm opacity-90">MBTI Social Map — community guidelines</p>
        </div>
      </div>

      <section>
        <h3 className="text-lg font-bold text-gray-900 mb-2">1. Purpose of Service</h3>
        <p className="text-gray-600 leading-relaxed">
          MBTI Social Map helps people discover others nearby on a map and connect based on personality type and shared
          interests. We do not guarantee compatibility, safety of in-person meetings, or the accuracy of user profiles.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-bold text-gray-900 mb-2">2. Profile Accuracy</h3>
        <p className="text-gray-600 leading-relaxed">
          Profiles are created by users or moderators. You are responsible for the information you share. Always verify
          someone&apos;s identity through your own judgment before meeting in person.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-bold text-gray-900 mb-2">3. Acceptable Use</h3>
        <ul className="list-disc pl-5 space-y-2 text-gray-600">
          <li>Be respectful. No harassment, hate speech, spam, or impersonation.</li>
          <li>Do not share others&apos; private information without consent.</li>
          <li>Meet in public places for first meetings. Tell a friend where you are going.</li>
          <li>Violations may result in profile removal or restricted access.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-bold text-gray-900 mb-2">4. Privacy & Location</h3>
        <p className="text-gray-600 leading-relaxed">
          Location data is used to show nearby people on the map. Consider using approximate locations and never share
          exact home addresses publicly.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-bold text-gray-900 mb-2">5. Limitation of Liability</h3>
        <p className="text-gray-600 leading-relaxed">
          We are not liable for disputes, harm, or losses arising from interactions between users. Use the service at
          your own risk.
        </p>
      </section>

      <div className="pt-6 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          Last Updated: June 2026
          <br />
          By using MBTI Social Map, you agree to these guidelines.
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
