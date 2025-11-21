import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import './MainLayout.css';

const MainLayout = (): JSX.Element => {
  const { user, logout, posLocked, lockPos, unlockPos, hasRole } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Cashiers can only see: POS, Products, Returns, Customers
  const cashierNavItems = [
    { to: '/pos', label: t('pointOfSale') },
    { to: '/products', label: t('products') },
    { to: '/returns', label: t('returns') },
    { to: '/customers', label: t('customers') },
  ];

  // Admin and Manager can see all pages
  const adminNavItems = [
    { to: '/dashboard', label: t('dashboard') },
    { to: '/pos', label: t('pointOfSale') },
    { to: '/sales', label: t('sales') },
    { to: '/products', label: t('products') },
    { to: '/suppliers', label: 'Suppliers' },
    { to: '/purchase-orders', label: t('purchasing') },
    { to: '/customers', label: t('customers') },
    { to: '/returns', label: t('returns') },
    { to: '/expenses', label: t('expenses') },
    { to: '/reports', label: t('reports') },
    { to: '/users', label: t('users') },
    { to: '/branches', label: t('branches') },
    { to: '/activity-logs', label: 'Activity Logs' },
    { to: '/backup', label: t('backup') },
    { to: '/settings', label: t('settings') },
  ];

  const navItems = hasRole(['admin', 'manager']) ? adminNavItems : cashierNavItems;

  const handleLockToggle = async () => {
    if (posLocked) {
      await unlockPos();
    } else {
      await lockPos();
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="Layout">
      <aside className="Layout-sidebar">
        <div className="Layout-brand">{t('appName')}</div>
        <nav>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className="Layout-navLink">
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="Layout-sidebarFooter">
          {user && (
            <div className="Layout-userInfo">
              <div className="Layout-userName">{user.username}</div>
              <div className="Layout-userRole">{user.role}</div>
            </div>
          )}
          <button onClick={handleLogout} className="Layout-logoutButton">
            {t('logout')}
          </button>
        </div>
      </aside>

      <div className="Layout-main">
        <header className="Layout-header">
          <h1>EVA POS – Offline</h1>
          <div className="Layout-headerActions">
            <div className="Layout-status">
              EVA Main • {user?.username ?? 'Unknown'} ({user?.role ?? '—'})
            </div>
            {hasRole(['admin', 'manager']) && (
              <button
                onClick={handleLockToggle}
                className={`Layout-lockButton ${posLocked ? 'Layout-lockButton--locked' : ''}`}
                title={posLocked ? 'Unlock POS' : 'Lock POS'}
              >
                {posLocked ? '🔒 Locked' : '🔓 Unlocked'}
              </button>
            )}
          </div>
        </header>
        <main className="Layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;

