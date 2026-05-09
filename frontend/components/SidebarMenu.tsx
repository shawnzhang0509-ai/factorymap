import React from 'react';
import { Link } from 'react-router-dom';

type SidebarMenuProps = {
  isOpen: boolean;
  onClose: () => void;
  onAuthChanged?: () => void;
  isAdmin?: boolean;
  isAdManager?: boolean;
};

const SidebarMenu: React.FC<SidebarMenuProps> = ({ isOpen, onClose, onAuthChanged, isAdmin = false, isAdManager = false }) => {
  if (!isOpen) return null;

  const isLoggedIn = localStorage.getItem('admin_logged_in') === 'true';
  const username = localStorage.getItem('admin_username') || '';
  const canManageAllAds = isAdmin || isAdManager;

  const handleLogout = () => {
    localStorage.removeItem('admin_logged_in');
    localStorage.removeItem('admin_username');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('is_admin');
    localStorage.removeItem('is_ad_manager');
    window.dispatchEvent(new Event('auth_changed'));
    onAuthChanged?.();
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      <div className="fixed top-0 right-0 w-64 h-full bg-white z-[10001] shadow-lg transform transition-transform duration-300 ease-in-out">
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          onClick={onClose}
        >
          &times;
        </button>

        <nav className="mt-12 px-4">
          <ul>
            <li className="mb-2">
              <Link to="/" onClick={onClose} className="block text-lg font-medium text-gray-800 hover:text-gray-600">
                Home
              </Link>
            </li>
            <li className="mb-2">
              <Link to="/my-ads" onClick={onClose} className="block text-lg font-medium text-gray-800 hover:text-gray-600">
                My Ads
              </Link>
            </li>
            {isAdmin && (
                <li className="mb-2">
                  <Link to="/admin/stats" onClick={onClose} className="block text-lg font-medium text-gray-800 hover:text-gray-600">
                    Stats Overview
                  </Link>
                </li>
            )}
            {canManageAllAds && (
                <li className="mb-2">
                  <Link to="/admin/assign-ads" onClick={onClose} className="block text-lg font-medium text-gray-800 hover:text-gray-600">
                    Assign Ads
                  </Link>
                </li>
            )}
            <li className="mb-2">
              <Link to="/about" onClick={onClose} className="block text-lg font-medium text-gray-800 hover:text-gray-600">
                About Us
              </Link>
            </li>
            <li className="mb-2">
              <Link to="/terms" onClick={onClose} className="block text-lg font-medium text-gray-800 hover:text-gray-600">
                Terms & Conditions
              </Link>
            </li>
          </ul>

          <div className="mt-6 pt-4 border-t border-gray-200">
            {isLoggedIn ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  Signed in as: <span className="font-semibold text-gray-700">{username || 'Unknown'}</span>
                  {isAdmin ? ' (admin)' : isAdManager ? ' (ad manager)' : ''}
                </p>
                <button
                  onClick={handleLogout}
                  className="w-full py-2 px-3 rounded-lg bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600"
                >
                  Logout
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Please login from the top bar on Home to manage ads.</p>
            )}
          </div>
        </nav>
      </div>
    </>
  );
};

export default SidebarMenu;