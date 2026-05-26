import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CalendarRange, TrendingUp, ArrowUpRight, ArrowDownRight, Minus, ShoppingCart, Receipt, Wallet, BarChart3, Package } from 'lucide-react';

type AdvancedReports = import('../../types/electron').AdvancedReports;
type ExpenseByCategoryItem = import('../../types/electron').ExpenseByCategoryItem;

interface Props {
  reports: AdvancedReports;
  expensesByCategory: ExpenseByCategoryItem[];
  t: (key: string) => string;
}

interface MonthData {
  month: string;
  label: string;
  shortLabel: string;
  orders: number;
  itemsSold: number;
  revenueIQD: number;
  avgTicketIQD: number;
  costIQD: number;       // COGS (cost of goods sold)
  expensesIQD: number;   // Operating expenses from expenses table
  grossProfitIQD: number; // revenue - COGS
  netIQD: number;        // revenue - COGS - operatingExpenses  ← correct صافي
}

const fmt = (n: number) => n.toLocaleString('en-IQ');
const fmtK = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : fmt(n);

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

export const MonthlyTab = ({ reports, expensesByCategory, t }: Props): JSX.Element => {
  const monthMap = new Map<string, MonthData>();

  for (const day of reports.dailySales) {
    const [year, month] = day.date.split('-');
    const key = `${year}-${month}`;
    const monthIdx = parseInt(month, 10) - 1;

    if (!monthMap.has(key)) {
      monthMap.set(key, {
        month: key,
        label: `${MONTH_NAMES_AR[monthIdx]} ${year}`,
        shortLabel: MONTH_NAMES_AR[monthIdx],
        orders: 0,
        itemsSold: 0,
        revenueIQD: 0,
        avgTicketIQD: 0,
        costIQD: 0,
        expensesIQD: 0,
        grossProfitIQD: 0,
        netIQD: 0,
      });
    }

    const m = monthMap.get(key)!;
    m.orders += day.orders;
    m.revenueIQD += day.totalIQD;
    m.itemsSold += day.itemsSold || 0;
    m.costIQD += day.costIQD || 0;
  }

  // Add operating expenses (from expenses table) per month
  for (const day of reports.expensesVsSales) {
    const [year, month] = day.date.split('-');
    const key = `${year}-${month}`;
    if (monthMap.has(key)) {
      monthMap.get(key)!.expensesIQD += day.expensesIQD;
    }
  }

  // Compute derived values with correct formula
  for (const m of monthMap.values()) {
    m.avgTicketIQD = m.orders > 0 ? Math.round(m.revenueIQD / m.orders) : 0;
    m.grossProfitIQD = m.revenueIQD - m.costIQD;
    m.netIQD = m.revenueIQD - m.costIQD - m.expensesIQD; // ✅ correct: revenue - COGS - opex
  }

  const months = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

  const totals = months.reduce((acc, m) => ({
    orders: acc.orders + m.orders,
    itemsSold: acc.itemsSold + m.itemsSold,
    revenueIQD: acc.revenueIQD + m.revenueIQD,
    costIQD: acc.costIQD + m.costIQD,
    expensesIQD: acc.expensesIQD + m.expensesIQD,
    grossProfitIQD: acc.grossProfitIQD + m.grossProfitIQD,
    netIQD: acc.netIQD + m.netIQD,
  }), { orders: 0, itemsSold: 0, revenueIQD: 0, costIQD: 0, expensesIQD: 0, grossProfitIQD: 0, netIQD: 0 });

  const getChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  // Find best/worst months
  const bestMonth = months.length > 0 ? months.reduce((a, b) => a.revenueIQD > b.revenueIQD ? a : b) : null;
  const worstMonth = months.length > 0 ? months.reduce((a, b) => a.revenueIQD < b.revenueIQD ? a : b) : null;

  if (months.length === 0) {
    return (
      <div className="Reports-empty">
        <CalendarRange size={48} />
        <p>{t('noData') || 'لا توجد بيانات'}</p>
        <span>اختر فترة أطول لعرض التحليل الشهري</span>
      </div>
    );
  }

  return (
    <>
      {/* Summary KPIs */}
      <section className="Reports-stats">
        <div>
          <span><CalendarRange size={14} /> عدد الأشهر</span>
          <strong>{months.length}</strong>
        </div>
        <div>
          <span><ShoppingCart size={14} /> إجمالي الطلبات</span>
          <strong>{fmt(totals.orders)}</strong>
        </div>
        <div>
          <span><Package size={14} /> إجمالي القطع</span>
          <strong>{fmt(totals.itemsSold)}</strong>
        </div>
        <div>
          <span>إجمالي الإيرادات</span>
          <strong>{fmt(totals.revenueIQD)}</strong>
        </div>
        <div>
          <span>إجمالي المصاريف</span>
          <strong>{fmt(totals.expensesIQD)}</strong>
        </div>
        <div className={totals.netIQD >= 0 ? 'Reports-stat--positive' : 'Reports-stat--negative'}>
          <span>صافي الإيرادات</span>
          <strong>{fmt(totals.netIQD)}</strong>
        </div>
        <div>
          <span>متوسط شهري</span>
          <strong>{fmtK(Math.round(totals.revenueIQD / months.length))}</strong>
        </div>
      </section>

      {/* Revenue vs Expenses Bar Chart */}
      <div className="Reports-chartRow">
        <div className="Reports-chartCard Reports-chartCard--full">
          <h3><TrendingUp size={18} /> الإيرادات والمصاريف الشهرية</h3>
          <div className="Reports-chartWrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="shortLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip
                  contentStyle={{ borderRadius: 10 }}
                  formatter={(value: any) => [fmt(value || 0) + ' IQD']}
                />
                <Legend />
                <Bar dataKey="revenueIQD" name="الإيرادات" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expensesIQD" name="المصاريف" fill="#f87171" radius={[4, 4, 0, 0]} />
                <Bar dataKey="netIQD" name="الصافي" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Month Cards Grid */}
      <div className="Monthly-cards">
        {months.map((m, idx) => {
          const prevRevenue = idx > 0 ? months[idx - 1].revenueIQD : 0;
          const change = idx > 0 ? getChange(m.revenueIQD, prevRevenue) : null;
          const isBest = bestMonth && m.month === bestMonth.month && months.length > 1;
          const isWorst = worstMonth && m.month === worstMonth.month && months.length > 1;
          const maxRevenue = bestMonth?.revenueIQD || 1;
          const barWidth = Math.max((m.revenueIQD / maxRevenue) * 100, 4);

          return (
            <div
              key={m.month}
              className={`Monthly-card ${isBest ? 'Monthly-card--best' : ''} ${isWorst ? 'Monthly-card--worst' : ''}`}
            >
              {/* Header */}
              <div className="Monthly-card-header">
                <div className="Monthly-card-title">
                  <span className="Monthly-card-month">{m.label}</span>
                  {isBest && <span className="Monthly-badge Monthly-badge--best">الأفضل</span>}
                  {isWorst && <span className="Monthly-badge Monthly-badge--worst">الأقل</span>}
                </div>
                {change !== null && (
                  <div
                    className={`Monthly-change ${change > 0 ? 'Monthly-change--up' : change < 0 ? 'Monthly-change--down' : ''}`}
                    title="نسبة تغيّر الإيرادات مقارنةً بالشهر السابق"
                  >
                    {change > 0 ? <ArrowUpRight size={13} /> : change < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                    {change > 0 ? '+' : ''}{change}%
                  </div>
                )}
              </div>

              {/* Revenue bar */}
              <div className="Monthly-bar-track">
                <div className="Monthly-bar-fill" style={{ width: `${barWidth}%` }} />
              </div>

              {/* Stats — clean 2-col rows */}
              <div className="Monthly-rows">
                <div className="Monthly-row">
                  <span>الإيرادات</span>
                  <strong>{fmt(Math.round(m.revenueIQD))}</strong>
                </div>
                <div className="Monthly-row">
                  <span>تكلفة البضاعة</span>
                  <strong>{fmt(Math.round(m.costIQD))}</strong>
                </div>
                <div className="Monthly-row Monthly-row--profit">
                  <span>إجمالي الربح</span>
                  <strong className={m.grossProfitIQD >= 0 ? 'pos' : 'neg'}>{fmt(Math.round(m.grossProfitIQD))}</strong>
                </div>
                <div className="Monthly-row Monthly-row--divider">
                  <span>الطلبات</span>
                  <strong>{fmt(m.orders)}</strong>
                  <span>القطع</span>
                  <strong>{fmt(m.itemsSold)}</strong>
                </div>
                <div className="Monthly-row">
                  <span>المصاريف التشغيلية</span>
                  <strong>{fmt(Math.round(m.expensesIQD))}</strong>
                </div>
              </div>

              {/* Net footer */}
              <div className={`Monthly-net ${m.netIQD >= 0 ? 'Monthly-net--pos' : 'Monthly-net--neg'}`}>
                <span>صافي الربح</span>
                <strong>{fmt(Math.round(m.netIQD))} IQD</strong>
              </div>
            </div>
          );
        })}
      </div>


      {/* Totals Summary Card */}
      <div className="Monthly-totals">
        <div className="Monthly-totals-title">
          <CalendarRange size={18} />
          الإجمالي الكلي
        </div>
        <div className="Monthly-totals-grid">
          <div>
            <span>الطلبات</span>
            <strong>{fmt(totals.orders)}</strong>
          </div>
          <div>
            <span>القطع</span>
            <strong>{fmt(totals.itemsSold)}</strong>
          </div>
          <div>
            <span>الإيرادات</span>
            <strong>{fmt(totals.revenueIQD)} IQD</strong>
          </div>
          <div>
            <span>تكلفة البضاعة</span>
            <strong>{fmt(totals.costIQD)} IQD</strong>
          </div>
          <div className={totals.grossProfitIQD >= 0 ? 'Monthly-totals--pos' : 'Monthly-totals--neg'}>
            <span>إجمالي الربح</span>
            <strong>{fmt(totals.grossProfitIQD)} IQD</strong>
          </div>
          <div>
            <span>المصاريف التشغيلية</span>
            <strong>{fmt(totals.expensesIQD)} IQD</strong>
          </div>
          <div className={totals.netIQD >= 0 ? 'Monthly-totals--pos' : 'Monthly-totals--neg'}>
            <span>صافي الربح</span>
            <strong>{fmt(totals.netIQD)} IQD</strong>
          </div>
          <div>
            <span>متوسط طلب</span>
            <strong>{fmt(totals.orders > 0 ? Math.round(totals.revenueIQD / totals.orders) : 0)} IQD</strong>
          </div>
        </div>
      </div>
    </>
  );
};
