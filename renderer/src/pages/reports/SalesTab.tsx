import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Leaf } from 'lucide-react';

type AdvancedReports = import('../../types/electron').AdvancedReports;
type PeakHourData = import('../../types/electron').PeakHourData;
type SeasonSalesItem = import('../../types/electron').SeasonSalesItem;

interface Props {
  reports: AdvancedReports;
  peakHours: PeakHourData[];
  seasonSales: SeasonSalesItem[];
  t: (key: string) => string;
}

const fmt = (n: number) => n.toLocaleString('en-IQ');
const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ec4899', '#f43f5e', '#84cc16'];

export const SalesTab = ({ reports, peakHours, seasonSales, t }: Props): JSX.Element => {
  const filteredHours = peakHours.filter(h => h.hour >= 8 && h.hour <= 22);

  // Helper to group top N items and sum the rest into "Other"
  const groupData = (data: any[], key: string, limit: number) => {
    const sorted = [...data].sort((a, b) => (b.revenueIQD ?? b.quantity) - (a.revenueIQD ?? a.quantity));
    const top = sorted.slice(0, limit);
    const other = sorted.slice(limit);
    if (other.length > 0) {
      top.push({
        [key]: t('other') || 'Other',
        revenueIQD: other.reduce((s, e) => s + (e.revenueIQD || 0), 0),
        quantity: other.reduce((s, e) => s + (e.quantity || 0), 0)
      });
    }
    return top;
  };

  const pieSeason = groupData(seasonSales, 'season', 6);
  const pieSize = groupData(reports.salesBySize, 'name', 6);
  const pieColor = groupData(reports.salesByColor, 'name', 6);

  return (
    <>
      {/* Season Sales */}
      {seasonSales.length > 0 && (
        <div className="Reports-chartRow">
          <div className="Reports-chartCard">
            <h3><Leaf size={18} /> {t('salesBySeason') || 'مبيعات حسب الموسم'}</h3>
            <div className="Reports-chartWrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={seasonSales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="season" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#f1f5f9' }} itemStyle={{ color: '#cbd5e1' }}
                    formatter={(value: any) => [fmt(value || 0) + ' IQD']}
                  />
                  <Legend />
                  <Bar dataKey="revenueIQD" name={t('revenue') || 'Revenue'} fill="#8b5cf6" radius={[4,4,0,0]} />
                  <Bar dataKey="profitIQD" name={t('profit') || 'Profit'} fill="#22c55e" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="Reports-chartCard">
            <h3>{t('seasonBreakdown') || 'توزيع المواسم'}</h3>
            <div className="Reports-chartWrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieSeason} dataKey="revenueIQD" nameKey="season" cx="50%" cy="50%" outerRadius={90} label={({ season, percent }) => percent > 0.04 ? `${season} ${(percent * 100).toFixed(0)}%` : ''}>
                    {pieSeason.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8 }} labelStyle={{ color: '#f1f5f9' }} itemStyle={{ color: '#cbd5e1' }} formatter={(v: any) => [fmt(v || 0) + ' IQD']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Season Detail Table */}
      {seasonSales.length > 0 && (
        <section className="Reports-grid">
          <article className="Reports-fullWidth">
            <header><h3><Leaf size={18} /> {t('seasonDetails') || 'تفاصيل المواسم'}</h3></header>
            <table>
              <thead><tr>
                <th>{t('season') || 'الموسم'}</th>
                <th>{t('products') || 'المنتجات'}</th>
                <th>{t('qty')}</th>
                <th>{t('revenue')}</th>
                <th>{t('profit')}</th>
              </tr></thead>
              <tbody>
                {seasonSales.map((s) => (
                  <tr key={s.season}>
                    <td><span className="Reports-seasonBadge">{s.season}</span></td>
                    <td>{s.itemCount}</td>
                    <td>{fmt(s.quantity)}</td>
                    <td>{fmt(s.revenueIQD)} IQD</td>
                    <td className={s.profitIQD < 0 ? 'Reports-negativeValue' : ''}>{fmt(s.profitIQD)} IQD</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </section>
      )}

      {/* Peak Hours */}
      <div className="Reports-chartRow">
        <div className="Reports-chartCard Reports-chartCard--full">
          <h3>{t('peakHours') || 'Peak Hours'}</h3>
          <div className="Reports-chartWrap--small" style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(h) => `${h}:00`} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: 8 }} labelStyle={{ color: '#f1f5f9' }} itemStyle={{ color: '#cbd5e1' }} />
                <Bar dataKey="saleCount" name={t('sales') || 'Sales'} fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Sales by Size & Color */}
      <div className="Reports-chartRow">
        <div className="Reports-chartCard">
          <h3>{t('salesBySize')}</h3>
          {reports.salesBySize.length === 0 ? <div className="Reports-empty">{t('noData')}</div> : (
            <div className="Reports-chartWrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieSize} dataKey="quantity" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => percent > 0.04 ? `${name} ${(percent*100).toFixed(0)}%` : ''}>
                    {pieSize.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8 }} labelStyle={{ color: '#f1f5f9' }} itemStyle={{ color: '#cbd5e1' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="Reports-chartCard">
          <h3>{t('salesByColor')}</h3>
          {reports.salesByColor.length === 0 ? <div className="Reports-empty">{t('noData')}</div> : (
            <div className="Reports-chartWrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieColor} dataKey="quantity" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => percent > 0.04 ? `${name} ${(percent*100).toFixed(0)}%` : ''}>
                    {pieColor.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8 }} labelStyle={{ color: '#f1f5f9' }} itemStyle={{ color: '#cbd5e1' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Daily Sales Table */}
      <section className="Reports-grid">
        <article className="Reports-fullWidth">
          <header><h3>{t('dailySalesSummary')}</h3></header>
          {reports.dailySales.length === 0 ? <div className="Reports-empty">{t('noSalesInRange')}</div> : (
            <table>
              <thead><tr><th>{t('date')}</th><th>{t('ordersReport')}</th><th>{t('totalReport')}</th><th>{t('avgTicket')}</th></tr></thead>
              <tbody>
                {reports.dailySales.map((e) => (
                  <tr key={e.date}><td>{e.date}</td><td>{e.orders}</td><td>{fmt(e.totalIQD)}</td><td>{fmt(e.avgTicket)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </section>
    </>
  );
};
