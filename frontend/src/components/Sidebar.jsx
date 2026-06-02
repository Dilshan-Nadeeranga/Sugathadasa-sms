import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import api from '../api/axios';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/inventory', label: 'Inventory', icon: '📦', badge: 'lowStock' },
  { to: '/billing', label: 'New Bill', icon: '🧾' },
  { to: '/sales', label: 'Sales', icon: '💰' },
  { to: '/reports', label: 'Reports', icon: '📈', ownerOnly: true },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout, isOwner } = useAuth();
  const navigate = useNavigate();
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    api.get('/products/low-stock')
      .then((res) => setLowStockCount(res.data.length))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-150 ${
      isActive
        ? 'bg-accent-500 text-white shadow-sm'
        : 'text-blue-100 hover:bg-primary-600 hover:text-white'
    }`;

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-primary-700 flex flex-col z-30 transform transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-primary-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              S
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-tight">Sugathadasa</h1>
              <p className="text-blue-200 text-xs">& Sons — Mirigama</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            if (item.ownerOnly && !isOwner) return null;
            return (
              <NavLink key={item.to} to={item.to} className={linkClass} onClick={onClose}>
                <span className="text-lg">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge === 'lowStock' && lowStockCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {lowStockCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User info */}
        <div className="px-4 py-4 border-t border-primary-600">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center text-white font-semibold text-sm">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.name}</p>
              <p className="text-blue-300 text-xs capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left flex items-center gap-2 text-blue-200 hover:text-red-400 text-sm py-1.5 transition-colors"
          >
            <span>🚪</span> Logout
          </button>
        </div>
      </aside>
    </>
  );
}
