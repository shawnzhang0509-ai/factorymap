import React, { useState, useEffect, Suspense, lazy } from 'react';
import HamburgerButton from './components/HamburgerButton';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import SidebarMenu from './components/SidebarMenu';

const HomePage = lazy(() => import('./pages/HomePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const ShopDetailPage = lazy(() => import('./pages/ShopDetailPage'));
const AdminStats = lazy(() => import('./pages/Adminstats'));
const MyAdsPage = lazy(() => import('./pages/MyAdsPage'));
const AssignAdsPage = lazy(() => import('./pages/AssignAdsPage'));

const routeFallback = (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 text-rose-600 font-semibold text-sm">
    Loading…
  </div>
);

/** Old /stats/:id links → shop detail (slug or numeric id both work on ShopDetailPage) */
const StatsToShopRedirect: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>();
  if (!shopId) return <Navigate to="/" replace />;
  return <Navigate to={`/shop/${encodeURIComponent(shopId)}`} replace />;
};

const App: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [authVersion, setAuthVersion] = useState(0);
  const [isAdmin, setIsAdmin] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('is_admin') === 'true'
  );
  const [isAdManager, setIsAdManager] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('is_ad_manager') === 'true'
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = () => {
      setIsAdmin(localStorage.getItem('is_admin') === 'true');
      setIsAdManager(localStorage.getItem('is_ad_manager') === 'true');
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('auth_changed', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('auth_changed', handleStorage);
    };
  }, []);

  return (
    <BrowserRouter>
      <HamburgerButton
        onClick={() => setIsMenuOpen(true)}
        style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 9999 }}
      />

      <Suspense fallback={routeFallback}>
        <Routes>
          <Route path="/" element={<HomePage key={`home-${authVersion}`} />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/shop/:slug" element={<ShopDetailPage />} />
          <Route path="/stats/:shopId" element={<StatsToShopRedirect />} />
          <Route path="/admin/stats" element={<AdminStats />} />
          <Route path="/admin/assign-ads" element={<AssignAdsPage />} />
          <Route path="/my-ads" element={<MyAdsPage />} />
        </Routes>
      </Suspense>

      <SidebarMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onAuthChanged={() => {
          setAuthVersion((prev) => prev + 1);
          setIsAdmin(typeof window !== 'undefined' && localStorage.getItem('is_admin') === 'true');
          setIsAdManager(typeof window !== 'undefined' && localStorage.getItem('is_ad_manager') === 'true');
        }}
        isAdmin={isAdmin}
        isAdManager={isAdManager}
      />
    </BrowserRouter>
  );
};

export default App;
