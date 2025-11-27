import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import './Pages.css';
import './DashboardPage.css';

type DashboardKPIs = import('../types/electron').DashboardKPIs;
type Sale = import('../types/electron').Sale;

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

  const getDateRange = (preset: DateRangePreset): { startDate: string; endDate: string } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    switch (preset) {
      case 'today': {
        return {
          startDate: today.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        };
      }
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);
        return {
          startDate: yesterday.toISOString().split('T')[0],
          endDate: yesterdayEnd.toISOString().split('T')[0],
        };
      }
      case 'last2days': {
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 1);
        return {
          startDate: twoDaysAgo.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        };
      }
      case 'last7days': {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        return {
          startDate: sevenDaysAgo.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        };
      }
      case 'last30days': {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
        return {
          startDate: thirtyDaysAgo.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        };
      }
      case 'thisMonth': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
          startDate: firstDay.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        };
      }
      case 'lastMonth': {
        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          startDate: firstDayLastMonth.toISOString().split('T')[0],
          endDate: lastDayLastMonth.toISOString().split('T')[0],
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
          startDate: today.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        };
      }
      default:
        return {
          startDate: today.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        };
    }
  };

  const loadKPIs = useCallback(async () => {
    if (!window.evaApi || !token) {
      setError('Desktop bridge unavailable.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const branchId = user?.branchId ?? undefined;
      const dateRange = getDateRange(datePreset);
      const data = await window.evaApi.dashboard.getKPIs(token, branchId, dateRange);
      setKpis(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [token, user?.branchId, datePreset, customStartDate, customEndDate]);

  useEffect(() => {
    if (token) {
      loadKPIs();
    }
  }, [token, loadKPIs]);

  if (loading) {
    return (
      <div className="Page">
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

  if (error || !kpis) {
    return (
      <div className="Page">
        <div className="Page-header">
          <h1>{t('dashboard')}</h1>
        </div>
        <div className="Page-content">
          <div className="Dashboard-error">{error || 'Failed to load dashboard'}</div>
        </div>
      </div>
    );
  }

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
          <button className="Dashboard-refresh" onClick={loadKPIs} disabled={loading}>
            <span className="refresh-icon">🔄</span>
            {loading ? t('loading') : t('refresh')}
          </button>
        </div>
      </div>

      <div className="Page-content">
        {/* Main KPI Cards */}
        <div className="Dashboard-kpis">
          <div className="Dashboard-kpiCard Dashboard-kpiCard--primary">
            <div className="Dashboard-kpiIcon">💰</div>
            <div className="Dashboard-kpiContent">
              <div className="Dashboard-kpiLabel">{datePreset === 'today' ? t('todaySales') : t('sales')}</div>
              <div className="Dashboard-kpiValue">{kpis.todaySales.totalIQD.toLocaleString('en-IQ')} IQD</div>
              <div className="Dashboard-kpiSubtext">
                <strong>{kpis.todaySales.count}</strong> {kpis.todaySales.count === 1 ? t('sale') : t('sales')}
              </div>
            </div>
          </div>

          <div className="Dashboard-kpiCard Dashboard-kpiCard--success">
            <div className="Dashboard-kpiIcon">📈</div>
            <div className="Dashboard-kpiContent">
              <div className="Dashboard-kpiLabel">{t('totalProfit')}</div>
              <div className="Dashboard-kpiValue">{kpis.todaySales.profitIQD.toLocaleString('en-IQ')} IQD</div>
              <div className="Dashboard-kpiSubtext">{profitMargin}% {t('margin')}</div>
            </div>
          </div>

          <div className="Dashboard-kpiCard Dashboard-kpiCard--info">
            <div className="Dashboard-kpiIcon">🛍️</div>
            <div className="Dashboard-kpiContent">
              <div className="Dashboard-kpiLabel">{t('avgTicket')}</div>
              <div className="Dashboard-kpiValue">{kpis.todaySales.avgTicket.toLocaleString('en-IQ')} IQD</div>
              <div className="Dashboard-kpiSubtext">{t('perSale')}</div>
            </div>
          </div>

          <div className="Dashboard-kpiCard Dashboard-kpiCard--warning">
            <div className="Dashboard-kpiIcon">💸</div>
            <div className="Dashboard-kpiContent">
              <div className="Dashboard-kpiLabel">{t('expenses')}</div>
              <div className="Dashboard-kpiValue">{kpis.todayExpenses.toLocaleString('en-IQ')} IQD</div>
              <div className="Dashboard-kpiSubtext">{t('todaysTotal')}</div>
            </div>
          </div>

          <div className={`Dashboard-kpiCard ${netProfit >= 0 ? 'Dashboard-kpiCard--success' : 'Dashboard-kpiCard--danger'}`}>
            <div className="Dashboard-kpiIcon">{netProfit >= 0 ? '✅' : '⚠️'}</div>
            <div className="Dashboard-kpiContent">
              <div className="Dashboard-kpiLabel">{t('netProfit')}</div>
              <div className="Dashboard-kpiValue">{netProfit.toLocaleString('en-IQ')} IQD</div>
              <div className="Dashboard-kpiSubtext">{t('afterExpenses')}</div>
            </div>
          </div>

          <div className={`Dashboard-kpiCard ${kpis.lowStockCount > 0 ? 'Dashboard-kpiCard--danger' : 'Dashboard-kpiCard--success'}`}>
            <div className="Dashboard-kpiIcon">{kpis.lowStockCount > 0 ? '⚠️' : '✅'}</div>
            <div className="Dashboard-kpiContent">
              <div className="Dashboard-kpiLabel">{t('lowStock')}</div>
              <div className="Dashboard-kpiValue">{kpis.lowStockCount}</div>
              <div className="Dashboard-kpiSubtext">{kpis.lowStockCount > 0 ? t('needAttention') : t('allGood')}</div>
            </div>
          </div>
        </div>

        {/* Recent Sales & Low Stock */}
        <div className="Dashboard-grid">
          <div className="Dashboard-section">
            <div className="Dashboard-sectionHeader">
              <h2>{t('recentSales')}</h2>
              <button onClick={() => navigate('/sales')} className="Dashboard-viewAll">
                {t('viewAll')} →
              </button>
            </div>
            {kpis.recentSales.length === 0 ? (
              <div className="Dashboard-empty">
                <div className="Dashboard-emptyIcon">📊</div>
                <p>{t('noSalesToday')}</p>
                <button onClick={() => navigate('/pos')} className="Dashboard-emptyButton">
                  {t('startSelling')}
                </button>
              </div>
            ) : (
              <div className="Dashboard-salesList">
                {kpis.recentSales.map((sale: Sale) => (
                  <div
                    key={sale.id}
                    className="Dashboard-saleItem"
                    onClick={() => navigate(`/sales/${sale.id}`)}
                  >
                    <div className="Dashboard-saleIcon">🧾</div>
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
                    <div className="Dashboard-saleArrow">→</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="Dashboard-section">
            <div className="Dashboard-sectionHeader">
              <h2>{t('lowStockAlert')}</h2>
              <button onClick={() => navigate('/products')} className="Dashboard-viewAll">
                {t('viewAll')} →
              </button>
            </div>
            {kpis.lowStockItems.length === 0 ? (
              <div className="Dashboard-empty">
                <div className="Dashboard-emptyIcon">✅</div>
                <p>{t('allItemsInStock')}</p>
              </div>
            ) : (
              <div className="Dashboard-lowStockList">
                {kpis.lowStockItems.map((item, idx) => (
                  <div key={idx} className="Dashboard-lowStockItem">
                    <div className="Dashboard-lowStockIcon">⚠️</div>
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
              <span className="Dashboard-actionIcon">🛒</span>
              <span>{t('newSale')}</span>
            </button>
            <button onClick={() => navigate('/products')} className="Dashboard-actionButton">
              <span className="Dashboard-actionIcon">📦</span>
              <span>{t('addProduct')}</span>
            </button>
            <button onClick={() => navigate('/reports')} className="Dashboard-actionButton">
              <span className="Dashboard-actionIcon">📊</span>
              <span>{t('viewReports')}</span>
            </button>
            <button onClick={() => navigate('/backup')} className="Dashboard-actionButton">
              <span className="Dashboard-actionIcon">💾</span>
              <span>{t('backupData')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
