import { useEffect, useState } from 'react';
import api from '../api/axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#1e3a5f', '#f97316', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];

function StatCard({ title, value, icon, color = 'text-primary-700', bg = 'bg-blue-50' }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center text-2xl`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
        <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function fmtLKR(n) {
  return 'LKR ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [categories, setCategories] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [dashRes, revRes, catRes, topRes] = await Promise.all([
          api.get('/reports/dashboard'),
          api.get('/reports/revenue?period=week'),
          api.get('/reports/by-category'),
          api.get('/reports/top-products?limit=5'),
        ]);
        setStats(dashRes.data);
        setRevenue(revRes.data.map(r => ({
          label: new Date(r.label).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          revenue: parseFloat(r.revenue),
        })));
        setCategories(catRes.data.map(c => ({ name: c.category, value: parseFloat(c.revenue) })));
        setTopProducts(topRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-700">Dashboard</h1>
        <p className="text-gray-500 text-sm">Overview for today — {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Today's Revenue" value={fmtLKR(stats?.revenue_today)} icon="💵" bg="bg-green-50" color="text-green-700" />
        <StatCard title="Bills Today" value={stats?.bills_today ?? 0} icon="🧾" bg="bg-blue-50" color="text-primary-700" />
        <StatCard
          title="Low Stock Items"
          value={stats?.low_stock_count ?? 0}
          icon="⚠️"
          bg={stats?.low_stock_count > 0 ? 'bg-red-50' : 'bg-gray-50'}
          color={stats?.low_stock_count > 0 ? 'text-red-600' : 'text-gray-700'}
        />
        <StatCard title="Monthly Revenue" value={fmtLKR(stats?.revenue_month)} icon="📅" bg="bg-orange-50" color="text-accent-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue bar chart */}
        <div className="card xl:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Revenue — Last 7 Days</h2>
          {revenue.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No sales data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenue} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmtLKR(v)} />
                <Bar dataKey="revenue" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category pie chart */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Sales by Category</h2>
          {categories.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categories}
                  cx="50%"
                  cy="45%"
                  outerRadius={70}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  fontSize={10}
                >
                  {categories.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmtLKR(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top products table */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Top Selling Products</h2>
        {topProducts.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No sales recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-th rounded-tl-lg">#</th>
                  <th className="table-th">Product</th>
                  <th className="table-th">Category</th>
                  <th className="table-th text-right">Units Sold</th>
                  <th className="table-th text-right rounded-tr-lg">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="table-td text-gray-400">{i + 1}</td>
                    <td className="table-td font-medium">{p.name}</td>
                    <td className="table-td">
                      <span className="bg-blue-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">{p.category}</span>
                    </td>
                    <td className="table-td text-right font-semibold">{p.units_sold}</td>
                    <td className="table-td text-right text-green-700 font-semibold">{fmtLKR(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
