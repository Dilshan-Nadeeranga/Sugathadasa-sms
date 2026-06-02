import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

function fmtLKR(n) {
  return 'LKR ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDateTime(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + dt.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' });
}

function toISO(d) {
  return d.toISOString().split('T')[0];
}

function BillModal({ billId, onClose }) {
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/bills/${billId}`)
      .then((r) => setBill(r.data))
      .catch(() => toast.error('Failed to load bill.'))
      .finally(() => setLoading(false));
  }, [billId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-primary-700">Bill Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !bill ? (
          <p className="text-gray-400 text-center py-8">Could not load bill.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <div><span className="text-gray-500">Bill No:</span> <span className="font-semibold">{bill.bill_number}</span></div>
              <div><span className="text-gray-500">Date:</span> {fmtDateTime(bill.created_at)}</div>
              <div><span className="text-gray-500">Cashier:</span> {bill.staff_name}</div>
            </div>
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-500 font-medium">Product</th>
                  <th className="text-center py-2 text-gray-500 font-medium">Qty</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Price</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Sub</th>
                </tr>
              </thead>
              <tbody>
                {bill.items?.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2">{item.product_name}</td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-right">{Number(item.unit_price).toFixed(2)}</td>
                    <td className="py-2 text-right font-semibold">{fmtLKR(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 text-sm border-t border-gray-200 pt-3">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{fmtLKR(bill.total_amount)}</span></div>
              {parseFloat(bill.discount) > 0 && (
                <div className="flex justify-between text-red-500"><span>Discount</span><span>- {fmtLKR(bill.discount)}</span></div>
              )}
              <div className="flex justify-between font-bold text-primary-700 text-base pt-1 border-t border-gray-200">
                <span>Total</span><span>{fmtLKR(bill.net_total)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Sales() {
  const today = toISO(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [voidingId, setVoidingId] = useState(null);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/sales/summary', { params: { from, to } });
      setData(res.data);
    } catch {
      toast.error('Failed to load sales data.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const setRange = (range) => {
    const now = new Date();
    if (range === 'today') { setFrom(today); setTo(today); }
    else if (range === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      setFrom(toISO(d)); setTo(today);
    } else if (range === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      setFrom(toISO(d)); setTo(today);
    }
  };

  const exportCSV = () => {
    if (!data?.bills?.length) { toast.error('No data to export.'); return; }
    const rows = [['Bill Number', 'Date', 'Cashier', 'Items', 'Net Total (LKR)']];
    data.bills.forEach((b) => {
      rows.push([b.bill_number, fmtDateTime(b.created_at), b.staff_name || '', b.item_count, Number(b.net_total).toFixed(2)]);
    });
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sales-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported!');
  };

  const voidBill = async (id) => {
    if (!window.confirm('Void this bill and restore stock?')) return;
    setVoidingId(id);
    try {
      await api.delete(`/bills/${id}`);
      toast.success('Bill voided and stock restored.');
      fetchSales();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to void bill.');
    } finally {
      setVoidingId(null);
    }
  };

  const totals = data?.totals;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary-700">Sales</h1>
        <button onClick={exportCSV} className="btn-outline flex items-center gap-2 text-sm">
          📤 Export CSV
        </button>
      </div>

      {/* Date filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="label">From</label>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="label">To</label>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setRange('today')} className="btn-outline text-sm px-3 py-2">Today</button>
            <button onClick={() => setRange('week')} className="btn-outline text-sm px-3 py-2">This Week</button>
            <button onClick={() => setRange('month')} className="btn-outline text-sm px-3 py-2">This Month</button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Bills</p>
          <p className="text-3xl font-bold text-primary-700 mt-1">{totals?.total_bills ?? '—'}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Revenue</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{totals ? fmtLKR(totals.total_revenue) : '—'}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 uppercase font-medium">Selected Period</p>
          <p className="text-base font-semibold text-gray-600 mt-1">{fmtDate(from + 'T00:00:00')} – {fmtDate(to + 'T00:00:00')}</p>
        </div>
      </div>

      {/* Bills table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            Bills {data?.bills ? `(${data.bills.length})` : ''}
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data?.bills?.length ? (
          <div className="text-center py-14 text-gray-400">
            <p className="text-4xl mb-3">💰</p>
            <p>No sales found for the selected period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-th">Bill Number</th>
                  <th className="table-th">Date / Time</th>
                  <th className="table-th">Cashier</th>
                  <th className="table-th text-center">Items</th>
                  <th className="table-th text-right">Net Total</th>
                  <th className="table-th text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.bills.map((b) => (
                  <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedBill(b.id)}>
                    <td className="table-td font-medium text-primary-700">{b.bill_number}</td>
                    <td className="table-td text-gray-500">{fmtDateTime(b.created_at)}</td>
                    <td className="table-td">{b.staff_name || '—'}</td>
                    <td className="table-td text-center">{b.item_count}</td>
                    <td className="table-td text-right font-semibold text-green-700">{fmtLKR(b.net_total)}</td>
                    <td className="table-td text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => voidBill(b.id)}
                        disabled={voidingId === b.id}
                        className="text-red-400 hover:text-red-600 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 transition disabled:opacity-50"
                      >
                        {voidingId === b.id ? 'Voiding...' : 'Void'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedBill && <BillModal billId={selectedBill} onClose={() => setSelectedBill(null)} />}
    </div>
  );
}
