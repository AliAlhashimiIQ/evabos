import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, ShoppingBag, Package, RotateCcw, DollarSign } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

type AdvancedReports = import('../../types/electron').AdvancedReports;
type PeakDayData = import('../../types/electron').PeakDayData;

interface Props {
  reports: AdvancedReports;
  peakDays: PeakDayData[];
  t: (key: string) => string;
}

const fmt = (n: number) => n.toLocaleString('en-IQ');

export const OverviewTab = ({ reports, peakDays, t }: Props): JSX.Element => {
  const { language } = useLanguage();
  const { profitAnalysis: pa } = reports;
  const margin = pa.profitMarginPercent;

  const localizedPeakDays = peakDays.map(day => {
    // 2026-07-12 is a Sunday (dayOfWeek = 0)
    const date = new Date(2026, 6, 12 + day.dayOfWeek);
    const dayName = date.toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-US', { weekday: 'long' });
    return { ...day, dayName };
  });

  return (
    <>
      {/* KPI Cards */}
      <section className="Reports-stats">
        <div>
          <span><DollarSign size={14} /> {t('revenueIQD')}</span>
          <strong>{fmt(pa.revenueIQD)}</strong>
        </div>
        <div>
          <span>{t('costOfGoods')}</span>
          <strong>{fmt(pa.costIQD)}</strong>
        </div>
        <div>
          <span>{t('expenses')}</span>
          <strong>{fmt(pa.expensesIQD)}</strong>
        </div>
        <div className={pa.netProfitIQD >= 0 ? 'Reports-stat--positive' : 'Reports-stat--negative'}>
          <span>{t('netProfit')}</span>
          <strong>{fmt(pa.netProfitIQD)}</strong>
          <small className="Reports-margin">({margin}%)</small>
        </div>
        <div>
          <span><Package size={14} /> {t('totalItemsSold')}</span>
          <strong>{fmt(reports.totalItemsSold || 0)}</strong>
        </div>
        <div>
          <span>{t('inventoryValue')}</span>
          <strong>{fmt(reports.inventoryValue)}</strong>
        </div>
        <div>
          <span>{t('totalStockCount') || 'Items in Stock'}</span>
          <strong>{fmt(reports.totalItemsInStock || 0)}</strong>
        </div>
        <div>
          <span><RotateCcw size={14} /> {t('returns')}</span>
          <strong>{fmt(reports.returnsSummary.totalIQD)}</strong>
          <small>({reports.returnsSummary.count} {t('items')})</small>
        </div>
      </section>

      {/* Charts Row */}
      <div className="Reports-chartRow">
        {/* Revenue Trend */}
        <div className="Reports-chartCard Reports-chartCard--full">
          <h3><TrendingUp size={18} /> {t('dailySalesSummary')}</h3>
          {reports.dailySales.length === 0 ? (
            <div className="Reports-empty">{t('noSalesInRange')}</div>
          ) : (
            <div className="Reports-chartWrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reports.dailySales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ borderRadius: 10 }}
                    formatter={(value: any, name: any) => [fmt(value || 0) + ' IQD', name === 'totalIQD' ? t('revenue') || 'Revenue' : t('avgTicket')]}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="totalIQD" name={t('revenue') || 'Revenue'} stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="avgTicket" name={t('avgTicket')} stroke="#a78bfa" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Expenses vs Sales + Top 5 */}
      <div className="Reports-chartRow">
        <div className="Reports-chartCard">
          <h3><ShoppingBag size={18} /> {t('expensesVsSales')}</h3>
          {reports.expensesVsSales.length === 0 ? (
            <div className="Reports-empty">{t('noData')}</div>
          ) : (
            <div className="Reports-chartWrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reports.expensesVsSales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ borderRadius: 10 }} />
                  <Legend />
                  <Bar dataKey="salesIQD" name={t('salesReport') || 'Sales'} fill="#3b82f6" radius={[4,4,0,0]} />
                  <Bar dataKey="expensesIQD" name={t('expensesReport') || 'Expenses'} fill="#f87171" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="Reports-chartCard">
          <h3><TrendingDown size={18} /> {t('bestSellingItems')}</h3>
          {reports.bestSellingItems.length === 0 ? (
            <div className="Reports-empty">{t('noData')}</div>
          ) : (
            <div className="Reports-chartWrap" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reports.bestSellingItems.slice(0, 7)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis dataKey="name" type="category" width={160} tickMargin={10} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 10 }} />
                  <Bar dataKey="quantity" name={t('qty')} fill="#8b5cf6" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Peak Days Chart */}
      {localizedPeakDays.length > 0 && (
        <div className="Reports-chartRow">
          <div className="Reports-chartCard Reports-chartCard--full">
            <h3>{t('peakDays') || 'Peak Days'}</h3>
            <div className="Reports-chartWrap--small" style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={localizedPeakDays}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="dayName" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ borderRadius: 10 }} />
                  <Bar dataKey="saleCount" name={t('sales') || 'Sales'} fill="#22c55e" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
