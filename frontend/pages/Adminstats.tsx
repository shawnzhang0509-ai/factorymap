import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

interface DailyShopStatItem {
  date: string;
  shop_id: string | number;
  shop_name?: string;
  sms: number;
  call: number;
  total: number;
}

interface ShopAggregateRow {
  shop_id: string | number;
  shop_name?: string;
  sms: number;
  call: number;
  total: number;
}

type ViewMode = 'daily' | 'summary';

const AdminStats: React.FC = () => {
  const [stats, setStats] = useState<DailyShopStatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('daily');

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

  useEffect(() => {
    const fetchAllStats = async () => {
      try {
        const params = new URLSearchParams();
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        const queryString = params.toString();
        const url = `${API_BASE_URL}/stats/daily-summary${queryString ? `?${queryString}` : ''}`;

        const res = await fetch(url);
        
        if (!res.ok) throw new Error('Failed to fetch daily summary stats');
        const data = await res.json();
        
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchAllStats();
  }, [API_BASE_URL, startDate, endDate]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading stats...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

  const grandTotal = stats.reduce((sum, item) => sum + item.total, 0);
  const totalSms = stats.reduce((sum, item) => sum + item.sms, 0);
  const totalCall = stats.reduce((sum, item) => sum + item.call, 0);
  const uniqueShopCount = new Set(stats.map((item) => String(item.shop_id))).size;
  const uniqueDateCount = new Set(stats.map((item) => item.date)).size;

  const shopAggregates = useMemo((): ShopAggregateRow[] => {
    const byId = new Map<string, ShopAggregateRow>();
    for (const row of stats) {
      const key = String(row.shop_id);
      const prev = byId.get(key);
      const sms = (prev?.sms ?? 0) + (Number(row.sms) || 0);
      const call = (prev?.call ?? 0) + (Number(row.call) || 0);
      const name = row.shop_name || prev?.shop_name;
      byId.set(key, {
        shop_id: row.shop_id,
        shop_name: name,
        sms,
        call,
        total: sms + call,
      });
    }
    return Array.from(byId.values()).sort((a, b) => b.total - a.total);
  }, [stats]);

  const shopDetailPath = (name: string | undefined, shopId: string | number) => {
    const slug = (name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug ? `/shop/${encodeURIComponent(slug)}` : `/shop/${encodeURIComponent(String(shopId))}`;
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            📊 Click stats (all shops)
          </h1>
          <div
            className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 self-start"
            role="group"
            aria-label="View mode"
          >
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                viewMode === 'daily'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Daily detail
            </button>
            <button
              type="button"
              onClick={() => setViewMode('summary')}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                viewMode === 'summary'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Summary by shop
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-600 -mt-4 mb-6">
          {viewMode === 'daily'
            ? 'One row per shop per day in the selected range.'
            : 'Totals per shop across the whole range, sorted by interactions (SMS + calls).'}
        </p>

        <div className="bg-white rounded-lg border p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded px-3 py-2 text-sm font-medium"
            >
              Clear Date Filters
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg text-center border border-blue-200">
            <p className="text-blue-600 text-sm font-bold uppercase">Total SMS</p>
            <p className="text-3xl font-bold text-blue-800">{totalSms}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center border border-green-200">
            <p className="text-green-600 text-sm font-bold uppercase">Total CALL</p>
            <p className="text-3xl font-bold text-green-800">{totalCall}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg text-center border border-purple-200">
            <p className="text-purple-600 text-sm font-bold uppercase">Total Clicks</p>
            <p className="text-3xl font-bold text-purple-800">{grandTotal}</p>
          </div>
          <div className="bg-amber-50 p-4 rounded-lg text-center border border-amber-200">
            <p className="text-amber-700 text-sm font-bold uppercase">Shops</p>
            <p className="text-3xl font-bold text-amber-800">{uniqueShopCount}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg text-center border border-slate-200">
            <p className="text-slate-600 text-sm font-bold uppercase">
              {viewMode === 'daily' ? 'Days' : 'Rows'}
            </p>
            <p className="text-3xl font-bold text-slate-800">
              {viewMode === 'daily' ? uniqueDateCount : shopAggregates.length}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200/80 w-full max-w-full overflow-x-auto overscroll-x-contain touch-scroll-x [-webkit-overflow-scrolling:touch]">
          {viewMode === 'daily' ? (
            <table className="min-w-[760px] w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shop</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SMS</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Call</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shop page</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">No data</td>
                  </tr>
                ) : (
                  stats.map((item) => (
                    <tr key={`${item.date}-${item.shop_id}`} className="hover:bg-gray-50">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {item.date}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div>{item.shop_name || 'Unknown Shop Name'}</div>
                        <div className="text-xs text-gray-400">ID: {item.shop_id}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.sms}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.call}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        {item.total}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:text-blue-900">
                        <Link to={shopDetailPath(item.shop_name, item.shop_id)}>View shop →</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="min-w-[640px] w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shop</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SMS</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Call</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shop page</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {shopAggregates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">No data</td>
                  </tr>
                ) : (
                  shopAggregates.map((item, idx) => (
                    <tr key={String(item.shop_id)} className="hover:bg-gray-50">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-500">
                        {idx + 1}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div>{item.shop_name || 'Unknown Shop Name'}</div>
                        <div className="text-xs text-gray-400">ID: {item.shop_id}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.sms}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.call}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-bold text-purple-800">{item.total}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:text-blue-900">
                        <Link to={shopDetailPath(item.shop_name, item.shop_id)}>View shop →</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminStats;