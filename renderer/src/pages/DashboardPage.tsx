import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Trophy,
  Package,
  Calendar,
  Receipt,
  ArrowRight,
  ShoppingCart,
  Database,
  LayoutDashboard,
  Layers,
  ArrowUpRight,
  TrendingDown,
  Building2,
} from 'lucide-react';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { SkeletonCard } from '../components/Skeleton';
import './Pages.css';
import './DashboardPage.css';

type DashboardKPIs = import('../types/electron').DashboardKPIs;
type PeakHourData = import('../types/electron').PeakHourData;
type PeakDayData = import('../types/electron').PeakDayData;

type DateRangePreset = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'allTime' | 'custom';

const formatEnglishDateTime = (dateVal: string | Date | number): string => {
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '—';

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hh = String(hours).padStart(2, '0');

  return `${yyyy}/${mm}/${dd} • ${hh}:${minutes} ${ampm}`;
};

const DashboardPage = (): JSX.Element => {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DateRangePreset>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [peakHoursData, setPeakHoursData] = useState<PeakHourData[]>([]);
  const [peakDaysData, setPeakDaysData] = useState<PeakDayData[]>([]);

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const getDateRange = (preset: DateRangePreset): { startDate: string; endDate: string } => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    switch (preset) {
      case 'today':
        return { startDate: formatDate(today), endDate: formatDate(today) };
      case 'yesterday': {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        return { startDate: formatDate(y), endDate: formatDate(y) };
      }
      case 'last7days': {
        const s = new Date(today);
        s.setDate(s.getDate() - 6);
        return { startDate: formatDate(s), endDate: formatDate(today) };
      }
      case 'last30days': {
        const s = new Date(today);
        s.setDate(s.getDate() - 29);
        return { startDate: formatDate(s), endDate: formatDate(today) };
      }
      case 'thisMonth': {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        first.setHours(12, 0, 0, 0);
        return { startDate: formatDate(first), endDate: formatDate(today) };
      }
      case 'lastMonth': {
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        first.setHours(12, 0, 0, 0);
        const last = new Date(today.getFullYear(), today.getMonth(), 0);
        last.setHours(12, 0, 0, 0);
        return { startDate: formatDate(first), endDate: formatDate(last) };
      }
      case 'allTime':
        return { startDate: '2020-01-01', endDate: formatDate(today) };
      case 'custom':
        if (customStartDate && customEndDate) {
          return { startDate: customStartDate, endDate: customEndDate };
        }
        return { startDate: formatDate(today), endDate: formatDate(today) };
      default:
        return { startDate: formatDate(today), endDate: formatDate(today) };
    }
  };

  const loadKPIs = useCallback(
    async (isRefresh = false) => {
      if (!window.evaApi || !token) {
        setError(t('desktopBridgeUnavailable') || 'Desktop bridge unavailable.');
        setLoading(false);
        return;
      }

      try {
        if (!isRefresh) setLoading(true);
        const branchId = user?.branchId ?? undefined;
        const dateRange = getDateRange(datePreset);

        const [data, peakHours, peakDays] = await Promise.all([
          window.evaApi.dashboard.getKPIs(token, branchId, dateRange),
          window.evaApi.reports.peakHours(token, {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            branchId,
          }),
          window.evaApi.reports.peakDays(token, {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            branchId,
          }),
        ]);

        setKpis(data);
        setPeakHoursData(peakHours || []);
        setPeakDaysData(peakDays || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('failedToLoadData'));
      } finally {
        setLoading(false);
      }
    },
    [token, user?.branchId, datePreset, customStartDate, customEndDate]
  );

  useEffect(() => {
    if (token) {
      loadKPIs();
    }
  }, [token, datePreset, customStartDate, customEndDate]);

  // Net Profit & Profit Margin
  const netProfit = kpis ? kpis.todaySales.profitIQD - kpis.todayExpenses : 0;
  const profitMargin =
    kpis && kpis.todaySales.totalIQD > 0
      ? ((kpis.todaySales.profitIQD / kpis.todaySales.totalIQD) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="Page DashboardPage">
      {/* ── 1. Hero Header Card ────────────────────────────── */}
      <div className="Dashboard-header">
        <div className="Dashboard-headerLeft">
          <div className="Dashboard-brandIcon">
            <LayoutDashboard size={24} />
          </div>
          <div className="Dashboard-titleSection">
            <h1>{t('dashboard')}</h1>
            <div className="Dashboard-subtitle">
              <span>
                {t('welcomeBack')}, <strong style={{ color: 'var(--text-primary)' }}>{user?.username}</strong>
              </span>
              <span className="Dashboard-branchBadge">
                <Building2 size={12} />
                <span>EVA Main</span>
              </span>
            </div>
          </div>
        </div>

        <div className="Dashboard-headerRight">
          {/* Segmented Filter Pills */}
          <div className="Dashboard-segmentedFilters">
            <button
              className={`Dashboard-filterPill ${datePreset === 'today' ? 'active' : ''}`}
              onClick={() => setDatePreset('today')}
            >
              {t('today')}
            </button>
            <button
              className={`Dashboard-filterPill ${datePreset === 'yesterday' ? 'active' : ''}`}
              onClick={() => setDatePreset('yesterday')}
            >
              {t('yesterday')}
            </button>
            <button
              className={`Dashboard-filterPill ${datePreset === 'last7days' ? 'active' : ''}`}
              onClick={() => setDatePreset('last7days')}
            >
              {t('last7days')}
            </button>
            <button
              className={`Dashboard-filterPill ${datePreset === 'last30days' ? 'active' : ''}`}
              onClick={() => setDatePreset('last30days')}
            >
              {t('last30days')}
            </button>
            <button
              className={`Dashboard-filterPill ${datePreset === 'thisMonth' ? 'active' : ''}`}
              onClick={() => setDatePreset('thisMonth')}
            >
              {t('thisMonth')}
            </button>
            <button
              className={`Dashboard-filterPill ${datePreset === 'allTime' ? 'active' : ''}`}
              onClick={() => setDatePreset('allTime')}
            >
              {t('allTime')}
            </button>
            <button
              className={`Dashboard-filterPill ${datePreset === 'custom' ? 'active' : ''}`}
              onClick={() => setDatePreset('custom')}
            >
              {t('customRange')}
            </button>
          </div>

          {datePreset === 'custom' && (
            <div className="Dashboard-customDateWrap">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('to')}</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
            </div>
          )}

          <button
            className="Dashboard-iconBtn"
            onClick={() => loadKPIs(true)}
            disabled={loading}
            title={t('refresh')}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="SettingsPage-message error">{error}</div>}

      {/* ── 2. Top Bento Grid (Key Metrics) ────────────────── */}
      {loading && !kpis ? (
        <div className="Dashboard-bentoGridTop">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="Dashboard-bentoCard col-4">
              <SkeletonCard />
            </div>
          ))}
        </div>
      ) : kpis ? (
        <div className="Dashboard-bentoGridTop">
          {/* 1. Total Revenue */}
          <div className="Dashboard-bentoCard col-4">
            <div className="Dashboard-cardHeader">
              <div className="Dashboard-cardHeaderLeft">
                <div className="Dashboard-badgeIcon blue">
                  <DollarSign size={18} />
                </div>
                <span className="Dashboard-cardTitle">
                  {datePreset === 'today' ? t('todaySales') : t('totalRevenue')}
                </span>
              </div>
              <span className="Dashboard-pillBadge blue">
                {kpis.todaySales.count} {kpis.todaySales.count === 1 ? t('sale') : t('sales')}
              </span>
            </div>
            <div className="Dashboard-cardBody">
              <div className="Dashboard-mainMetric">
                <AnimatedNumber value={kpis.todaySales.totalIQD} suffix=" IQD" />
              </div>
            </div>
            <div className="Dashboard-cardFooter">
              <span className="Dashboard-footerTag">
                <strong>{kpis.todaySales.totalItemsSold}</strong> {t('productsSold')}
              </span>
              <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                {t('average')} ~{kpis.todaySales.avgTicket.toLocaleString('en-IQ')} IQD
              </span>
            </div>
          </div>

          {/* 2. Total Profit */}
          <div className="Dashboard-bentoCard col-4">
            <div className="Dashboard-cardHeader">
              <div className="Dashboard-cardHeaderLeft">
                <div className={`Dashboard-badgeIcon ${kpis.todaySales.profitIQD < 0 ? 'red' : 'green'}`}>
                  <TrendingUp size={18} />
                </div>
                <span className="Dashboard-cardTitle">{t('totalProfit')}</span>
              </div>
              <span className={`Dashboard-pillBadge ${kpis.todaySales.profitIQD < 0 ? 'red' : 'green'}`}>
                {kpis.todaySales.profitIQD < 0 ? <TrendingDown size={12} /> : <ArrowUpRight size={12} />}
                <span>{profitMargin}% {t('margin')}</span>
              </span>
            </div>
            <div className="Dashboard-cardBody">
              <div
                className="Dashboard-mainMetric"
                style={{
                  color: kpis.todaySales.profitIQD < 0 ? '#ef4444' : '#10b981',
                  direction: 'ltr',
                  display: 'inline-block',
                }}
              >
                {kpis.todaySales.profitIQD < 0 ? (
                  `-${Math.abs(kpis.todaySales.profitIQD).toLocaleString('en-IQ')} IQD`
                ) : (
                  <AnimatedNumber value={kpis.todaySales.profitIQD} suffix=" IQD" />
                )}
              </div>
            </div>
            <div className="Dashboard-cardFooter">
              <span>{t('estimatedProfit')}</span>
              <span style={{ color: kpis.todaySales.profitIQD < 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                {profitMargin}%
              </span>
            </div>
          </div>

          {/* 3. Net Profit (After Expenses) */}
          <div className="Dashboard-bentoCard col-4">
            <div className="Dashboard-cardHeader">
              <div className="Dashboard-cardHeaderLeft">
                <div className={`Dashboard-badgeIcon ${netProfit < 0 ? 'red' : 'green'}`}>
                  {netProfit >= 0 ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                </div>
                <span className="Dashboard-cardTitle">{t('netProfit')}</span>
              </div>
              <span className="Dashboard-pillBadge blue">
                {t('afterExpenses')}
              </span>
            </div>
            <div className="Dashboard-cardBody">
              <div
                className="Dashboard-mainMetric"
                style={{
                  color: netProfit < 0 ? '#ef4444' : '#10b981',
                  direction: 'ltr',
                  display: 'inline-block',
                }}
              >
                {netProfit < 0 ? (
                  `-${Math.abs(netProfit).toLocaleString('en-IQ')} IQD`
                ) : (
                  <AnimatedNumber value={netProfit} suffix=" IQD" />
                )}
              </div>
            </div>
            <div className="Dashboard-cardFooter">
              <span>{t('expenses')}: {kpis.todayExpenses.toLocaleString('en-IQ')} IQD</span>
              <span style={{ color: netProfit >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                {netProfit >= 0 ? t('positiveFlow') || 'صافي إيجابي' : t('negativeFlow') || 'صافي سالب'}
              </span>
            </div>
          </div>

          {/* 4. Average Ticket */}
          <div className="Dashboard-bentoCard col-4">
            <div className="Dashboard-cardHeader">
              <div className="Dashboard-cardHeaderLeft">
                <div className="Dashboard-badgeIcon purple">
                  <ShoppingBag size={18} />
                </div>
                <span className="Dashboard-cardTitle">{t('avgTicket')}</span>
              </div>
              <span className="Dashboard-pillBadge purple">
                {t('perSale')}
              </span>
            </div>
            <div className="Dashboard-cardBody">
              <div className="Dashboard-mainMetric">
                <AnimatedNumber value={kpis.todaySales.avgTicket} suffix=" IQD" />
              </div>
            </div>
            <div className="Dashboard-cardFooter">
              <span>{t('avgTicketSale')}</span>
              <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                ~{Math.round(kpis.todaySales.totalItemsSold / (kpis.todaySales.count || 1))} {t('items')} / {t('sale')}
              </span>
            </div>
          </div>

          {/* 5. Operating Expenses */}
          <div className="Dashboard-bentoCard col-4">
            <div className="Dashboard-cardHeader">
              <div className="Dashboard-cardHeaderLeft">
                <div className="Dashboard-badgeIcon amber">
                  <Wallet size={18} />
                </div>
                <span className="Dashboard-cardTitle">{t('expenses')}</span>
              </div>
              <span className="Dashboard-pillBadge red">
                {t('todaysTotal')}
              </span>
            </div>
            <div className="Dashboard-cardBody">
              <div className="Dashboard-mainMetric">
                <AnimatedNumber value={kpis.todayExpenses} suffix=" IQD" />
              </div>
            </div>
            <div className="Dashboard-cardFooter">
              <span>{t('trackOperatingCosts')}</span>
              <button
                onClick={() => navigate('/expenses')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
              >
                {t('viewDetails')} →
              </button>
            </div>
          </div>

          {/* 6. Inventory Low Stock Alerts */}
          <div
            className="Dashboard-bentoCard col-4"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/reports')}
          >
            <div className="Dashboard-cardHeader">
              <div className="Dashboard-cardHeaderLeft">
                <div className={`Dashboard-badgeIcon ${kpis.lowStockCount > 0 ? 'red' : 'green'}`}>
                  {kpis.lowStockCount > 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                </div>
                <span className="Dashboard-cardTitle">{t('lowStock')}</span>
              </div>
              <span className={`Dashboard-pillBadge ${kpis.lowStockCount > 0 ? 'red' : 'green'}`}>
                {kpis.lowStockCount > 0 ? t('needAttention') : t('allGood')}
              </span>
            </div>
            <div className="Dashboard-cardBody">
              <div className="Dashboard-mainMetric">
                {kpis.lowStockCount}
              </div>
            </div>
            <div className="Dashboard-cardFooter">
              <span>{kpis.lowStockCount > 0 ? `${kpis.lowStockCount} ${t('items')} ${t('needAttention')}` : t('stockLevelsHealthy')}</span>
              <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                {t('viewReports')} →
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── 3. Mid Bento Grid (Charts & Peak Times) ────────── */}
      <div className="Dashboard-bentoGridMid">
        {/* Peak Hours Chart */}
        <div className="Dashboard-chartCardMid col-7">
          <div className="Dashboard-chartHead">
            <h3 className="Dashboard-chartTitleMid">
              <BarChart3 size={18} style={{ color: 'var(--accent-primary)' }} />
              <span>{t('peakHours')}</span>
            </h3>
            {(() => {
              const peakHour = peakHoursData.reduce(
                (max, h) => (h.saleCount > max.saleCount ? h : max),
                peakHoursData[0] || { hour: 0, saleCount: 0 }
              );
              return (
                <span className="Dashboard-peakHighlight">
                  <Trophy size={13} style={{ color: '#f59e0b' }} />
                  <span>
                    {t('peakHour')}: <strong>{peakHour?.hour || 0}:00</strong> ({peakHour?.saleCount || 0} {t('sales')})
                  </span>
                </span>
              );
            })()}
          </div>

          <div className="Dashboard-hourlyChart">
            {(() => {
              const maxSales = Math.max(...peakHoursData.map((h) => h.saleCount), 1);
              return peakHoursData
                .filter((h) => h.hour >= 8 && h.hour <= 22)
                .map((h) => {
                  const isPeak = h.saleCount === maxSales && h.saleCount > 0;
                  return (
                    <div
                      key={h.hour}
                      className="Dashboard-hourCol"
                      title={`${h.hour}:00 - ${h.saleCount} ${t('sales')} (${h.totalSalesIQD.toLocaleString('en-IQ')} IQD)`}
                    >
                      <div
                        className={`Dashboard-hourBar ${isPeak ? 'peak' : ''}`}
                        style={{ height: `${Math.max((h.saleCount / maxSales) * 100, 8)}%` }}
                      />
                      <span className="Dashboard-hourLabel">{h.hour}</span>
                    </div>
                  );
                });
            })()}
          </div>
        </div>

        {/* Peak Days Chart */}
        <div className="Dashboard-chartCardMid col-5">
          <div className="Dashboard-chartHead">
            <h3 className="Dashboard-chartTitleMid">
              <Calendar size={18} style={{ color: '#a855f7' }} />
              <span>{t('peakDays')}</span>
            </h3>
            {(() => {
              const peakDay = peakDaysData.reduce(
                (max, d) => (d.saleCount > max.saleCount ? d : max),
                peakDaysData[0] || { dayName: '—', saleCount: 0 }
              );
              return (
                <span className="Dashboard-peakHighlight">
                  <Trophy size={13} style={{ color: '#f59e0b' }} />
                  <span>{peakDay?.dayName || '—'}</span>
                </span>
              );
            })()}
          </div>

          <div className="Dashboard-dailyChart">
            {(() => {
              const maxSales = Math.max(...peakDaysData.map((d) => d.saleCount), 1);
              return peakDaysData.map((d) => {
                const isPeak = d.saleCount === maxSales && d.saleCount > 0;
                return (
                  <div
                    key={d.dayOfWeek}
                    className="Dashboard-dayCol"
                    title={`${d.dayName} - ${d.saleCount} ${t('sales')} (${d.totalSalesIQD.toLocaleString('en-IQ')} IQD)`}
                  >
                    <div
                      className={`Dashboard-dayBar ${isPeak ? 'peak' : ''}`}
                      style={{ height: `${Math.max((d.saleCount / maxSales) * 100, 8)}%` }}
                    />
                    <span className="Dashboard-dayLabel">{d.dayName}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* ── 4. Bottom Bento Grid (Invoices & Top Sellers) ──── */}
      {kpis && (
        <div className="Dashboard-bentoGridBottom">
          {/* Recent Invoices Feed */}
          <div className="Dashboard-feedCard col-7">
            <div className="Dashboard-feedHeader">
              <h2>
                <Receipt size={18} style={{ color: 'var(--accent-primary)' }} />
                <span>{t('recentSales')}</span>
              </h2>
              <button onClick={() => navigate('/sales')} className="Dashboard-feedLink">
                <span>{t('viewAll')}</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {kpis.recentSales.length === 0 ? (
              <div className="Dashboard-empty">
                <Receipt size={36} style={{ opacity: 0.35 }} />
                <p>{t('noSalesToday')}</p>
                <button
                  onClick={() => navigate('/pos')}
                  className="Dashboard-dockItem primary"
                  style={{ alignSelf: 'center' }}
                >
                  <ShoppingCart size={16} />
                  <span>{t('startSelling')}</span>
                </button>
              </div>
            ) : (
              <div className="Dashboard-invoicesList">
                {kpis.recentSales.slice(0, 5).map((sale: any) => (
                  <div
                    key={sale.id}
                    className="Dashboard-invoiceRow"
                    onClick={() => navigate(`/sales/${sale.id}`)}
                  >
                    <div className="Dashboard-invoiceLeft">
                      <span className="Dashboard-invoicePill">#{sale.id}</span>
                      <div className="Dashboard-invoiceMeta">
                        <span className="Dashboard-invoiceItems">
                          {sale.items?.length || 1} {t('items')} • {sale.paymentMethod || 'Cash'}
                        </span>
                        <span className="Dashboard-invoiceTime">
                          {formatEnglishDateTime(sale.saleDate)}
                        </span>
                      </div>
                    </div>
                    <div className="Dashboard-invoiceRight">
                      <span className="Dashboard-invoiceTotal">
                        {sale.totalIQD.toLocaleString('en-IQ')} IQD
                      </span>
                      <ArrowRight size={14} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Selling Products Podium */}
          <div className="Dashboard-feedCard col-5">
            <div className="Dashboard-feedHeader">
              <h2>
                <Trophy size={18} style={{ color: '#f59e0b' }} />
                <span>{t('topSelling')}</span>
              </h2>
              <button onClick={() => navigate('/reports')} className="Dashboard-feedLink">
                <span>{t('viewReports')}</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {!kpis.topSellingItems || kpis.topSellingItems.length === 0 ? (
              <div className="Dashboard-empty">
                <ShoppingBag size={36} style={{ opacity: 0.35 }} />
                <p>{t('noSalesYet')}</p>
              </div>
            ) : (
              <div className="Dashboard-podiumList">
                {kpis.topSellingItems.slice(0, 5).map((item: any, idx: number) => {
                  const maxQty = kpis.topSellingItems[0]?.totalQty || 1;
                  const barPercent = Math.round((item.totalQty / maxQty) * 100);
                  const rankClass = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : '';
                  return (
                    <div key={idx} className="Dashboard-podiumRow">
                      <div className={`Dashboard-podiumRank ${rankClass}`}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </div>
                      <div className="Dashboard-podiumInfo">
                        <span className="Dashboard-podiumName">{item.productName}</span>
                        <div className="Dashboard-podiumTrack">
                          <div
                            className="Dashboard-podiumFill"
                            style={{ width: `${barPercent}%` }}
                          />
                        </div>
                      </div>
                      <div className="Dashboard-podiumStats">
                        <span className="Dashboard-podiumQty">
                          {item.totalQty} {t('items')}
                        </span>
                        <span className="Dashboard-podiumRev">
                          {Math.round(item.revenueIQD).toLocaleString('en-IQ')} IQD
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 5. Quick Actions Dock ─────────────────────────── */}
      <div className="Dashboard-dockCard">
        <h2>{t('quickActions')}</h2>
        <div className="Dashboard-dockGrid">
          <button
            onClick={() => navigate('/pos')}
            className="Dashboard-dockItem primary"
          >
            <ShoppingCart size={18} />
            <span>{t('newSale')}</span>
          </button>
          <button onClick={() => navigate('/products')} className="Dashboard-dockItem">
            <Package size={18} />
            <span>{t('addProduct')}</span>
          </button>
          <button onClick={() => navigate('/reports')} className="Dashboard-dockItem">
            <BarChart3 size={18} />
            <span>{t('viewReports')}</span>
          </button>
          <button onClick={() => navigate('/backup')} className="Dashboard-dockItem">
            <Database size={18} />
            <span>{t('backupData')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
