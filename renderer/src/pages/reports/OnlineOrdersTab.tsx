import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  ShoppingBag, CheckCircle2, Clock, XCircle, DollarSign, Package,
  Users, Instagram, MessageCircle, Phone, Globe, Percent,
  TrendingUp, Award, AlertTriangle, Layers, ArrowUpRight, BarChart3
} from 'lucide-react';

type OnlineOrdersAnalytics = import('../../types/electron').OnlineOrdersAnalytics;

interface Props {
  data: OnlineOrdersAnalytics | null;
  range: { startDate: string; endDate: string };
  t: (key: string, params?: Record<string, string | number>) => string;
}

const fmt = (n: number) => (n || 0).toLocaleString('en-IQ');

const SOURCE_COLORS: Record<string, string> = {
  instagram: '#E1306C',
  whatsapp: '#22c55e',
  tiktok: '#06b6d4',
  phone: '#3b82f6',
  other: '#8b5cf6',
};

const SOURCE_ICONS: Record<string, JSX.Element> = {
  instagram: <Instagram size={15} style={{ color: '#E1306C' }} />,
  whatsapp: <MessageCircle size={15} style={{ color: '#22c55e' }} />,
  tiktok: <Globe size={15} style={{ color: '#06b6d4' }} />,
  phone: <Phone size={15} style={{ color: '#3b82f6' }} />,
  other: <Layers size={15} style={{ color: '#8b5cf6' }} />,
};

const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  tiktok: 'TikTok',
  phone: 'الهاتف / Phone',
  other: 'أخرى / Other',
};

