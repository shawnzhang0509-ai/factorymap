import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shop } from '../types';

interface UserItem {
  id: number;
  username: string;
  is_admin: boolean;
  is_ad_manager?: boolean;
}

interface OwnerRow {
  shop_id: number;
  owner_user_id: number;
  owner_username: string;
}

const AssignAdsPage: React.FC = () => {
  const navigate = useNavigate();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const token = localStorage.getItem('auth_token') || '';
  const isLoggedIn = localStorage.getItem('admin_logged_in') === 'true';
  const isAdmin = localStorage.getItem('is_admin') === 'true';
  const isAdManager = localStorage.getItem('is_ad_manager') === 'true';
  const canManageAllAds = isAdmin || isAdManager;

  const [shops, setShops] = useState<Shop[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [owners, setOwners] = useState<Record<number, OwnerRow>>({});
  const [selectedOwner, setSelectedOwner] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingShopId, setSavingShopId] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !token || !canManageAllAds) {
      navigate('/');
      return;
    }

    const loadData = async () => {
      try {
        const [usersRes, shopsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/shop/admin/users`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/shop/shops`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!usersRes.ok) throw new Error('Failed to load users');
        if (!shopsRes.ok) throw new Error('Failed to load shops');

        const usersData: UserItem[] = await usersRes.json();
        const shopsData: Shop[] = await shopsRes.json();
        const ownerRes = await fetch(`${API_BASE_URL}/shop/admin/owners`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const ownerData: OwnerRow[] = ownerRes.ok ? await ownerRes.json() : [];

        setUsers(usersData);
        setShops(shopsData);
        const ownerMap: Record<number, OwnerRow> = {};
        ownerData.forEach((row) => {
          ownerMap[row.shop_id] = row;
        });
        setOwners(ownerMap);

        const initialSelected: Record<number, string> = {};
        for (const shop of shopsData) {
          initialSelected[shop.id] = '';
        }
        setSelectedOwner(initialSelected);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [API_BASE_URL, canManageAllAds, isLoggedIn, navigate, token]);

  const nonAdminUsers = useMemo(
    () => users.filter((u) => !u.is_admin),
    [users]
  );

  const handleAssign = async (shopId: number) => {
    const username = (selectedOwner[shopId] || '').trim();
    if (!username) {
      alert('Please choose a user first.');
      return;
    }

    try {
      setSavingShopId(shopId);
      const res = await fetch(`${API_BASE_URL}/shop/admin/transfer-owner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shop_id: shopId, username }),
      });

      const payload = await res.json();
      if (!res.ok || payload.error) {
        throw new Error(payload.error || 'Failed to assign owner');
      }

      setOwners((prev) => ({
        ...prev,
        [shopId]: {
          shop_id: shopId,
          owner_user_id: payload.owner.id,
          owner_username: payload.owner.username,
        },
      }));
      alert(`Assigned shop #${shopId} to ${username}.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Assignment failed');
    } finally {
      setSavingShopId(null);
    }
  };

  const handleToggleAdManager = async (user: UserItem) => {
    if (!isAdmin) return;
    const nextValue = !user.is_ad_manager;
    try {
      const res = await fetch(`${API_BASE_URL}/shop/admin/users/${user.id}/permissions`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_ad_manager: nextValue }),
      });
      const payload = await res.json();
      if (!res.ok || payload.error) {
        throw new Error(payload.error || 'Failed to update permissions');
      }
      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id ? { ...item, is_ad_manager: !!payload.user?.is_ad_manager } : item
        )
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Permission update failed');
    }
  };

  if (loading) {
    return (
      <div className="h-screen overflow-y-auto bg-gray-50 p-8 text-center text-gray-500">
        Loading assignment data...
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-screen overflow-y-auto bg-gray-50 p-8 text-center text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">🛠 Assign Ads</h1>
            <p className="text-sm text-gray-500 mt-1">
              Admin/ad manager tool: assign ad edit ownership to a user. Admin and ad managers can edit all ads.
            </p>
          </div>
          <Link
            to="/"
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700"
          >
            Back to Home
          </Link>
        </div>

        {isAdmin && (
          <div className="bg-white rounded-lg shadow border border-gray-200/80 p-4 mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Ad manager permissions</h2>
            <p className="text-sm text-gray-500 mb-4">
              Ad managers can create/edit all ads and use Assign Ads, but cannot view stats or delete shop cards.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {users
                .filter((u) => !u.is_admin)
                .map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-gray-700">{u.username}</span>
                    <input
                      type="checkbox"
                      checked={!!u.is_ad_manager}
                      onChange={() => handleToggleAdManager(u)}
                      className="h-4 w-4 accent-rose-500"
                    />
                  </label>
                ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-x-auto touch-scroll-x" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="min-w-[900px] w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shop</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Owner</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assign To User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {shops.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-5 text-center text-gray-500">
                    No shops found.
                  </td>
                </tr>
              ) : (
                shops.map((shop) => (
                  <tr key={shop.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {shop.name}
                      <div className="text-xs text-gray-400">ID: {shop.id}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{shop.address}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {owners[shop.id]?.owner_username ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                          {owners[shop.id].owner_username}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <select
                        value={selectedOwner[shop.id] || ''}
                        onChange={(e) =>
                          setSelectedOwner((prev) => ({ ...prev, [shop.id]: e.target.value }))
                        }
                        className="border rounded px-2 py-1 text-sm bg-white"
                      >
                        <option value="">Select user...</option>
                        {nonAdminUsers.map((u) => (
                          <option key={u.id} value={u.username}>
                            {u.username}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleAssign(shop.id)}
                        disabled={savingShopId === shop.id}
                        className="px-3 py-1.5 rounded bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-60"
                      >
                        {savingShopId === shop.id ? 'Assigning...' : 'Assign'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AssignAdsPage;
