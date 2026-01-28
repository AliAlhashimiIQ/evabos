import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Trash2, RotateCcw } from 'lucide-react';
import PrintingModal from '../components/PrintingModal';
import './Pages.css';
import './SalesHistoryPage.css';

type SaleDetail = import('../types/electron').SaleDetail;
type DateRange = import('../types/electron').DateRange;

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
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [printSale, setPrintSale] = useState<SaleDetail | null>(null);
  const [printSummary, setPrintSummary] = useState<import('../components/PrintingModal').SalesSummaryData | null>(null);
  // Map of saleId -> Map of variantId -> quantity returned
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
      const range: DateRange = {
        startDate,
        endDate,
      };
      const [salesResponse, returnsResponse] = await Promise.all([
        window.evaApi.sales.listByDateRange(token, range),
        window.evaApi.returns.list(token)
      ]);
      setSales(salesResponse.sales);

      // Build map of returned items: saleId -> Map of variantId -> quantity returned
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
      const detail = await window.evaApi.sales.getDetail(token, id);
      setSelectedSale(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToLoadData'));
    } finally {
      setLoading(false);
    }
  };

  const handleViewSale = (id: number) => {
    navigate(`/sales/${id}`);
  };

  const handlePrintSale = (sale: SaleDetail) => {
    setPrintSale(sale);
  };

  const handlePrintSummary = async () => {
    if (sales.length === 0 || !window.evaApi || !token) return;

    try {
      // Fetch returns to get refund amounts per sale
      const returnsResponse = await window.evaApi.returns.list(token);
      const returns = returnsResponse || [];

      // Build a map of saleId -> total refunded amount
      const refundsBySaleId = new Map<number, number>();
      for (const ret of returns) {
        if (ret.saleId) {
          const current = refundsBySaleId.get(ret.saleId) || 0;
          refundsBySaleId.set(ret.saleId, current + (ret.refundAmountIQD || 0));
        }
      }

      // Calculate net amounts for each sale (original total minus refunds)
      const salesWithNetAmounts = sales.map(sale => {
        const refundedAmount = refundsBySaleId.get(sale.id) || 0;
        const netTotal = sale.totalIQD - refundedAmount;
        return {
          ...sale,
          netTotal,
          refundedAmount
        };
      });

      // Only include sales that have a positive net amount
      const activeSales = salesWithNetAmounts.filter(sale => sale.netTotal > 0);
      const totalAmount = activeSales.reduce((sum, sale) => sum + sale.netTotal, 0);

      const summaryData: import('../components/PrintingModal').SalesSummaryData = {
        startDate,
        endDate,
        totalCount: activeSales.length,
        totalAmount,
        sales: activeSales.map(sale => ({
          id: sale.id,
          date: sale.saleDate,
          total: sale.netTotal
        }))
      };
      setPrintSummary(summaryData);
    } catch (err) {
      console.error('Error calculating print summary:', err);
    }
  };

  const handleQuickFilter = (range: 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth') => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (range) {
      case 'today':
        break; // start and end are already now
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
        end.setDate(0); // Last day of previous month
        break;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const handleDeleteSale = async (id: number) => {
    if (!window.evaApi || !token) return;
    if (!window.confirm(t('confirmDeleteSale', { id: id }))) {
      return;
    }
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

  if (saleId && selectedSale) {
    // Show sale detail view
    return (
      <div className="Page SalesHistory">
        <div className="Page-header">
          <button className="SalesHistory-back" onClick={() => navigate('/sales')}>
            <ArrowLeft size={16} /> {t('backToSalesList')}
          </button>
          <h1>{t('sale')} #{selectedSale.id}</h1>
          <button
            className="SalesHistory-print"
            onClick={() => handlePrintSale(selectedSale)}
          >
            <Printer size={18} /> {t('printReceipt')}
          </button>
          <button
            className="SalesHistory-delete"
            onClick={() => handleDeleteSale(selectedSale.id)}
            style={{ marginLeft: '10px', backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
          >
            <Trash2 size={18} /> {t('delete')}
          </button>
        </div>

        <div className="Page-content">
          <div className="SalesHistory-detail">
            <div className="SalesHistory-detailSection">
              <h3>{t('saleInformation')}</h3>
              <div className="SalesHistory-detailGrid">
                <div>
                  <label>{t('saleId')}:</label>
                  <span>#{selectedSale.id}</span>
                </div>
                <div>
                  <label>{t('date')}:</label>
                  <span>{new Date(selectedSale.saleDate).toLocaleString()}</span>
                </div>
                <div>
                  <label>{t('paymentMethod')}:</label>
                  <span>{selectedSale.paymentMethod || 'N/A'}</span>
                </div>
                <div>
                  <label>{t('subtotal')}:</label>
                  <span>{selectedSale.subtotalIQD.toLocaleString('en-IQ')} IQD</span>
                </div>
                <div>
                  <label>{t('discount')}:</label>
                  <span>{selectedSale.discountIQD.toLocaleString('en-IQ')} IQD</span>
                </div>
                <div>
                  <label>{t('total')}:</label>
                  <span className="SalesHistory-total">
                    {selectedSale.totalIQD.toLocaleString('en-IQ')} IQD
                  </span>
                </div>
                {selectedSale.profitIQD && (
                  <div>
                    <label>{t('profitAmount')}:</label>
                    <span className="SalesHistory-profit">
                      {selectedSale.profitIQD.toLocaleString('en-IQ')} IQD
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="SalesHistory-detailSection">
              <h3>{t('items')}</h3>
              <div className="SalesHistory-itemsTable">
                <table>
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
                        <td>{item.productName}</td>
                        <td>
                          {[item.color, item.size].filter(Boolean).join(' / ') || 'N/A'}
                        </td>
                        <td>{item.quantity}</td>
                        <td>{item.unitPriceIQD.toLocaleString('en-IQ')} IQD</td>
                        <td>{item.lineTotalIQD.toLocaleString('en-IQ')} IQD</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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

  // Show sales list view
  return (
    <div className="Page SalesHistory">
      <div className="Page-header">
        <h1>{t('sales')}</h1>
      </div>

      <div className="Page-content">
        <div className="SalesHistory-filters">
          <div className="SalesHistory-quickFilters">
            <button onClick={() => handleQuickFilter('today')}>{t('today')}</button>
            <button onClick={() => handleQuickFilter('yesterday')}>{t('yesterday')}</button>
            <button onClick={() => handleQuickFilter('last7')}>{t('last7Days')}</button>
            <button onClick={() => handleQuickFilter('last30')}>{t('last30Days')}</button>
            <button onClick={() => handleQuickFilter('thisMonth')}>{t('thisMonth')}</button>
            <button onClick={() => handleQuickFilter('lastMonth')}>{t('lastMonth')}</button>
          </div>
          <div className="SalesHistory-filterGroup">
            <label>{t('startDate')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="SalesHistory-filterGroup">
            <label>{t('endDate')}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <button className="SalesHistory-search" onClick={loadSales}>
            {t('search')}
          </button>
          <button
            className="SalesHistory-print-report"
            onClick={handlePrintSummary}
            disabled={sales.length === 0}
            style={{ marginLeft: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
          >
            <Printer size={18} /> {t('printReport')}
          </button>
        </div>

        {error && <div className="SalesHistory-error">{error}</div>}

        {loading ? (
          <div className="SalesHistory-loading">{t('loading')}</div>
        ) : (
          <div className="SalesHistory-table">
            <table>
              <thead>
                <tr>
                  <th>{t('saleId')}</th>
                  <th>{t('items')}</th>
                  <th>{t('date')}</th>
                  <th>{t('total')}</th>
                  <th>{t('paymentMethod')}</th>
                  <th>{t('profitAmount')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="SalesHistory-empty">
                      {t('noSalesFound')}
                    </td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        #{sale.id}
                        {sale.isReturned && (
                          <span className="SalesHistory-badge SalesHistory-badge--returned">
                            {t('returned')}
                          </span>
                        )}
                      </td>
                      <td className="SalesHistory-items-summary">
                        {sale.items.map((item, idx) => {
                          const saleReturns = returnedItems.get(sale.id);
                          const returnedQty = saleReturns?.get(item.variantId) || 0;
                          return (
                            <div key={idx} className={`SalesHistory-item-row ${returnedQty > 0 ? 'SalesHistory-item--returned' : ''}`}>
                              {item.productName}
                              {item.size || item.color ? ` (${[item.size, item.color].filter(Boolean).join('/')})` : ''}
                              {' '}x{item.quantity}
                              {returnedQty > 0 && (
                                <span className="SalesHistory-returned-badge">
                                  <RotateCcw size={12} /> {returnedQty} {t('returned')}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </td>
                      <td>{new Date(sale.saleDate).toLocaleString()}</td>
                      <td>{sale.totalIQD.toLocaleString('en-IQ')} IQD</td>
                      <td>{sale.paymentMethod || 'N/A'}</td>
                      <td>
                        {sale.profitIQD
                          ? `${sale.profitIQD.toLocaleString('en-IQ')} IQD`
                          : 'N/A'}
                      </td>
                      <td>
                        <button
                          className="SalesHistory-view"
                          onClick={() => handleViewSale(sale.id)}
                        >
                          {t('viewDetails')}
                        </button>
                        <button
                          className="SalesHistory-delete-row"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSale(sale.id);
                          }}
                          style={{ marginLeft: '5px', backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          {t('delete')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
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
