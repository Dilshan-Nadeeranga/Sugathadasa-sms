import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

function fmtLKR(n) {
  return 'LKR ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' });
}

export default function Billing() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState('');
  const [generating, setGenerating] = useState(false);
  const [bill, setBill] = useState(null);
  const searchRef = useRef(null);
  const billRef = useRef(null);

  const searchProducts = useCallback(async (q) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get('/products', { params: { search: q } });
      setSearchResults(res.data.filter((p) => p.quantity > 0));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchProducts(search), 300);
    return () => clearTimeout(t);
  }, [search, searchProducts]);

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) {
          toast.error(`Only ${product.quantity} in stock.`);
          return prev;
        }
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        unit_price: parseFloat(product.sell_price),
        quantity: 1,
        maxQty: product.quantity,
      }];
    });
    setSearch('');
    setSearchResults([]);
    searchRef.current?.focus();
  };

  const updateQty = (product_id, qty) => {
    const n = parseInt(qty);
    setCart((prev) =>
      prev.map((i) => {
        if (i.product_id !== product_id) return i;
        if (n <= 0) return i;
        if (n > i.maxQty) { toast.error(`Max stock: ${i.maxQty}`); return i; }
        return { ...i, quantity: n };
      })
    );
  };

  const removeFromCart = (product_id) => {
    setCart((prev) => prev.filter((i) => i.product_id !== product_id));
  };

  const total = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const discountAmt = parseFloat(discount) || 0;
  const grandTotal = Math.max(0, total - discountAmt);

  const generateBill = async () => {
    if (cart.length === 0) { toast.error('Cart is empty.'); return; }
    if (discountAmt > total) { toast.error('Discount cannot exceed total.'); return; }
    setGenerating(true);
    try {
      const res = await api.post('/bills', {
        items: cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        discount: discountAmt,
      });
      setBill(res.data);
      setCart([]);
      setDiscount('');
      toast.success(`Bill ${res.data.bill_number} generated!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate bill.');
    } finally {
      setGenerating(false);
    }
  };

  const resetBill = () => {
    setBill(null);
    setCart([]);
    setDiscount('');
    setSearch('');
    setSearchResults([]);
  };

  const printPDF = () => {
    if (!bill) return;
    const doc = new jsPDF({ unit: 'mm', format: 'a5' });
    const w = doc.internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.setTextColor('#1e3a5f');
    doc.setFont('helvetica', 'bold');
    doc.text('Sugathadasa and Sons', w / 2, 16, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#666');
    doc.text('General & Toy Store, Mirigama, Sri Lanka', w / 2, 22, { align: 'center' });
    doc.text('Tel: +94 XX XXX XXXX', w / 2, 27, { align: 'center' });

    doc.setDrawColor('#1e3a5f');
    doc.line(10, 31, w - 10, 31);

    doc.setFontSize(10);
    doc.setTextColor('#333');
    doc.text(`Bill No: ${bill.bill_number}`, 10, 38);
    doc.text(`Date: ${fmtDate(bill.created_at)}`, w - 10, 38, { align: 'right' });
    doc.text(`Time: ${fmtTime(bill.created_at)}`, w - 10, 44, { align: 'right' });
    doc.text(`Cashier: ${bill.staff_name || user?.name}`, 10, 44);

    doc.autoTable({
      startY: 50,
      head: [['Product', 'Qty', 'Unit Price', 'Subtotal']],
      body: bill.items.map((i) => [
        i.product_name,
        i.quantity,
        `LKR ${Number(i.unit_price).toFixed(2)}`,
        `LKR ${Number(i.subtotal).toFixed(2)}`,
      ]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: 10, right: 10 },
    });

    const finalY = doc.lastAutoTable.finalY + 6;
    doc.setFontSize(10);
    doc.text('Subtotal:', w - 50, finalY);
    doc.text(fmtLKR(bill.total_amount), w - 10, finalY, { align: 'right' });
    if (parseFloat(bill.discount) > 0) {
      doc.setTextColor('#e53e3e');
      doc.text('Discount:', w - 50, finalY + 7);
      doc.text(`- ${fmtLKR(bill.discount)}`, w - 10, finalY + 7, { align: 'right' });
      doc.setTextColor('#333');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor('#1e3a5f');
    doc.text('GRAND TOTAL:', w - 55, finalY + 16);
    doc.text(fmtLKR(bill.net_total), w - 10, finalY + 16, { align: 'right' });

    doc.setDrawColor('#1e3a5f');
    doc.line(10, finalY + 22, w - 10, finalY + 22);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor('#888');
    doc.text('Thank you for shopping with us!', w / 2, finalY + 29, { align: 'center' });
    doc.text('Please visit again.', w / 2, finalY + 34, { align: 'center' });

    doc.save(`${bill.bill_number}.pdf`);
  };

  const printWindow = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-primary-700">New Bill</h1>

      {!bill ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left: Cart */}
          <div className="lg:col-span-3 space-y-4">
            {/* Product search */}
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Search Product</h2>
              <div className="relative">
                <input
                  ref={searchRef}
                  type="search"
                  className="input pr-10"
                  placeholder="Type product name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary-700 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden shadow-lg max-h-56 overflow-y-auto">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-0 flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.category} · Stock: {p.quantity}</p>
                      </div>
                      <span className="text-sm font-semibold text-primary-700 shrink-0">{fmtLKR(p.sell_price)}</span>
                    </button>
                  ))}
                </div>
              )}
              {search && !searching && searchResults.length === 0 && (
                <p className="text-gray-400 text-sm mt-2 text-center">No products found.</p>
              )}
            </div>

            {/* Cart table */}
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Cart ({cart.length} items)</h2>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-xs text-red-400 hover:text-red-600">Clear all</button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-3xl mb-2">🛒</p>
                  <p className="text-sm">Cart is empty. Search and add products above.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="table-th">Product</th>
                          <th className="table-th text-center w-24">Qty</th>
                          <th className="table-th text-right">Price</th>
                          <th className="table-th text-right">Subtotal</th>
                          <th className="table-th w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((item) => (
                          <tr key={item.product_id} className="border-b border-gray-50">
                            <td className="table-td font-medium text-sm">{item.name}</td>
                            <td className="table-td text-center">
                              <input
                                type="number"
                                min="1"
                                max={item.maxQty}
                                value={item.quantity}
                                onChange={(e) => updateQty(item.product_id, e.target.value)}
                                className="w-16 text-center border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </td>
                            <td className="table-td text-right text-sm">{Number(item.unit_price).toFixed(2)}</td>
                            <td className="table-td text-right font-semibold text-sm">
                              {fmtLKR(item.unit_price * item.quantity)}
                            </td>
                            <td className="table-td">
                              <button
                                onClick={() => removeFromCart(item.product_id)}
                                className="text-red-400 hover:text-red-600 font-bold text-lg leading-none"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-semibold">{fmtLKR(total)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <label className="text-sm text-gray-600 shrink-0">Discount (LKR)</label>
                      <input
                        type="number"
                        min="0"
                        max={total}
                        step="0.01"
                        className="input w-36 text-right"
                        placeholder="0.00"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="text-base font-bold text-primary-700">Grand Total</span>
                      <span className="text-xl font-bold text-accent-500">{fmtLKR(grandTotal)}</span>
                    </div>
                    <button
                      onClick={generateBill}
                      disabled={generating || cart.length === 0}
                      className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
                    >
                      {generating ? <><span className="spinner" /> Generating...</> : '🧾 Generate Bill'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: Placeholder */}
          <div className="lg:col-span-2 card flex flex-col items-center justify-center text-gray-300 min-h-64">
            <p className="text-5xl mb-3">🧾</p>
            <p className="text-sm">Bill preview will appear here</p>
            <p className="text-xs mt-1">after you generate a bill</p>
          </div>
        </div>
      ) : (
        /* Bill generated — show preview */
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left: New bill panel */}
          <div className="lg:col-span-2 card flex flex-col items-center justify-center gap-4 min-h-64">
            <div className="text-center">
              <p className="text-5xl mb-3">✅</p>
              <p className="text-lg font-bold text-green-600">Bill Generated!</p>
              <p className="text-gray-500 text-sm mt-1">{bill.bill_number}</p>
              <p className="text-xl font-bold text-primary-700 mt-2">{fmtLKR(bill.net_total)}</p>
            </div>
            <button onClick={resetBill} className="btn-primary w-full max-w-xs">
              + New Bill
            </button>
          </div>

          {/* Right: Bill receipt */}
          <div className="lg:col-span-3">
            <div ref={billRef} className="card font-mono text-sm" id="bill-receipt">
              {/* Header */}
              <div className="text-center border-b border-dashed border-gray-300 pb-4 mb-4">
                <h2 className="text-xl font-bold text-primary-700 font-sans">Sugathadasa and Sons</h2>
                <p className="text-xs text-gray-500 font-sans">General & Toy Store, Mirigama, Sri Lanka</p>
              </div>

              {/* Bill info */}
              <div className="flex justify-between text-xs text-gray-500 mb-4">
                <div>
                  <p><span className="font-semibold">Bill No:</span> {bill.bill_number}</p>
                  <p><span className="font-semibold">Cashier:</span> {bill.staff_name || user?.name}</p>
                </div>
                <div className="text-right">
                  <p><span className="font-semibold">Date:</span> {fmtDate(bill.created_at)}</p>
                  <p><span className="font-semibold">Time:</span> {fmtTime(bill.created_at)}</p>
                </div>
              </div>

              {/* Items */}
              <div className="border-t border-dashed border-gray-300 pt-3 mb-3">
                <div className="grid grid-cols-12 text-xs text-gray-400 font-semibold mb-2">
                  <span className="col-span-5">ITEM</span>
                  <span className="col-span-2 text-center">QTY</span>
                  <span className="col-span-2 text-right">PRICE</span>
                  <span className="col-span-3 text-right">SUB</span>
                </div>
                {bill.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 text-xs py-1 border-b border-gray-100">
                    <span className="col-span-5 text-gray-700 truncate pr-1">{item.product_name}</span>
                    <span className="col-span-2 text-center text-gray-600">{item.quantity}</span>
                    <span className="col-span-2 text-right text-gray-600">{Number(item.unit_price).toFixed(2)}</span>
                    <span className="col-span-3 text-right font-semibold">{Number(item.subtotal).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 text-sm border-t border-dashed border-gray-300 pt-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{fmtLKR(bill.total_amount)}</span>
                </div>
                {parseFloat(bill.discount) > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>Discount</span>
                    <span>- {fmtLKR(bill.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-primary-700 text-base pt-2 border-t border-gray-200">
                  <span>GRAND TOTAL</span>
                  <span>{fmtLKR(bill.net_total)}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center text-xs text-gray-400 mt-4 pt-3 border-t border-dashed border-gray-300">
                <p className="font-sans">Thank you for shopping with us!</p>
                <p className="font-sans">Please visit again.</p>
              </div>
            </div>

            {/* Print buttons */}
            <div className="flex gap-3 mt-4 no-print">
              <button onClick={printPDF} className="btn-primary flex-1 flex items-center justify-center gap-2">
                📥 Download PDF
              </button>
              <button onClick={printWindow} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                🖨 Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
