// components/LoginModal.tsx
import React, { useState } from 'react';
import { X, Lock } from 'lucide-react';

interface LoginModalProps {
  onLoginSuccess: (payload: { username: string; token: string; isAdmin: boolean; isAdManager: boolean }) => void;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess, onClose }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // ✅ 从环境变量读取 API 基础 URL（HTTPS）
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

      if (!API_BASE_URL) {
        throw new Error('API base URL is not configured');
      }

      const endpoint = mode === 'register' ? '/register' : '/login';
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uname: username, pwd: password }),
      });

      if (!res.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await res.json();

      if (data.success) {
        const token = data.token || '';
        const isAdmin = !!data.user?.is_admin;
        const isAdManager = !!data.user?.is_ad_manager;
        const resolvedUsername = data.user?.username || username;
        localStorage.setItem('admin_logged_in', 'true');
        localStorage.setItem('admin_username', resolvedUsername);
        localStorage.setItem('auth_token', token);
        localStorage.setItem('is_admin', isAdmin ? 'true' : 'false');
        localStorage.setItem('is_ad_manager', isAdManager ? 'true' : 'false');
        window.dispatchEvent(new Event('auth_changed'));
        onLoginSuccess({ username: resolvedUsername, token, isAdmin, isAdManager });
        onClose();
      } else {
        setError(data.error || 'Invalid username or password');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(
        mode === 'register'
          ? 'Register failed. Please check your input or network.'
          : 'Login failed. Please check your input or network.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Lock className="w-5 h-5 text-rose-500" />
              {mode === 'login' ? 'Login' : 'Register'}
            </h2>
            <button onClick={onClose} className="hover:text-gray-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              required
            />
            {error && <p className="text-rose-500 text-xs">{error}</p>}
            <button
              type="submit"
              className="w-full bg-rose-500 text-white py-3 rounded-xl font-bold hover:bg-rose-600 transition"
            >
              {mode === 'login' ? 'Login' : 'Create Account'}
            </button>
            <button
              type="button"
              onClick={() => {
                setError('');
                setMode((prev) => (prev === 'login' ? 'register' : 'login'));
              }}
              className="w-full text-sm text-gray-600 hover:text-gray-800 underline"
            >
              {mode === 'login' ? 'No account? Register here' : 'Already have an account? Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;