export const OnlineOrdersTab: React.FC<Props> = ({ data, range, t }) => {
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>('all');

  const summary = data?.summary;

  // Filter daily trend if source filter is applied
  const filteredDailyTrend = useMemo(() => {
    if (!data?.dailyTrend) return [];
    return data.dailyTrend;
  }, [data?.dailyTrend]);

  // Donut chart data for sources
  const pieSourceData = useMemo(() => {
    if (!data?.bySource || data.bySource.length === 0) return [];
    return data.bySource
      .filter((s) => s.revenueIQD > 0 || s.totalOrders > 0)
      .map((s) => ({
        name: SOURCE_LABELS[s.source] || s.source,
        source: s.source,
        value: s.revenueIQD,
        orders: s.totalOrders,
        color: SOURCE_COLORS[s.source] || '#64748b',
      }));
  }, [data?.bySource]);

  // Status donut data
  const pieStatusData = useMemo(() => {
    if (!summary || summary.totalOrders === 0) return [];
    return [
      { name: t('confirmed') || 'مؤكد', value: summary.confirmedOrders, color: '#10b981' },
      { name: t('pending') || 'قيد الانتظار', value: summary.pendingOrders, color: '#f59e0b' },
      { name: t('rejected') || 'مرفوض', value: summary.rejectedOrders, color: '#ef4444' },
    ].filter((item) => item.value > 0);
  }, [summary, t]);

  // Hourly trend data filtered for visible hours
  const filteredHourly = useMemo(() => {
    if (!data?.hourlyTrend) return [];
    return data.hourlyTrend.map((h) => ({
      ...h,
      label: `${h.hour}:00`,
    }));
  }, [data?.hourlyTrend]);

  if (!data || !summary || summary.totalOrders === 0) {
    return (
      <div className="Reports-empty" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <ShoppingBag size={48} style={{ opacity: 0.3, margin: '0 auto 1rem', display: 'block' }} />
        <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
          {t('noOnlineOrdersInRange') || 'لا توجد طلبات أونلاين خلال هذه الفترة'}
        </h3>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {t('onlineOrdersHelpHint') || 'تأكد من تحديد تاريخ يتضمن طلبات أونلاين مسجلة (من Instagram، WhatsApp، الهاتف أو غيرها).'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ─── 1. Primary KPI Cards Strip ─── */}
      <section className="Reports-stats">
        {/* Realized Revenue */}
        <div style={{ borderInlineStart: '4px solid #10b981' }}>
          <span>
            <DollarSign size={14} style={{ color: '#10b981' }} /> {t('confirmedOnlineSales') || 'مبيعات الأونلاين المؤكدة'}
          </span>
          <strong style={{ color: '#10b981' }}>{fmt(summary.totalRevenueIQD)} <small style={{ fontSize: '0.65em' }}>IQD</small></strong>
          <small style={{ color: 'var(--text-secondary)' }}>
            {summary.confirmedOrders} {t('confirmedOrders') || 'طلب مؤكد'} ({summary.confirmationRate}%)
          </small>
        </div>

        {/* Pending Pipeline */}
        <div style={{ borderInlineStart: '4px solid #f59e0b' }}>
          <span>
            <Clock size={14} style={{ color: '#f59e0b' }} /> {t('pendingPipeline') || 'طلبات قيد المعالجة'}
          </span>
          <strong style={{ color: '#f59e0b' }}>{fmt(summary.pendingRevenueIQD)} <small style={{ fontSize: '0.65em' }}>IQD</small></strong>
          <small style={{ color: 'var(--text-secondary)' }}>
            {summary.pendingOrders} {t('pendingOrders') || 'طلب بانتظار التأكيد'}
          </small>
        </div>

        {/* Lost / Rejected Sales */}
        <div style={{ borderInlineStart: '4px solid #ef4444' }}>
          <span>
            <XCircle size={14} style={{ color: '#ef4444' }} /> {t('rejectedSalesLost') || 'مبيعات مرفوضة / ضائعة'}
          </span>
          <strong style={{ color: '#ef4444' }}>{fmt(summary.rejectedLostRevenueIQD)} <small style={{ fontSize: '0.65em' }}>IQD</small></strong>
          <small style={{ color: 'var(--text-secondary)' }}>
            {summary.rejectedOrders} {t('rejectedOrders') || 'طلب مرفوض'} ({summary.rejectionRate}%)
          </small>
        </div>

        {/* Average Order Value (AOV) */}
        <div>
          <span>
            <TrendingUp size={14} style={{ color: '#6366f1' }} /> {t('averageOrderValue') || 'متوسط قيمة الطلب'}
          </span>
          <strong>{fmt(summary.avgOrderValueIQD)} <small style={{ fontSize: '0.65em' }}>IQD</small></strong>
          <small style={{ color: 'var(--text-secondary)' }}>
            {t('perConfirmedOrder') || 'لكل طلب أونلاين مؤكد'}
          </small>
        </div>

        {/* Total Items Sold Online */}
        <div>
          <span>
            <Package size={14} style={{ color: '#06b6d4' }} /> {t('itemsSoldOnline') || 'القطع المباعة أونلاين'}
          </span>
          <strong>{fmt(summary.totalItemsSold)} <small style={{ fontSize: '0.65em' }}>{t('item') || 'قطعة'}</small></strong>
          <small style={{ color: 'var(--text-secondary)' }}>
            {summary.confirmedOrders > 0 ? (summary.totalItemsSold / summary.confirmedOrders).toFixed(1) : '0'} {t('itemsPerOrder') || 'قطعة / طلب'}
          </small>
        </div>

        {/* Unique Online Buyers */}
        <div>
          <span>
            <Users size={14} style={{ color: '#8b5cf6' }} /> {t('onlineBuyers') || 'الزبائن الأونلاين'}
          </span>
          <strong>{fmt(summary.uniqueCustomersCount)}</strong>
          <small style={{ color: 'var(--text-secondary)' }}>
            {t('discountGiven') || 'الخصم الممنوح'}: {fmt(summary.totalDiscountIQD)} IQD
          </small>
        </div>
      </section>

      {/* ─── 2. Visual Charts Row 1: Sales Timeline + Channel Distribution ─── */}
      <div className="Reports-chartRow">
        {/* Daily Online Revenue Trend */}
        <div className="Reports-chartCard Reports-chartCard--full">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={18} style={{ color: '#10b981' }} /> {t('dailyOnlineSalesTrend') || 'مسار المبيعات الأونلاين اليومي'}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '0.2rem 0.6rem', borderRadius: '0.4rem' }}>
              {range.startDate} ➔ {range.endDate}
            </span>
          </div>

          <div className="Reports-chartWrap" style={{ height: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredDailyTrend}>
                <defs>
                  <linearGradient id="onlineRevGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="onlineOrdersGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                  itemStyle={{ color: '#cbd5e1' }}
                  formatter={(value: any, name: any) => [
                    name === (t('sales') || 'المبيعات') ? `${fmt(value || 0)} IQD` : value,
                    name,
                  ]}
                />
                <Legend wrapperStyle={{ paddingTop: 8 }} />
                <Area yAxisId="left" type="monotone" dataKey="revenueIQD" name={t('sales') || 'المبيعات'} stroke="#10b981" fillOpacity={1} fill="url(#onlineRevGradient)" strokeWidth={2.5} />
                <Line yAxisId="right" type="monotone" dataKey="confirmedOrders" name={t('confirmedOrders') || 'الطلبات المؤكدة'} stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ─── 3. Visual Charts Row 2: Channel Performance + Status Breakdown ─── */}
      <div className="Reports-chartRow">
        {/* Sales by Channel Donut */}
        <div className="Reports-chartCard">
          <h3>
            <Globe size={18} style={{ color: '#6366f1' }} /> {t('salesByChannel') || 'المبيعات حسب المنصة / القناة'}
          </h3>
          <div className="Reports-chartWrap" style={{ height: 240 }}>
            {pieSourceData.length === 0 ? (
              <div className="Reports-empty">{t('noData')}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieSourceData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                    label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                  >
                    {pieSourceData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#f1f5f9' }}
                    itemStyle={{ color: '#cbd5e1' }}
                    formatter={(v: any) => [`${fmt(v || 0)} IQD`, t('sales') || 'المبيعات']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Order Fulfillment & Status Breakdown */}
        <div className="Reports-chartCard">
          <h3>
            <CheckCircle2 size={18} style={{ color: '#10b981' }} /> {t('ordersFulfillmentRate') || 'حالة تنفيذ الطلبات'}
          </h3>
          <div className="Reports-chartWrap" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieStatusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={4}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieStatusData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#f1f5f9' }}
                  itemStyle={{ color: '#cbd5e1' }}
                  formatter={(v: any) => [`${v} ${t('orders') || 'طلب'}`, t('count') || 'العدد']}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ─── 4. Channel Performance Matrix Table ─── */}
      <section className="Reports-grid">
        <article className="Reports-fullWidth">
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Layers size={18} style={{ color: '#6366f1' }} /> {t('channelPerformanceMatrix') || 'مصفوفة أداء منصات البيع'}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {data.bySource.length} {t('channels') || 'منصات'}
            </span>
          </header>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>{t('channel') || 'المنصة'}</th>
                  <th style={{ textAlign: 'center', width: '12%' }}>{t('totalOrders') || 'إجمالي الطلبات'}</th>
                  <th style={{ textAlign: 'center', width: '12%' }}>{t('confirmed') || 'مؤكد'}</th>
                  <th style={{ textAlign: 'center', width: '12%' }}>{t('rejected') || 'مرفوض'}</th>
                  <th style={{ textAlign: 'center', width: '14%' }}>{t('successRate') || 'نسبة النجاح'}</th>
                  <th style={{ textAlign: 'start', width: '16%' }}>{t('realizedSales') || 'المبيعات المحققة'}</th>
                  <th style={{ textAlign: 'start', width: '12%' }}>{t('avgTicket') || 'المعدل'}</th>
                </tr>
              </thead>
              <tbody>
                {data.bySource.map((s) => {
                  const icon = SOURCE_ICONS[s.source] || <Globe size={15} />;
                  const label = SOURCE_LABELS[s.source] || s.source;
                  const color = SOURCE_COLORS[s.source] || '#64748b';

                  return (
                    <tr key={s.source}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: `${color}18` }}>
                            {icon}
                          </span>
                          <strong style={{ color: 'var(--text-primary)' }}>{label}</strong>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{s.totalOrders}</td>
                      <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{s.confirmedOrders}</td>
                      <td style={{ textAlign: 'center', color: '#ef4444', fontWeight: 600 }}>{s.rejectedOrders}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <div style={{ width: 44, height: 6, borderRadius: 3, background: 'var(--border-color)', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(s.confirmationRate, 100)}%`, height: '100%', background: s.confirmationRate >= 70 ? '#10b981' : s.confirmationRate >= 40 ? '#f59e0b' : '#ef4444' }} />
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{s.confirmationRate}%</span>
                        </div>
                      </td>
                      <td dir="ltr" style={{ textAlign: 'start', fontWeight: 700, color: '#10b981' }}>
                        {fmt(s.revenueIQD)} IQD
                        {s.percentageOfRevenue > 0 && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginInlineStart: '0.4rem' }}>
                            ({s.percentageOfRevenue}%)
                          </span>
                        )}
                      </td>
                      <td dir="ltr" style={{ textAlign: 'start', color: 'var(--text-secondary)' }}>
                        {fmt(s.avgTicketIQD)} IQD
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      {/* ─── 5. Top Products Sold Online + Top Online Customers ─── */}
      <div className="Reports-chartRow">
        {/* Top Products Table */}
        <div className="Reports-chartCard" style={{ flex: 1.2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={18} style={{ color: '#f59e0b' }} /> {t('topSellingOnlineProducts') || 'المنتجات الأكثر مبيعاً أونلاين'}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {data.topProducts.length} {t('products') || 'منتج'}
            </span>
          </div>

          {data.topProducts.length === 0 ? (
            <div className="Reports-empty">{t('noData')}</div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '8%' }}>#</th>
                    <th style={{ width: '42%' }}>{t('product') || 'المنتج'}</th>
                    <th style={{ textAlign: 'center', width: '18%' }}>{t('qtySold') || 'الكمية المباعة'}</th>
                    <th style={{ textAlign: 'start', width: '32%' }}>{t('revenue') || 'الإيراد'}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((p, idx) => (
                    <tr key={p.variantId}>
                      <td style={{ fontWeight: 700, color: idx < 3 ? '#f59e0b' : 'var(--text-secondary)' }}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                      </td>
                      <td>
                        <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{p.productName}</strong>
                        {(p.color || p.size || p.sku) && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {[p.sku, p.color, p.size].filter(Boolean).join(' • ')}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{p.quantitySold}</td>
                      <td dir="ltr" style={{ textAlign: 'start', fontWeight: 600, color: '#10b981' }}>
                        {fmt(p.totalRevenueIQD)} IQD
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Online Customers Table */}
        <div className="Reports-chartCard" style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} style={{ color: '#8b5cf6' }} /> {t('topOnlineCustomers') || 'أفضل زبائن الأونلاين'}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {data.topCustomers.length} {t('customers') || 'عميل'}
            </span>
          </div>

          {data.topCustomers.length === 0 ? (
            <div className="Reports-empty">{t('noData')}</div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '45%' }}>{t('customer') || 'الزبون'}</th>
                    <th style={{ textAlign: 'center', width: '20%' }}>{t('orders') || 'الطلبات'}</th>
                    <th style={{ textAlign: 'start', width: '35%' }}>{t('totalSpent') || 'المجموع'}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topCustomers.map((c, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{c.customerName}</strong>
                        <span dir="ltr" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textAlign: 'start' }}>
                          {c.customerPhone}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>
                        <span style={{ background: 'var(--bg-secondary)', padding: '0.2rem 0.5rem', borderRadius: '0.4rem' }}>
                          {c.ordersCount}
                        </span>
                      </td>
                      <td dir="ltr" style={{ textAlign: 'start', fontWeight: 600, color: '#10b981' }}>
                        {fmt(c.totalSpentIQD)} IQD
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ─── 6. Peak Ordering Hours + Rejection Reasons Analysis ─── */}
      <div className="Reports-chartRow">
        {/* Hourly Trend (When do customers order?) */}
        <div className="Reports-chartCard" style={{ flex: 1.1 }}>
          <h3>
            <Clock size={18} style={{ color: '#06b6d4' }} /> {t('peakOrderingHours') || 'أوقات ذروة طلبات الأونلاين (24 ساعة)'}
          </h3>
          <div className="Reports-chartWrap" style={{ height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredHourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#f1f5f9' }}
                  itemStyle={{ color: '#cbd5e1' }}
                  formatter={(v: any, name: any) => [
                    name === (t('revenue') || 'الإيراد') ? `${fmt(v || 0)} IQD` : `${v} ${t('orders') || 'طلب'}`,
                    name,
                  ]}
                />
                <Bar dataKey="orders" name={t('orders') || 'الطلبات'} fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rejection Reasons Breakdown */}
        <div className="Reports-chartCard" style={{ flex: 0.9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
              <AlertTriangle size={18} /> {t('rejectionReasonsAnalysis') || 'أسباب رفض الطلبات والخسائر'}
            </h3>
          </div>

          {data.rejectionReasons.length === 0 ? (
            <div className="Reports-empty" style={{ padding: '2rem 1rem' }}>
              <CheckCircle2 size={32} style={{ color: '#10b981', margin: '0 auto 0.5rem', display: 'block' }} />
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                {t('noRejectedOrders') || 'لا توجد طلبات مرفوضة في هذه الفترة (نسبة إنجاز 100%)'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 230, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('reason') || 'سبب الرفض'}</th>
                    <th style={{ textAlign: 'center', width: '22%' }}>{t('count') || 'العدد'}</th>
                    <th style={{ textAlign: 'start', width: '35%' }}>{t('lostValue') || 'القيمة الضائعة'}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rejectionReasons.map((r, idx) => (
                    <tr key={idx}>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.reason}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#ef4444' }}>{r.count}</td>
                      <td dir="ltr" style={{ textAlign: 'start', color: '#ef4444', fontWeight: 600 }}>
                        {fmt(r.lostValueIQD)} IQD
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
