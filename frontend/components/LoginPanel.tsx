import React, { useEffect, useState } from 'react';
import { X, Lock, Mail } from 'lucide-react';
import { getApiBaseUrl } from '../config/api';
import { UI } from '../constants/i18n';

interface LoginModalProps {
  onLoginSuccess: (payload: { username: string; token: string; isAdmin: boolean; isAdManager: boolean }) => void;
  onClose: () => void;
}

type LoginMode = 'email' | 'password';

function persistLogin(data: {
  token: string;
  username: string;
  isAdmin: boolean;
  isAdManager: boolean;
}) {
  localStorage.setItem('admin_logged_in', 'true');
  localStorage.setItem('admin_username', data.username);
  localStorage.setItem('auth_token', data.token);
  localStorage.setItem('is_admin', data.isAdmin ? 'true' : 'false');
  localStorage.setItem('is_ad_manager', data.isAdManager ? 'true' : 'false');
  window.dispatchEvent(new Event('auth_changed'));
}

const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess, onClose }) => {
  const [mode, setMode] = useState<LoginMode>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((v) => v - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const finishLogin = (data: { token?: string; user?: { username?: string; is_admin?: boolean; is_ad_manager?: boolean } }) => {
    const token = data.token || '';
    const resolvedUsername = data.user?.username || email.split('@')[0] || UI.unknown;
    const isAdmin = !!data.user?.is_admin;
    const isAdManager = !!data.user?.is_ad_manager;
    persistLogin({ token, username: resolvedUsername, isAdmin, isAdManager });
    onLoginSuccess({ username: resolvedUsername, token, isAdmin, isAdManager });
    onClose();
  };

  const handleSendCode = async () => {
    setError('');
    setInfo('');
    const trimmed = email.trim();
    if (!trimmed) {
      setError('请输入邮箱');
      return;
    }
    setSending(true);
    try {
      const API_BASE_URL = getApiBaseUrl();
      const res = await fetch(`${API_BASE_URL}/auth/email/send-code`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || UI.codeSendFailed);
        return;
      }
      setCodeSent(true);
      setInfo(data.message || UI.codeSent);
      setCooldown(60);
    } catch (err) {
      console.error('Send code error:', err);
      setError(UI.codeSendFailed);
    } finally {
      setSending(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setVerifying(true);
    try {
      const API_BASE_URL = getApiBaseUrl();
      const res = await fetch(`${API_BASE_URL}/auth/email/verify`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || UI.codeInvalid);
        return;
      }
      finishLogin(data);
    } catch (err) {
      console.error('Verify code error:', err);
      setError(UI.loginFailed);
    } finally {
      setVerifying(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    try {
      const API_BASE_URL = getApiBaseUrl();
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ uname: username, pwd: password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || UI.invalidCredentials);
        return;
      }
      finishLogin(data);
    } catch (err) {
      console.error('Login error:', err);
      setError(UI.loginFailed);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              {mode === 'email' ? <Mail className="w-5 h-5 text-violet-500" /> : <Lock className="w-5 h-5 text-rose-500" />}
              {UI.login}
            </h2>
            <button onClick={onClose} className="hover:text-gray-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          {mode === 'email' ? (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <p className="text-xs text-gray-500 leading-relaxed">{UI.emailLoginHint}</p>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={UI.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
                required
              />
              <div className="flex gap-2">
                <input
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder={UI.codePlaceholder}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono tracking-widest"
                  required
                />
                <button
                  type="button"
                  onClick={() => void handleSendCode()}
                  disabled={sending || cooldown > 0}
                  className="shrink-0 px-3 py-3 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold border border-violet-200 hover:bg-violet-100 disabled:opacity-50"
                >
                  {sending ? UI.loading : cooldown > 0 ? `${cooldown}s` : codeSent ? UI.resendCode : UI.sendCode}
                </button>
              </div>
              {info && <p className="text-green-600 text-xs font-medium">{info}</p>}
              {error && <p className="text-rose-500 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={verifying || code.length !== 6}
                className="w-full bg-violet-600 text-white py-3 rounded-xl font-bold hover:bg-violet-700 transition disabled:opacity-60"
              >
                {verifying ? UI.loading : UI.login}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setInfo('');
                  setMode('password');
                }}
                className="w-full text-sm text-gray-600 hover:text-gray-800 underline"
              >
                {UI.adminPasswordLogin}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <input
                placeholder={UI.username}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
              <input
                type="password"
                placeholder={UI.password}
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
                {UI.login}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setInfo('');
                  setMode('email');
                }}
                className="w-full text-sm text-gray-600 hover:text-gray-800 underline"
              >
                {UI.backToEmailLogin}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
