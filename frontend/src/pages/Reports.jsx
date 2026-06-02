import { useEffect, useState } from 'react';
import api from '../api/axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#1e3a5f', '#f97316', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];

function fmtLKR(n) {
  return 'LKR ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Reports() {
  const [period, setPeriod] = useState('week');
  const [revenue, setRevenue] = useState([]);
  const [categories, setCategories] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [revRes, catRes, topRes, invRes] = await Promise.all([
          api.get(`/reports/revenue?period=${period}`),
          api.get('/reports/by-category'),
          api.get('/reports/top-products?limit=10'),
          api.get('/reports/inventory-value'),
        ]);
        setRevenue(revRes.data.map((r) => ({ label: r.label, revenue: parseFloat(r.revenue), bills: r.bills })));
        setCategories(catRes.data.map((c) => ({
          name: c.category,
          value: parseFloat(c.revenue),
          profit: parseFloat(c.profit),
          units: c.units_sold,
        })));
        setTopProducts(topRes.data);
        setInventory(invRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary-700">Reports</h1>

      {/* Inventory value */}
      {inventory && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card text-center">
            <p className="text-xs text-gray-500 uppercase font-medium">Total Products</p>
            <p className="text-2xl font-bold text-primary-700 mt-1">{inventory.totals.total_products}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 uppercase font-medium">Total Units</p>
            <p className="text-2xl font-bold text-primary-700 mt-1">{inventory.totals.total_units}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 uppercase font-medium">Inventory Cost</p>
            <p className="text-lg font-bold text-green-700 mt-1">{fmtLKR(inventory.totals.total_cost)}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 uppercase font-medium">Inventory Value</p>
            <p className="text-lg font-bold text-accent-500 mt-1">{fmtLKR(inventory.totals.total_sell)}</p>
          </div>
        </div>
      )}

      {/* Revenue chart */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Revenue Over Time</h2>
          <div className="flex gap-2">
            {['week', 'month', 'year'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  period === p ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {revenue.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No sales data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revenue} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmtLKR(v)} />
              <Bar dataKey="revenue" fill="#1e3a5f" radius={[4, 4, 0, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Category pie */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Sales by Category</h2>
          {categories.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categories}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  fontSize={10}
                >
                  {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtLKR(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Profit by category */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Profit Margin by Category</h2>
          {categories.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-th">Category</th>
                    <th className="table-th text-right">Units</th>
                    <th className="table-th text-right">Revenue</th>
                    <th className="table-th text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="table-td">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          {c.name}
                        </div>
                      </td>
                      <td className="table-td text-right">{c.units}</td>
                      <td className="table-td text-right font-medium">{fmtLKR(c.value)}</td>
                      <td className="table-td text-right text-green-600 font-semibold">{fmtLKR(c.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Top 10 products */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Top 10 Products by Sales</h2>
        {topProducts.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No sales recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-th">#</th>
                  <th className="table-th">Product</th>
                  <th className="table-th">Category</th>
                  <th className="table-th text-right">Units Sold</th>
                  <th className="table-th text-right">Revenue</th>
                  <th className="table-th text-right">Profit</th>
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
                    <td className="table-td text-right text-green-700">{fmtLKR(p.revenue)}</td>
                    <td className="table-td text-right text-accent-600 font-semibold">{fmtLKR(p.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inventory by category */}
      {inventory?.byCategory?.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Inventory Value by Category</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-th">Category</th>
                  <th className="table-th text-right">Products</th>
                  <th className="table-th text-right">Units</th>
                  <th className="table-th text-right">Cost Value</th>
                  <th className="table-th text-right">Sell Value</th>
                </tr>
              </thead>
              <tbody>
                {inventory.byCategory.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="table-td font-medium">{c.category}</td>
                    <td className="table-td text-right">{c.product_count}</td>
                    <td className="table-td text-right">{c.total_units}</td>
                    <td className="table-td text-right">{fmtLKR(c.cost_value)}</td>
                    <td className="table-td text-right text-green-700 font-semibold">{fmtLKR(c.sell_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
