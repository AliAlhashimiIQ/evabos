import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Truck,
  ShoppingBag,
  Users,
  RotateCcw,
  Wallet,
  BarChart3,
  UserCog,
  Store,
  History,
  Database,
  Settings,
  LogOut,
  Lock,
  Unlock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import './MainLayout.css';

const MainLayout = (): JSX.Element => {
  const { user, logout, posLocked, lockPos, unlockPos, hasRole } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Cashiers can only see: POS, Products, Returns, Customers
  const cashierNavItems = [
    { to: '/pos', label: t('pointOfSale'), icon: ShoppingCart },
    { to: '/products', label: t('products'), icon: Package },
    { to: '/returns', label: t('returns'), icon: RotateCcw },
    { to: '/customers', label: t('customers'), icon: Users },
  ];

  // Admin and Manager can see all pages
  const adminNavItems = [
    { to: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { to: '/pos', label: t('pointOfSale'), icon: ShoppingCart },
    { to: '/sales', label: t('sales'), icon: Receipt },
    { to: '/products', label: t('products'), icon: Package },
    { to: '/suppliers', label: t('suppliers'), icon: Truck },
    { to: '/purchase-orders', label: t('purchasing'), icon: ShoppingBag },
    { to: '/customers', label: t('customers'), icon: Users },
    { to: '/returns', label: t('returns'), icon: RotateCcw },
    { to: '/expenses', label: t('expenses'), icon: Wallet },
    { to: '/reports', label: t('reports'), icon: BarChart3 },
    { to: '/users', label: t('users'), icon: UserCog },
    { to: '/branches', label: t('branches'), icon: Store },
    { to: '/activity-logs', label: t('activityLogs'), icon: History },
    { to: '/backup', label: t('backup'), icon: Database },
    { to: '/settings', label: t('settings'), icon: Settings },
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
        <div className="Layout-brand">
          <Store size={24} className="Layout-brandIcon" />
          <span>{t('appName')}</span>
        </div>
        <nav className="Layout-nav">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className="Layout-navLink">
              <item.icon size={20} className="Layout-navIcon" />
              <span>{item.label}</span>
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
            <LogOut size={18} />
            {t('logout')}
          </button>
        </div>
      </aside>

      <div className="Layout-main">
        <header className="Layout-header">
          <h1>{t('appName')} – {t('offlineMode')}</h1>
          <div className="Layout-headerActions">
            <div className="Layout-status">
              EVA Main • {user?.username ?? 'Unknown'} ({user?.role ?? '—'})
            </div>
            {hasRole(['admin', 'manager']) && (
              <button
                onClick={handleLockToggle}
                className={`Layout-lockButton ${posLocked ? 'Layout-lockButton--locked' : ''}`}
                title={posLocked ? t('unlockPOS') : t('lockPOS')}
              >
                {posLocked ? (
                  <>
                    <Lock size={18} />
                    <span>{t('locked')}</span>
                  </>
                ) : (
                  <>
                    <Unlock size={18} />
                    <span>{t('unlocked')}</span>
                  </>
                )}
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

