import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Receipt } from 'lucide-react';

type AdvancedReports = import('../../types/electron').AdvancedReports;
type ExpenseByCategoryItem = import('../../types/electron').ExpenseByCategoryItem;

interface Props {
  reports: AdvancedReports;
  expensesByCategory: ExpenseByCategoryItem[];
  t: (key: string) => string;
}

const fmt = (n: number) => n.toLocaleString('en-IQ');
const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#22c55e', '#ec4899', '#06b6d4', '#84cc16'];

export const FinancialTab = ({ reports, expensesByCategory, t }: Props): JSX.Element => {
  const pa = reports.profitAnalysis;
  const grossProfit = pa.revenueIQD - pa.costIQD;
  const grossMargin = pa.revenueIQD > 0 ? ((grossProfit / pa.revenueIQD) * 100).toFixed(1) : '0.0';
  const netMargin = pa.profitMarginPercent;

  const tf = (key: string, fallback: string) => {
    const res = t(key);
    return res === key ? fallback : res;
  };

  // Group smaller expenses into "Other" for the pie chart to prevent label overlap
  const sortedExpenses = [...expensesByCategory].sort((a, b) => b.totalIQD - a.totalIQD);
  const pieData = sortedExpenses.slice(0, 7);
  const otherExpenses = sortedExpenses.slice(7);
  if (otherExpenses.length > 0) {
    pieData.push({
      category: t('other') || 'Other',
      totalIQD: otherExpenses.reduce((s, e) => s + e.totalIQD, 0),
      count: otherExpenses.reduce((s, e) => s + e.count, 0)
    });
  }

  return (
    <>
      {/* P&L Statement */}
      <div className="Reports-pnl">
        <h3><Receipt size={18} /> {tf('profitAndLoss', 'الأرباح والخسائر')}</h3>

        <div className="Reports-pnlRow">
          <span>{tf('grossRevenue', 'إجمالي الإيرادات')}</span>
          <span>{fmt(pa.revenueIQD + reports.returnsSummary.totalIQD)} IQD</span>
        </div>
        <div className="Reports-pnlRow Reports-pnlRow--indent">
          <span>– {t('returns')}</span>
          <span className="Reports-pnlRed">({fmt(reports.returnsSummary.totalIQD)}) IQD</span>
        </div>
        <div className="Reports-pnlRow Reports-pnlRow--subtotal">
          <span>= {tf('netRevenue', 'صافي الإيرادات')}</span>
          <span>{fmt(pa.revenueIQD)} IQD</span>
        </div>
        <div className="Reports-pnlRow Reports-pnlRow--indent">
          <span>– {t('costOfGoods')}</span>
          <span>({fmt(pa.costIQD)}) IQD</span>
        </div>
        <div className="Reports-pnlRow Reports-pnlRow--subtotal">
          <span>= {tf('grossProfit', 'إجمالي الربح')}</span>
          <span className={grossProfit >= 0 ? 'Reports-pnlGreen' : 'Reports-pnlRed'}>
            {fmt(grossProfit)} IQD <small>({grossMargin}%)</small>
          </span>
        </div>
        <div className="Reports-pnlRow Reports-pnlRow--indent">
          <span>– {tf('operatingExpenses', 'المصاريف التشغيلية')}</span>
          <span>({fmt(pa.expensesIQD)}) IQD</span>
        </div>
        <div className="Reports-pnlRow Reports-pnlRow--total">
          <span>= {t('netProfit')}</span>
          <span className={pa.netProfitIQD >= 0 ? 'Reports-pnlGreen' : 'Reports-pnlRed'}>
            {fmt(pa.netProfitIQD)} IQD <small>({netMargin}%)</small>
          </span>
        </div>
      </div>

      {/* Expenses by Category + Expenses vs Sales chart */}
      <div className="Reports-chartRow">
        <div className="Reports-chartCard">
          <h3>{tf('expenseBreakdown', 'تفصيل المصاريف')}</h3>
          {expensesByCategory.length === 0 ? <div className="Reports-empty">{t('noData')}</div> : (
            <>
              <div className="Reports-chartWrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="totalIQD" nameKey="category" cx="50%" cy="50%" outerRadius={85}
                      label={({ category, percent }) => percent > 0.04 ? `${category} ${(percent * 100).toFixed(0)}%` : ''}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8 }}
                      formatter={(v: any) => [fmt(v || 0) + ' IQD']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Category table below chart */}
              <table style={{ marginTop: '0.5rem', fontSize: '0.78rem' }}>
                <thead><tr><th>{t('category')}</th><th>{t('amount') || 'Amount'}</th><th>#</th></tr></thead>
                <tbody>
                  {expensesByCategory.map((cat) => (
                    <tr key={cat.category}><td>{cat.category}</td><td>{fmt(cat.totalIQD)} IQD</td><td>{cat.count}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="Reports-chartCard">
          <h3>{t('expensesVsSales')}</h3>
          {reports.expensesVsSales.length === 0 ? <div className="Reports-empty">{t('noData')}</div> : (
            <div className="Reports-chartWrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reports.expensesVsSales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="salesIQD" name={tf('salesReport', 'المبيعات')} fill="#3b82f6" radius={[4,4,0,0]} />
                  <Bar dataKey="expensesIQD" name={tf('expensesReport', 'المصاريف')} fill="#f87171" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
