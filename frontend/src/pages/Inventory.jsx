import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['Toys', 'Stationery', 'General', 'Household', 'Other'];

function fmtLKR(n) {
  return 'LKR ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const emptyForm = { name: '', category: 'Toys', cost_price: '', sell_price: '', quantity: '', low_stock_limit: '5' };

function ProductModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState(product ? {
    name: product.name,
    category: product.category,
    cost_price: product.cost_price,
    sell_price: product.sell_price,
    quantity: product.quantity,
    low_stock_limit: product.low_stock_limit,
  } : emptyForm);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.category) e.category = 'Category is required';
    if (form.cost_price === '' || Number(form.cost_price) < 0) e.cost_price = 'Valid cost price required';
    if (form.sell_price === '' || Number(form.sell_price) < 0) e.sell_price = 'Valid sell price required';
    if (form.quantity === '' || Number(form.quantity) < 0) e.quantity = 'Valid quantity required';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const payload = {
        ...form,
        cost_price: parseFloat(form.cost_price),
        sell_price: parseFloat(form.sell_price),
        quantity: parseInt(form.quantity),
        low_stock_limit: parseInt(form.low_stock_limit) || 5,
      };
      if (product) {
        await api.put(`/products/${product.id}`, payload);
        toast.success('Product updated!');
      } else {
        await api.post('/products', payload);
        toast.success('Product added!');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product.');
    } finally {
      setLoading(false);
    }
  };

  const field = (key, label, type = 'text', placeholder = '') => (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className={`input ${errors[key] ? 'border-red-400' : ''}`}
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => { setForm({ ...form, [key]: e.target.value }); setErrors({ ...errors, [key]: '' }); }}
        step={type === 'number' ? '0.01' : undefined}
        min={type === 'number' ? '0' : undefined}
      />
      {errors[key] && <p className="text-red-500 text-xs mt-1">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-primary-700">{product ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {field('name', 'Product Name', 'text', 'e.g. LEGO Classic Set')}
          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('cost_price', 'Cost Price (LKR)', 'number', '0.00')}
            {field('sell_price', 'Sell Price (LKR)', 'number', '0.00')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('quantity', 'Quantity', 'number', '0')}
            {field('low_stock_limit', 'Low Stock Alert', 'number', '5')}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading ? <><span className="spinner" /> Saving...</> : (product ? 'Update' : 'Add Product')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Inventory() {
  const { isOwner } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | product obj
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      const res = await api.get('/products', { params });
      setProducts(res.data);
    } catch {
      toast.error('Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    const t = setTimeout(fetchProducts, 300);
    return () => clearTimeout(t);
  }, [fetchProducts]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/products/${deleteId}`);
      toast.success('Product deleted.');
      setDeleteId(null);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  const totalValue = products.reduce((s, p) => s + p.quantity * parseFloat(p.cost_price), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary-700">Inventory</h1>
          <p className="text-gray-500 text-sm">{products.length} products · Total value: {fmtLKR(totalValue)}</p>
        </div>
        <button onClick={() => setModal('add')} className="btn-primary flex items-center gap-2">
          + Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          className="input flex-1"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input sm:w-44"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-primary-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📦</p>
            <p className="font-medium">No products found.</p>
            <p className="text-sm mt-1">Add your first product to get started!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-th">Product</th>
                  <th className="table-th">Category</th>
                  <th className="table-th text-right">Cost (LKR)</th>
                  <th className="table-th text-right">Price (LKR)</th>
                  <th className="table-th text-center">Stock</th>
                  <th className="table-th text-center">Alert At</th>
                  <th className="table-th text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const isLow = p.quantity <= p.low_stock_limit;
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-gray-50 hover:bg-gray-50 ${isLow ? 'bg-red-50 hover:bg-red-100' : ''}`}
                    >
                      <td className="table-td font-medium">
                        {p.name}
                        {isLow && <span className="ml-2 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">Low</span>}
                      </td>
                      <td className="table-td">
                        <span className="bg-blue-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">{p.category}</span>
                      </td>
                      <td className="table-td text-right">{Number(p.cost_price).toFixed(2)}</td>
                      <td className="table-td text-right font-semibold">{Number(p.sell_price).toFixed(2)}</td>
                      <td className={`table-td text-center font-bold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>
                        {p.quantity}
                      </td>
                      <td className="table-td text-center text-gray-500">{p.low_stock_limit}</td>
                      <td className="table-td text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setModal(p)}
                            className="text-primary-700 hover:text-primary-900 text-sm font-medium px-2 py-1 rounded hover:bg-blue-50 transition"
                          >
                            Edit
                          </button>
                          {isOwner && (
                            <button
                              onClick={() => setDeleteId(p.id)}
                              className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <ProductModal
          product={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={fetchProducts}
        />
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Product?</h3>
            <p className="text-gray-500 text-sm mb-5">This action cannot be undone. The product will be permanently removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-outline flex-1">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger flex-1 flex items-center justify-center gap-2">
                {deleting ? <><span className="spinner" /> Deleting...</> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
