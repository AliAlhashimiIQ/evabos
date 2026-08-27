import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  Trash2,
  RotateCcw,
  ShoppingBag,
  TrendingUp,
  Receipt,
  Search,
  RefreshCw,
  Coins,
  CreditCard,
  Layers,
  Eye,
  DollarSign,
} from 'lucide-react';
import { confirmDialog } from '../utils/confirmDialog';
import { SkeletonTable } from '../components/Skeleton';
import PrintingModal from '../components/PrintingModal';
import './Pages.css';
import './SalesHistoryPage.css';

type SaleDetail = import('../types/electron').SaleDetail;
type DateRange = import('../types/electron').DateRange;

type PresetRange = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'allTime' | 'custom';

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

const SalesHistoryPage = (): JSX.Element => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { saleId } = useParams<{ saleId: string }>();

  const [sales, setSales] = useState<SaleDetail[]>([]);
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [activePreset, setActivePreset] = useState<PresetRange>('last7');
  const [searchTerm, setSearchTerm] = useState('');

  const [printSale, setPrintSale] = useState<SaleDetail | null>(null);
  const [printSummary, setPrintSummary] = useState<import('../components/PrintingModal').SalesSummaryData | null>(null);
  const [returnedItems, setReturnedItems] = useState<Map<number, Map<number, number>>>(new Map());

  useEffect(() => {
    if (saleId) {
      loadSaleDetail(parseInt(saleId));
    } else {
      loadSales();
    }
  }, [token, startDate, endDate, saleId]);

  const loadSales = async () => {
    if (!window.evaApi || !token) {
      setError(t('desktopBridgeUnavailable'));
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const range: DateRange = {
        startDate,
        endDate,
      };
      const [salesResponse, returnsResponse] = await Promise.all([
        window.evaApi.sales.listByDateRange(token, range),
        window.evaApi.returns.list(token),
      ]);
      setSales(salesResponse.sales || []);

      const returnedMap = new Map<number, Map<number, number>>();
      for (const ret of returnsResponse || []) {
        if (ret.saleId && ret.items) {
          if (!returnedMap.has(ret.saleId)) {
            returnedMap.set(ret.saleId, new Map());
          }
          const saleReturns = returnedMap.get(ret.saleId)!;
          for (const item of ret.items) {
            const current = saleReturns.get(item.variantId) || 0;
            saleReturns.set(item.variantId, current + item.quantity);
          }
        }
      }
      setReturnedItems(returnedMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToLoadData'));
    } finally {
      setLoading(false);
    }
  };

  const loadSaleDetail = async (id: number) => {
    if (!window.evaApi || !token) return;

    try {
      setLoading(true);
      setError(null);
      const detail = await window.evaApi.sales.getDetail(token, id);
      setSelectedSale(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToLoadData'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFilter = (range: PresetRange) => {
    setActivePreset(range);
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (range) {
      case 'today':
        break;
      case 'yesterday':
        start.setDate(now.getDate() - 1);
        end.setDate(now.getDate() - 1);
        break;
      case 'last7':
        start.setDate(now.getDate() - 6);
        break;
      case 'last30':
        start.setDate(now.getDate() - 29);
        break;
      case 'thisMonth':
        start.setDate(1);
        break;
      case 'lastMonth':
        start.setMonth(now.getMonth() - 1);
        start.setDate(1);
        end.setDate(0);
        break;
      case 'allTime':
        start = new Date(2020, 0, 1);
        break;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const handleDeleteSale = async (id: number) => {
    if (!window.evaApi || !token) return;
    const ok = await confirmDialog({
      message: t('confirmDeleteSale', { id: id }),
      variant: 'danger',
      confirmText: t('delete'),
    });
    if (!ok) return;
    try {
      await window.evaApi.sales.delete(token, id);
      if (selectedSale?.id === id) {
        navigate('/sales');
      } else {
        loadSales();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToLoadData'));
    }
  };

  const handlePrintSummary = async () => {
    if (sales.length === 0 || !window.evaApi || !token) return;

    try {
      const returnsResponse = await window.evaApi.returns.list(token);
      const returns = returnsResponse || [];

      const refundsBySaleId = new Map<number, number>();
      for (const ret of returns) {
        if (ret.saleId) {
          const current = refundsBySaleId.get(ret.saleId) || 0;
          refundsBySaleId.set(ret.saleId, current + (ret.refundAmountIQD || 0));
        }
      }

      const salesWithNetAmounts = sales.map((sale) => {
        const refundedAmount = refundsBySaleId.get(sale.id) || 0;
        const netTotal = sale.totalIQD - refundedAmount;
        return {
          ...sale,
          netTotal,
          refundedAmount,
        };
      });

      const activeSales = salesWithNetAmounts.filter((sale) => sale.netTotal > 0);
      const totalAmount = activeSales.reduce((sum, sale) => sum + sale.netTotal, 0);

      const summaryData: import('../components/PrintingModal').SalesSummaryData = {
        startDate,
        endDate,
        totalCount: activeSales.length,
        totalAmount,
        sales: activeSales.map((sale) => ({
          id: sale.id,
          date: sale.saleDate,
          total: sale.netTotal,
        })),
      };
      setPrintSummary(summaryData);
    } catch (err) {
      console.error('Error calculating print summary:', err);
    }
  };

  // Filtered sales
  const filteredSales = useMemo(() => {
    if (!searchTerm.trim()) return sales;
    const term = searchTerm.toLowerCase();
    return sales.filter((sale) => {
      const idMatch = String(sale.id).includes(term);
      const paymentMatch = (sale.paymentMethod || '').toLowerCase().includes(term);
      const employeeMatch = (sale.employeeName || '').toLowerCase().includes(term);
      const itemMatch = (sale.items || []).some(
        (i) => i.productName.toLowerCase().includes(term) || (i.color || '').toLowerCase().includes(term)
      );
      return idMatch || paymentMatch || employeeMatch || itemMatch;
    });
  }, [sales, searchTerm]);

  // Summary Metrics
  const stats = useMemo(() => {
    const totalRev = filteredSales.reduce((acc, s) => acc + (s.totalIQD || 0), 0);
    const totalProf = filteredSales.reduce((acc, s) => acc + (s.profitIQD || 0), 0);
    const count = filteredSales.length;
    const avgTicket = count > 0 ? Math.round(totalRev / count) : 0;

    return { totalRev, totalProf, count, avgTicket };
  }, [filteredSales]);

  // Payment Badge Helper
  const renderPaymentBadge = (method?: string | null) => {
    const m = (method || '').toLowerCase();
    if (m === 'cash') {
      return (
        <span className="SalesHistory-payBadge green">
          <Coins size={12} />
          <span>{t('cash')}</span>
        </span>
      );
    } else if (m === 'card') {
      return (
        <span className="SalesHistory-payBadge blue">
          <CreditCard size={12} />
          <span>{t('card')}</span>
        </span>
      );
    } else if (m === 'mixed') {
      return (
        <span className="SalesHistory-payBadge purple">
          <Layers size={12} />
          <span>{t('mixed')}</span>
        </span>
      );
    }
    return <span className="SalesHistory-payBadge gray">{method || '—'}</span>;
  };

  // Profit Formatter Helper (Green when positive, Red when negative)
  const renderProfit = (profit?: number | null) => {
    if (profit === undefined || profit === null) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
    const isNegative = profit < 0;
    const color = isNegative ? '#ef4444' : '#10b981';
    const absVal = Math.abs(profit).toLocaleString('en-IQ');
    return (
      <span
        style={{
          color,
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 600,
          direction: 'ltr',
          display: 'inline-block',
          unicodeBidi: 'plaintext',
        }}
      >
        {isNegative ? `-${absVal} IQD` : `+${absVal} IQD`}
      </span>
    );
  };

  // 1. DETAIL VIEW
  if (saleId && selectedSale) {
    return (
      <div className="Page SalesHistoryPage">
        <div className="SalesHistory-header">
          <div className="SalesHistory-headerTitle">
            <button className="SalesHistory-btn" onClick={() => navigate('/sales')}>
              <ArrowLeft size={16} />
              <span>{t('backToSalesList')}</span>
            </button>
            <h1>
              <Receipt size={22} style={{ color: 'var(--accent-primary, #6366f1)' }} />
              <span>{t('sale')} #{selectedSale.id}</span>
            </h1>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button className="SalesHistory-btn primary" onClick={() => setPrintSale(selectedSale)}>
              <Printer size={16} />
              <span>{t('printReceipt')}</span>
            </button>
            <button
              className="SalesHistory-btn danger"
              onClick={() => handleDeleteSale(selectedSale.id)}
            >
              <Trash2 size={16} />
              <span>{t('delete')}</span>
            </button>
          </div>
        </div>

        <div className="SalesHistory-detailCard">
          <div className="SalesHistory-detailGrid">
            <div className="SalesHistory-detailItem">
              <label>{t('saleId')}</label>
              <span>#{selectedSale.id}</span>
            </div>
            <div className="SalesHistory-detailItem">
              <label>{t('date')}</label>
              <span>{formatEnglishDateTime(selectedSale.saleDate)}</span>
            </div>
            {selectedSale.employeeName && (
              <div className="SalesHistory-detailItem">
                <label>{t('assistedBy')}</label>
                <span>{selectedSale.employeeName}</span>
              </div>
            )}
            <div className="SalesHistory-detailItem">
              <label>{t('paymentMethod')}</label>
              <div>{renderPaymentBadge(selectedSale.paymentMethod)}</div>
            </div>
            <div className="SalesHistory-detailItem">
              <label>{t('subtotal')}</label>
              <span>{selectedSale.subtotalIQD.toLocaleString('en-IQ')} IQD</span>
            </div>
            <div className="SalesHistory-detailItem">
              <label>{t('discount')}</label>
              <span style={{ color: '#ef4444' }}>{selectedSale.discountIQD.toLocaleString('en-IQ')} IQD</span>
            </div>
            <div className="SalesHistory-detailItem">
              <label>{t('total')}</label>
              <span style={{ color: 'var(--accent-primary)', fontSize: '1.25rem' }}>
                {selectedSale.totalIQD.toLocaleString('en-IQ')} IQD
              </span>
            </div>
            {selectedSale.profitIQD !== undefined && (
              <div className="SalesHistory-detailItem">
                <label>{t('expectedProfit')}</label>
                <div>{renderProfit(selectedSale.profitIQD)}</div>
              </div>
            )}
          </div>

          <div className="SalesHistory-tableCard">
            <table className="SalesHistory-table">
              <thead>
                <tr>
                  <th>{t('product')}</th>
                  <th>{t('variantColorSize')}</th>
                  <th>{t('qty')}</th>
                  <th>{t('unitPrice')}</th>
                  <th>{t('total')}</th>
                </tr>
              </thead>
              <tbody>
                {selectedSale.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{item.productName}</td>
                    <td>{[item.color, item.size].filter(Boolean).join(' / ') || '—'}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{item.quantity}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {item.unitPriceIQD.toLocaleString('en-IQ')} IQD
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                      {item.lineTotalIQD.toLocaleString('en-IQ')} IQD
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {printSale && (
          <PrintingModal
            visible={!!printSale}
            sale={printSale as any}
            onClose={() => setPrintSale(null)}
          />
        )}
      </div>
    );
  }

  // 2. SALES LIST VIEW
  return (
    <div className="Page SalesHistoryPage">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="SalesHistory-header">
        <div className="SalesHistory-headerTitle">
          <h1>
            <ShoppingBag size={24} style={{ color: 'var(--accent-primary, #6366f1)' }} />
            {t('sales')}
          </h1>
          <p>{t('salesHistorySubtitle')}</p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            className="SalesHistory-btn"
            onClick={loadSales}
            disabled={loading}
            title={t('refresh')}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>{t('refresh')}</span>
          </button>

          <button
            className="SalesHistory-btn"
            onClick={handlePrintSummary}
            disabled={sales.length === 0}
          >
            <Printer size={16} />
            <span>{t('printReport')}</span>
          </button>
        </div>
      </div>

      {/* ── KPI Stats Grid ────────────────────────────────── */}
      <div className="SalesHistory-kpis">
        <div className="SalesHistory-kpiCard">
          <div className="SalesHistory-kpiIcon blue">
            <DollarSign size={22} />
          </div>
          <div className="ActivityLogs-kpiData">
            <span className="SalesHistory-kpiLabel">{t('totalRevenue')}</span>
            <span className="SalesHistory-kpiValue">{stats.totalRev.toLocaleString('en-IQ')} IQD</span>
          </div>
        </div>

        <div className="SalesHistory-kpiCard">
          <div className={`SalesHistory-kpiIcon ${stats.totalProf < 0 ? 'red' : 'green'}`}>
            <TrendingUp size={22} />
          </div>
          <div className="ActivityLogs-kpiData">
            <span className="SalesHistory-kpiLabel">{t('totalProfit')}</span>
            <span
              className="SalesHistory-kpiValue"
              style={{
                color: stats.totalProf < 0 ? '#ef4444' : '#10b981',
                direction: 'ltr',
                display: 'inline-block',
              }}
            >
              {stats.totalProf < 0
                ? `-${Math.abs(stats.totalProf).toLocaleString('en-IQ')} IQD`
                : `${stats.totalProf.toLocaleString('en-IQ')} IQD`}
            </span>
          </div>
        </div>

        <div className="SalesHistory-kpiCard">
          <div className="SalesHistory-kpiIcon purple">
            <Receipt size={22} />
          </div>
          <div className="ActivityLogs-kpiData">
            <span className="SalesHistory-kpiLabel">{t('totalSalesCount')}</span>
            <span className="SalesHistory-kpiValue">{stats.count.toLocaleString('en-IQ')}</span>
          </div>
        </div>

        <div className="SalesHistory-kpiCard">
          <div className="SalesHistory-kpiIcon amber">
            <Coins size={22} />
          </div>
          <div className="ActivityLogs-kpiData">
            <span className="SalesHistory-kpiLabel">{t('avgTicketSale')}</span>
            <span className="SalesHistory-kpiValue">{stats.avgTicket.toLocaleString('en-IQ')} IQD</span>
          </div>
        </div>
      </div>

      {/* ── Toolbar & Date Filters ────────────────────────── */}
      <div className="SalesHistory-toolbar">
        {/* Presets */}
        <div className="SalesHistory-presetsBar">
          <button
            className={`SalesHistory-presetBtn ${activePreset === 'today' ? 'active' : ''}`}
            onClick={() => handleQuickFilter('today')}
          >
            {t('today')}
          </button>
          <button
            className={`SalesHistory-presetBtn ${activePreset === 'yesterday' ? 'active' : ''}`}
            onClick={() => handleQuickFilter('yesterday')}
          >
            {t('yesterday')}
          </button>
          <button
            className={`SalesHistory-presetBtn ${activePreset === 'last7' ? 'active' : ''}`}
            onClick={() => handleQuickFilter('last7')}
          >
            {t('last7days')}
          </button>
          <button
            className={`SalesHistory-presetBtn ${activePreset === 'last30' ? 'active' : ''}`}
            onClick={() => handleQuickFilter('last30')}
          >
            {t('last30days')}
          </button>
          <button
            className={`SalesHistory-presetBtn ${activePreset === 'thisMonth' ? 'active' : ''}`}
            onClick={() => handleQuickFilter('thisMonth')}
          >
            {t('thisMonth')}
          </button>
          <button
            className={`SalesHistory-presetBtn ${activePreset === 'lastMonth' ? 'active' : ''}`}
            onClick={() => handleQuickFilter('lastMonth')}
          >
            {t('lastMonth')}
          </button>
          <button
            className={`SalesHistory-presetBtn ${activePreset === 'allTime' ? 'active' : ''}`}
            onClick={() => handleQuickFilter('allTime')}
          >
            {t('allTime')}
          </button>
        </div>

        {/* Search & Custom Date Range */}
        <div className="SalesHistory-controlsBar">
          <div className="SalesHistory-searchBox">
            <Search size={16} className="SalesHistory-searchIcon" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('searchSalesPlaceholder')}
            />
          </div>

          <div className="SalesHistory-dateInputs">
            <div className="SalesHistory-dateGroup">
              <label>{t('startDate')}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setActivePreset('custom');
                  setStartDate(e.target.value);
                }}
              />
            </div>

            <div className="SalesHistory-dateGroup">
              <label>{t('endDate')}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setActivePreset('custom');
                  setEndDate(e.target.value);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {error && <div className="SettingsPage-message error">{error}</div>}

      {/* ── Table Card ────────────────────────────────────── */}
      <div className="SalesHistory-tableCard">
        {loading ? (
          <SkeletonTable rows={6} cols={7} />
        ) : filteredSales.length === 0 ? (
          <div className="ActivityLogs-empty">
            <ShoppingBag size={36} className="ActivityLogs-emptyIcon" />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('noSalesFound')}</p>
          </div>
        ) : (
          <div className="SalesHistory-tableScroll">
            <table className="SalesHistory-table">
              <thead>
                <tr>
                  <th>{t('saleId')}</th>
                  <th>{t('items')}</th>
                  <th>{t('timestamp')}</th>
                  <th>{t('total')}</th>
                  <th>{t('paymentMethod')}</th>
                  <th>{t('expectedProfit')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <span className="SalesHistory-saleIdPill">#{sale.id}</span>
                      {sale.isReturned && (
                        <span className="SalesHistory-returnedTag">
                          <RotateCcw size={10} />
                          {t('returned')}
                        </span>
                      )}
                    </td>

                    <td>
                      <div className="SalesHistory-itemsSummary">
                        {sale.items.map((item, idx) => {
                          const saleReturns = returnedItems.get(sale.id);
                          const returnedQty = saleReturns?.get(item.variantId) || 0;
                          return (
                            <div
                              key={idx}
                              className={`SalesHistory-itemRow ${returnedQty > 0 ? 'returned' : ''}`}
                            >
                              <span>
                                {item.productName}
                                {item.size || item.color ? ` (${[item.size, item.color].filter(Boolean).join('/')})` : ''}
                                {' '}×{item.quantity}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    <td>
                      <span className="SalesHistory-date">
                        {formatEnglishDateTime(sale.saleDate)}
                      </span>
                    </td>

                    <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                      {sale.totalIQD.toLocaleString('en-IQ')} IQD
                    </td>

                    <td>{renderPaymentBadge(sale.paymentMethod)}</td>

                    <td>{renderProfit(sale.profitIQD)}</td>

                    <td>
                      <div className="SalesHistory-rowActions">
                        <button
                          className="SalesHistory-actionIconBtn"
                          onClick={() => navigate(`/sales/${sale.id}`)}
                          title={t('viewDetails')}
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          className="SalesHistory-actionIconBtn"
                          onClick={() => setPrintSale(sale)}
                          title={t('printReceipt')}
                        >
                          <Printer size={15} />
                        </button>

                        <button
                          className="SalesHistory-actionIconBtn danger"
                          onClick={() => handleDeleteSale(sale.id)}
                          title={t('delete')}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {printSale && (
        <PrintingModal
          visible={!!printSale}
          sale={printSale as any}
          onClose={() => setPrintSale(null)}
        />
      )}

      {printSummary && (
        <PrintingModal
          visible={!!printSummary}
          salesSummary={printSummary}
          onClose={() => setPrintSummary(null)}
        />
      )}
    </div>
  );
};

export default SalesHistoryPage;
