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
  Database
} from 'lucide-react';
import './Pages.css';
import './DashboardPage.css';

type DashboardKPIs = import('../types/electron').DashboardKPIs;
type PeakHourData = import('../types/electron').PeakHourData;
type PeakDayData = import('../types/electron').PeakDayData;

type DateRangePreset = 'today' | 'yesterday' | 'last2days' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom';

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
    // Use UTC date to match SalesHistoryPage logic and database storage
    return date.toISOString().split('T')[0];
  };

  const getDateRange = (preset: DateRangePreset): { startDate: string; endDate: string } => {
    // Initialize 'today' to Noon to avoid timezone shifts when converting to UTC.
    // e.g. 00:00 Local -> Previous Day UTC. 12:00 Local -> Same Day UTC.
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    switch (preset) {
      case 'today': {
        return {
          startDate: formatDate(today),
          endDate: formatDate(today),
        };
      }
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          startDate: formatDate(yesterday),
          endDate: formatDate(yesterday),
        };
      }
      case 'last2days': {
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 1);
        return {
          startDate: formatDate(twoDaysAgo),
          endDate: formatDate(today),
        };
      }
      case 'last7days': {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        return {
          startDate: formatDate(sevenDaysAgo),
          endDate: formatDate(today),
        };
      }
      case 'last30days': {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
        return {
          startDate: formatDate(thirtyDaysAgo),
          endDate: formatDate(today),
        };
      }
      case 'thisMonth': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        firstDay.setHours(12, 0, 0, 0); // Ensure Noon
        return {
          startDate: formatDate(firstDay),
          endDate: formatDate(today),
        };
      }
      case 'lastMonth': {
        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        firstDayLastMonth.setHours(12, 0, 0, 0); // Ensure Noon

        const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        lastDayLastMonth.setHours(12, 0, 0, 0); // Ensure Noon

        return {
          startDate: formatDate(firstDayLastMonth),
          endDate: formatDate(lastDayLastMonth),
        };
      }
      case 'custom': {
        if (customStartDate && customEndDate) {
          return {
            startDate: customStartDate,
            endDate: customEndDate,
          };
        }
        // Fallback to today if custom dates not set
        return {
          startDate: formatDate(today),
          endDate: formatDate(today),
        };
      }
      default:
        return {
          startDate: formatDate(today),
          endDate: formatDate(today),
        };
    }
  };

  const loadKPIs = useCallback(async (isRefresh = false) => {
    if (!window.evaApi || !token) {
      setError('Desktop bridge unavailable.');
      setLoading(false);
      return;
    }

    try {
      if (!isRefresh) setLoading(true);
      const branchId = user?.branchId ?? undefined;
      const dateRange = getDateRange(datePreset);

      const [data, peakHours, peakDays] = await Promise.all([
        window.evaApi.dashboard.getKPIs(token, branchId, dateRange),
        window.evaApi.reports.peakHours(token, { startDate: dateRange.startDate, endDate: dateRange.endDate, branchId }),
        window.evaApi.reports.peakDays(token, { startDate: dateRange.startDate, endDate: dateRange.endDate, branchId }),
      ]);

      setKpis(data);
      setPeakHoursData(peakHours);
      setPeakDaysData(peakDays);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [token, user?.branchId, datePreset, customStartDate, customEndDate]);

  // Initial load
  useEffect(() => {
    if (token && !kpis) {
      loadKPIs();
    }
  }, [token, kpis, loadKPIs]);

  // Handle date changes with debounce for custom range
  useEffect(() => {
    if (!token || !kpis) return;

    if (datePreset === 'custom') {
      if (customStartDate && customEndDate) {
        const timer = setTimeout(() => {
          loadKPIs(true);
        }, 600);
        return () => clearTimeout(timer);
      }
    } else {
      loadKPIs(true);
    }
  }, [datePreset, customStartDate, customEndDate, token]);

  // Error state (initial)
  if (error && !kpis) {
    return (
      <div className="Page Dashboard">
        <div className="Page-header">
          <h1>{t('dashboard')}</h1>
        </div>
        <div className="Page-content">
          <div className="Dashboard-error">{error}</div>
          <button className="Dashboard-refresh" onClick={() => loadKPIs()} style={{ marginTop: '1rem' }}>
            <RefreshCw size={18} /> {t('retry') || 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  // Initial loading state
  if (loading && !kpis) {
    return (
      <div className="Page Dashboard">
        <div className="Page-header">
          <h1>{t('dashboard')}</h1>
        </div>
        <div className="Page-content">
          <div className="Dashboard-loading">
            <div className="spinner"></div>
            <p>{t('loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Fallback if kpis is still null (should not happen)
  if (!kpis) return <div className="Page Dashboard" />;

  // Calculate additional metrics
  const netProfit = kpis.todaySales.profitIQD - kpis.todayExpenses;
  const profitMargin = kpis.todaySales.totalIQD > 0
    ? ((kpis.todaySales.profitIQD / kpis.todaySales.totalIQD) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="Page Dashboard">
      <div className="Page-header">
        <div>
          <h1>{t('dashboard')}</h1>
          <p className="Dashboard-subtitle">
            {t('welcomeBack')}, {user?.username}!
          </p>
        </div>
        <div className="Dashboard-headerActions">
          <div className="Dashboard-dateSelector">
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DateRangePreset)}
              className="Dashboard-datePreset"
            >
              <option value="today">{t('today')}</option>
              <option value="yesterday">{t('yesterday')}</option>
              <option value="last2days">{t('last2days')}</option>
              <option value="last7days">{t('last7days')}</option>
              <option value="last30days">{t('last30days')}</option>
              <option value="thisMonth">{t('thisMonth')}</option>
              <option value="lastMonth">{t('lastMonth')}</option>
              <option value="custom">{t('customRange')}</option>
            </select>
            {datePreset === 'custom' && (
              <div className="Dashboard-customDates">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="Dashboard-dateInput"
                />
                <span>{t('to')}</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="Dashboard-dateInput"
                />
              </div>
            )}
          </div>
          <button className="Dashboard-refresh" onClick={() => loadKPIs(true)} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
            {loading ? t('loading') : t('refresh')}
          </button>
        </div>
      </div>

      <div className="Page-content">
        {/* Main KPI Cards */}
        <div className="Dashboard-kpis">
          <div className="Dashboard-kpiCard Dashboard-kpiCard--primary">
            <div className="Dashboard-kpiIcon"><DollarSign size={24} /></div>
            <div className="Dashboard-kpiContent">
              <div className="Dashboard-kpiLabel">{datePreset === 'today' ? t('todaySales') : t('sales')}</div>
              <div className="Dashboard-kpiValue">{kpis.todaySales.totalIQD.toLocaleString('en-IQ')} IQD</div>
              <div className="Dashboard-kpiSubtext">
                <strong>{kpis.todaySales.count}</strong> {kpis.todaySales.count === 1 ? t('sale') : t('sales')} • <strong>{kpis.todaySales.totalItemsSold}</strong> {t('productsSold') || 'products sold'}
              </div>
            </div>
          </div>

          <div className="Dashboard-kpiCard Dashboard-kpiCard--success">
            <div className="Dashboard-kpiIcon"><TrendingUp size={24} /></div>
            <div className="Dashboard-kpiContent">
              <div className="Dashboard-kpiLabel">{t('totalProfit')}</div>
              <div className="Dashboard-kpiValue">{kpis.todaySales.profitIQD.toLocaleString('en-IQ')} IQD</div>
              <div className="Dashboard-kpiSubtext">{profitMargin}% {t('margin')}</div>
            </div>
          </div>

          <div className="Dashboard-kpiCard Dashboard-kpiCard--info">
            <div className="Dashboard-kpiIcon"><ShoppingBag size={24} /></div>
            <div className="Dashboard-kpiContent">
              <div className="Dashboard-kpiLabel">{t('avgTicket')}</div>
              <div className="Dashboard-kpiValue">{kpis.todaySales.avgTicket.toLocaleString('en-IQ')} IQD</div>
              <div className="Dashboard-kpiSubtext">{t('perSale')}</div>
            </div>
          </div>

          <div className="Dashboard-kpiCard Dashboard-kpiCard--warning">
            <div className="Dashboard-kpiIcon"><Wallet size={24} /></div>
            <div className="Dashboard-kpiContent">
              <div className="Dashboard-kpiLabel">{t('expenses')}</div>
              <div className="Dashboard-kpiValue">{kpis.todayExpenses.toLocaleString('en-IQ')} IQD</div>
              <div className="Dashboard-kpiSubtext">{t('todaysTotal')}</div>
            </div>
          </div>

          <div className={`Dashboard-kpiCard ${netProfit >= 0 ? 'Dashboard-kpiCard--success' : 'Dashboard-kpiCard--danger'}`}>
            <div className="Dashboard-kpiIcon">{netProfit >= 0 ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}</div>
            <div className="Dashboard-kpiContent">
              <div className="Dashboard-kpiLabel">{t('netProfit')}</div>
              <div className="Dashboard-kpiValue">{netProfit.toLocaleString('en-IQ')} IQD</div>
              <div className="Dashboard-kpiSubtext">{t('afterExpenses')}</div>
            </div>
          </div>

          <div className={`Dashboard-kpiCard ${kpis.lowStockCount > 0 ? 'Dashboard-kpiCard--danger' : 'Dashboard-kpiCard--success'}`}>
            <div className="Dashboard-kpiIcon">{kpis.lowStockCount > 0 ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}</div>
            <div className="Dashboard-kpiContent">
              <div className="Dashboard-kpiLabel">{t('lowStock')}</div>
              <div className="Dashboard-kpiValue">{kpis.lowStockCount}</div>
              <div className="Dashboard-kpiSubtext">{kpis.lowStockCount > 0 ? t('needAttention') : t('allGood')}</div>
            </div>
          </div>
        </div>

        {/* Peak Hours & Peak Days Charts */}
        <div className="Dashboard-chartsRow">
          <div className="Dashboard-chartCard">
            <h3 className="Dashboard-chartTitle"><BarChart3 size={20} /> {t('peakHours')}</h3>
            <div className="Dashboard-chartSummary">
              {(() => {
                const totalSales = peakHoursData.reduce((sum, h) => sum + h.saleCount, 0);
                const totalIQD = peakHoursData.reduce((sum, h) => sum + h.totalSalesIQD, 0);
                const peakHour = peakHoursData.reduce((max, h) => h.saleCount > max.saleCount ? h : max, peakHoursData[0] || { hour: 0, saleCount: 0 });
                return (
                  <div className="Dashboard-chartStats">
                    <span><Trophy size={16} /> {t('peakHour')}: <strong>{peakHour?.hour || 0}:00</strong> ({peakHour?.saleCount || 0} {t('sales')})</span>
                    <span><Package size={16} /> {t('total')}: {totalSales} {t('sales')} | {(totalIQD / 1000).toFixed(0)}K IQD</span>
                  </div>
                );
              })()}
            </div>
            <div className="Dashboard-barChart">
              {(() => {
                const maxSales = Math.max(...peakHoursData.map(h => h.saleCount), 1);
                return peakHoursData.filter(h => h.hour >= 8 && h.hour <= 22).map((h) => (
                  <div key={h.hour} className="Dashboard-barItem" title={`${h.hour}:00 - ${h.saleCount} ${t('sales')} (${h.totalSalesIQD.toLocaleString()} IQD)`}>
                    <div className="Dashboard-bar" style={{ height: `${(h.saleCount / maxSales) * 100}%`, background: h.saleCount === maxSales && h.saleCount > 0 ? '#22c55e' : 'rgba(59,130,246,0.7)' }} />
                    <span className="Dashboard-barLabel">{h.hour}</span>
                  </div>
                ));
              })()}
            </div>
          </div>

          <div className="Dashboard-chartCard">
            <h3 className="Dashboard-chartTitle"><Calendar size={20} /> {t('peakDays')}</h3>
            <div className="Dashboard-chartSummary">
              {(() => {
                const totalSales = peakDaysData.reduce((sum, d) => sum + d.saleCount, 0);
                const totalIQD = peakDaysData.reduce((sum, d) => sum + d.totalSalesIQD, 0);
                const peakDay = peakDaysData.reduce((max, d) => d.saleCount > max.saleCount ? d : max, peakDaysData[0] || { dayName: '-', saleCount: 0 });
                return (
                  <div className="Dashboard-chartStats">
                    <span><Trophy size={16} /> {t('peakDay')}: <strong>{peakDay?.dayName || '-'}</strong> ({peakDay?.saleCount || 0} {t('sales')})</span>
                    <span><Package size={16} /> {t('total')}: {totalSales} {t('sales')} | {(totalIQD / 1000).toFixed(0)}K IQD</span>
                  </div>
                );
              })()}
            </div>
            <div className="Dashboard-barChart Dashboard-barChart--days">
              {(() => {
                const maxSales = Math.max(...peakDaysData.map(d => d.saleCount), 1);
                return peakDaysData.map((d) => (
                  <div key={d.dayOfWeek} className="Dashboard-barItem Dashboard-barItem--day" title={`${d.dayName} - ${d.saleCount} ${t('sales')} (${d.totalSalesIQD.toLocaleString()} IQD)`}>
                    <span className="Dashboard-barValue">{d.saleCount}</span>
                    <div className="Dashboard-bar" style={{ height: `${(d.saleCount / maxSales) * 100}%`, background: d.saleCount === maxSales && d.saleCount > 0 ? '#22c55e' : 'rgba(168,85,247,0.7)' }} />
                    <span className="Dashboard-barLabel">{d.dayName}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Recent Sales & Low Stock */}
        <div className="Dashboard-grid">
          <div className="Dashboard-section">
            <div className="Dashboard-sectionHeader">
              <h2>{t('recentSales')}</h2>
              <button onClick={() => navigate('/sales')} className="Dashboard-viewAll">
                {t('viewAll')} <ArrowRight size={16} />
              </button>
            </div>
            {kpis.recentSales.length === 0 ? (
              <div className="Dashboard-empty">
                <div className="Dashboard-emptyIcon"><BarChart3 size={48} /></div>
                <p>{t('noSalesToday')}</p>
                <button onClick={() => navigate('/pos')} className="Dashboard-emptyButton">
                  {t('startSelling')}
                </button>
              </div>
            ) : (
              <div className="Dashboard-salesList">
                {kpis.recentSales.map((sale: any) => (
                  <div
                    key={sale.id}
                    className="Dashboard-saleItem"
                    onClick={() => navigate(`/sales/${sale.id}`)}
                  >
                    <div className="Dashboard-saleIcon"><Receipt size={20} /></div>
                    <div className="Dashboard-saleInfo">
                      <div className="Dashboard-saleId">{t('sale')} #{sale.id}</div>
                      <div className="Dashboard-saleDate">
                        {new Date(sale.saleDate).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div className="Dashboard-saleAmount">{sale.totalIQD.toLocaleString('en-IQ')} IQD</div>
                    <div className="Dashboard-saleArrow"><ArrowRight size={16} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="Dashboard-section">
            <div className="Dashboard-sectionHeader">
              <h2>{t('lowStockAlert')}</h2>
              <button onClick={() => navigate('/products')} className="Dashboard-viewAll">
                {t('viewAll')} <ArrowRight size={16} />
              </button>
            </div>
            {kpis.lowStockItems.length === 0 ? (
              <div className="Dashboard-empty">
                <div className="Dashboard-emptyIcon"><CheckCircle2 size={48} /></div>
                <p>{t('allItemsInStock')}</p>
              </div>
            ) : (
              <div className="Dashboard-lowStockList">
                {kpis.lowStockItems.map((item: any, idx: number) => (
                  <div key={idx} className="Dashboard-lowStockItem">
                    <div className="Dashboard-lowStockIcon"><AlertTriangle size={20} /></div>
                    <div className="Dashboard-lowStockInfo">
                      <div className="Dashboard-lowStockName">{item.productName}</div>
                      <div className="Dashboard-lowStockDetails">
                        <span className="Dashboard-lowStockVariant">
                          {[item.color, item.size].filter(Boolean).join(' / ') || 'N/A'}
                        </span>
                        <span className="Dashboard-lowStockSku">{item.sku}</span>
                      </div>
                    </div>
                    <div className="Dashboard-lowStockQty">
                      <span className="Dashboard-lowStockQtyValue">{item.quantity}</span>
                      <span className="Dashboard-lowStockQtyLabel">{t('left')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="Dashboard-actions">
          <h2>{t('quickActions')}</h2>
          <div className="Dashboard-actionButtons">
            <button onClick={() => navigate('/pos')} className="Dashboard-actionButton Dashboard-actionButton--primary">
              <span className="Dashboard-actionIcon"><ShoppingCart size={24} /></span>
              <span>{t('newSale')}</span>
            </button>
            <button onClick={() => navigate('/products')} className="Dashboard-actionButton">
              <span className="Dashboard-actionIcon"><Package size={24} /></span>
              <span>{t('addProduct')}</span>
            </button>
            <button onClick={() => navigate('/reports')} className="Dashboard-actionButton">
              <span className="Dashboard-actionIcon"><BarChart3 size={24} /></span>
              <span>{t('viewReports')}</span>
            </button>
            <button onClick={() => navigate('/backup')} className="Dashboard-actionButton">
              <span className="Dashboard-actionIcon"><Database size={24} /></span>
              <span>{t('backupData')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
