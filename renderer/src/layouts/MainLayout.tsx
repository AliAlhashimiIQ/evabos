import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { PageTransition } from '../components/PageTransition';
import { ShortcutOverlay } from '../components/ShortcutOverlay';
import logoImg from '../assets/logo.png';
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
  Unlock,
  Globe,
  Clock,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import './MainLayout.css';

const MainLayout = (): JSX.Element => {
  const { user, logout, posLocked, lockPos, unlockPos, hasRole } = useAuth();
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [appVersion, setAppVersion] = useState<string>('6.1.1');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.getAppVersion) {
      window.electronAPI.getAppVersion().then((v) => {
        if (v) setAppVersion(v);
      });
    }
  }, []);

  // Real-time ticking clock for POS and cashier operations
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Cashiers can only see: POS, Products, Online Orders, Returns, Customers
  const cashierNavItems = [
    { to: '/pos', label: t('pointOfSale') || 'نقطة البيع', icon: ShoppingCart },
    { to: '/products', label: t('products') || 'المنتجات', icon: Package },
    { to: '/online-orders', label: t('onlineOrders') || 'الطلبات أونلاين', icon: Globe },
    { to: '/returns', label: t('returns') || 'المرتجعات', icon: RotateCcw },
    { to: '/customers', label: t('customers') || 'العملاء', icon: Users },
  ];

  // Admin and Manager can see all pages
  const adminNavItems = [
    { to: '/dashboard', label: t('dashboard') || 'لوحة التحكم', icon: LayoutDashboard },
    { to: '/pos', label: t('pointOfSale') || 'نقطة البيع', icon: ShoppingCart },
    { to: '/sales', label: t('sales') || 'المبيعات', icon: Receipt },
    { to: '/online-orders', label: t('onlineOrders') || 'الطلبات أونلاين', icon: Globe },
    { to: '/products', label: t('products') || 'المنتجات', icon: Package },
    { to: '/suppliers', label: t('suppliers') || 'الموردون', icon: Truck },
    { to: '/purchase-orders', label: t('purchasing') || 'المشتريات', icon: ShoppingBag },
    { to: '/customers', label: t('customers') || 'العملاء', icon: Users },
    { to: '/returns', label: t('returns') || 'المرتجعات', icon: RotateCcw },
    { to: '/expenses', label: t('expenses') || 'المصاريف', icon: Wallet },
    { to: '/reports', label: t('reports') || 'التقارير', icon: BarChart3 },
    { to: '/users', label: t('users') || 'المستخدمين', icon: UserCog },
    { to: '/branches', label: t('branches') || 'الفروع', icon: Store },
    { to: '/activity-logs', label: t('activityLogs') || 'سجل النشاط', icon: History },
    { to: '/backup', label: t('backup') || 'النسخ الاحتياطي', icon: Database },
    { to: '/settings', label: t('settings') || 'الإعدادات', icon: Settings },
  ];

  const getRoleLabel = (role?: string) => {
    if (!role) return '—';
    if (role === 'admin') return t('adminRole') || 'مسؤول النظام';
    if (role === 'manager') return t('managerRole') || 'مدير';
    if (role === 'cashier') return t('cashierRole') || 'كاشير';
    return role;
  };

  const navItems = hasRole(['admin', 'manager']) ? adminNavItems : cashierNavItems;

  // Route metadata for dynamic header breadcrumb & icon
  const routeMetaMap: Record<string, { title: string; subtitle: string; icon: any }> = {
    '/pos': { title: t('pointOfSale') || 'نقطة البيع (POS)', subtitle: 'إصدار الفواتير والمبيعات المباشرة', icon: ShoppingCart },
    '/dashboard': { title: t('dashboard') || 'لوحة التحكم', subtitle: 'نظرة عامة على الأداء والمؤشرات العامة', icon: LayoutDashboard },
    '/sales': { title: t('sales') || 'سجل المبيعات', subtitle: 'إدارة وتدقيق الفواتير والعمليات المالية', icon: Receipt },
    '/online-orders': { title: t('onlineOrders') || 'الطلبات أونلاين', subtitle: 'متابعة وتجهيز طلبات التوصيل والزبائن', icon: Globe },
    '/products': { title: t('products') || 'إدارة المخزون والمنتجات', subtitle: 'الباركود، تصنيف الأصناف، والأسعار', icon: Package },
    '/suppliers': { title: t('suppliers') || 'سجل الموردين', subtitle: 'بيانات الموردين وحسابات التوريد والمستحقات', icon: Truck },
    '/purchase-orders': { title: t('purchasing') || 'فواتير الشراء', subtitle: 'إدارة أوامر الشراء والتوريد المخزني', icon: ShoppingBag },
    '/customers': { title: t('customers') || 'العملاء والديون', subtitle: 'سجل الزبائن وحسابات الآجل والذمم', icon: Users },
    '/returns': { title: t('returns') || 'إدارة المرتجعات', subtitle: 'إرجاع واستبدال المنتجات وضبط الحسابات', icon: RotateCcw },
    '/expenses': { title: t('expenses') || 'المصاريف والنفقات', subtitle: 'تسجيل المصروفات اليومية والتشغيلية', icon: Wallet },
    '/reports': { title: t('reports') || 'التقارير المالية والتحليلية', subtitle: 'تقارير الأرباح والمبيعات ومطابقة الصندوق', icon: BarChart3 },
    '/users': { title: t('users') || 'المستخدمين والصلاحيات', subtitle: 'إدارة طاقم العمل وحسابات الكاشير', icon: UserCog },
    '/branches': { title: t('branches') || 'الفروع والمستودعات', subtitle: 'إدارة نقاط البيع والمستودعات المتعددة', icon: Store },
    '/activity-logs': { title: t('activityLogs') || 'سجل النشاط والرقابة', subtitle: 'حركات النظام وتدقيق عمليات الكاشير', icon: History },
    '/backup': { title: t('backup') || 'النسخ الاحتياطي', subtitle: 'أرشفة وحماية بيانات المتجر والمخزون', icon: Database },
    '/settings': { title: t('settings') || 'إعدادات النظام', subtitle: 'الطابعات، الفواتير، العملات والتخصيص', icon: Settings },
  };

  const currentRoute = routeMetaMap[location.pathname] || {
    title: t('appName') || 'مدار نقاط البيع',
    subtitle: 'نظام إدارة المتاجر ونقاط البيع',
    icon: Store,
  };
  const CurrentIcon = currentRoute.icon;

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
      {/* ─── Modern Premium Sidebar ─── */}
      <aside className="Layout-sidebar">
        {/* Brand Card with High-Res Logo */}
        <div className="Layout-brandCard">
          <div className="Layout-brandLogoWrap">
            <img
              src={logoImg}
              alt="Madar POS"
              className="Layout-brandLogo"
            />
          </div>
          <div className="Layout-brandMeta">
            <div className="Layout-brandName">
              <span>مدار</span>
              <span className="Layout-brandBadge">POS</span>
            </div>
            <div className="Layout-brandSub">
              <span>نظام نقاط البيع</span>
              {appVersion && <span className="Layout-versionTag">v{appVersion}</span>}
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="Layout-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `Layout-navLink ${isActive ? 'active' : ''}`
              }
            >
              <item.icon size={19} className="Layout-navIcon" />
              <span className="Layout-navLabel">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer with User Details and Logout */}
        <div className="Layout-sidebarFooter">
          {user && (
            <div className="Layout-userInfo">
              <div className="Layout-userAvatarMini">
                {(user.username?.[0] || 'U').toUpperCase()}
              </div>
              <div className="Layout-userMetaMini">
                <span className="Layout-userName">{user.username}</span>
                <span className="Layout-userRole">{getRoleLabel(user.role)}</span>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="Layout-logoutButton" title="تسجيل الخروج من النظام">
            <LogOut size={16} />
            <span>{t('logout') || 'تسجيل الخروج'}</span>
          </button>
        </div>
      </aside>

      {/* ─── Main Content Area with Elevated Header ─── */}
      <div className="Layout-main">
        <header className="Layout-header">
          {/* Start: Dynamic Page Title & Subtitle */}
          <div className="Layout-headerStart">
            <div className="Layout-pageIconWrap">
              <CurrentIcon size={20} className="Layout-pageIcon" />
            </div>
            <div className="Layout-pageInfo">
              <h1 className="Layout-pageTitle">{currentRoute.title}</h1>
              <span className="Layout-pageSubtitle">{currentRoute.subtitle}</span>
            </div>
          </div>

          {/* Center: Live Clock & System Status Telemetry */}
          <div className="Layout-headerCenter">
            <div className="Layout-clockWidget" title="توقيت المتجر المباشر">
              <Clock size={15} className="Layout-clockIcon" />
              <span className="Layout-clockTime">
                {currentTime.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </span>
              <span className="Layout-clockDivider">•</span>
              <span className="Layout-clockDate">
                {currentTime.toLocaleDateString('ar-IQ', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>
          </div>

          {/* End: Quick Controls & User Profile Badge */}
          <div className="Layout-headerActions">
            {/* Theme Toggle (Light / Dark) */}
            <button
              onClick={toggleTheme}
              className="Layout-actionButton Layout-themeButton"
              title={theme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الليلي'}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Lock POS Security Toggle */}
            {hasRole(['admin', 'manager']) && (
              <button
                onClick={handleLockToggle}
                className={`Layout-actionButton Layout-lockButton ${posLocked ? 'Layout-lockButton--locked' : ''}`}
                title={posLocked ? t('unlockPOS') || 'فتح القفل' : t('lockPOS') || 'قفل الشاشة'}
              >
                {posLocked ? (
                  <>
                    <Lock size={16} />
                    <span>{t('locked') || 'مقفل'}</span>
                  </>
                ) : (
                  <>
                    <Unlock size={16} />
                    <span>{t('unlocked') || 'قفل الشاشة'}</span>
                  </>
                )}
              </button>
            )}

            {/* User Profile Chip */}
            <div className="Layout-userChip">
              <div className="Layout-userAvatar">
                {(user?.username?.[0] || 'U').toUpperCase()}
              </div>
              <div className="Layout-userChipMeta">
                <span className="Layout-userChipName">{user?.username ?? 'مستخدم'}</span>
                <span className={`Layout-roleBadge Layout-roleBadge--${user?.role || 'cashier'}`}>
                  {getRoleLabel(user?.role)}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Content View with Page Transition */}
        <main className="Layout-content">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      <ShortcutOverlay />
    </div>
  );
};

export default MainLayout;
