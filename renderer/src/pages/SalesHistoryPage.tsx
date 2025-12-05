import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate, useParams } from 'react-router-dom';
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
      const response = await window.evaApi.sales.listByDateRange(token, range);
      setSales(response.sales);
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

  const handlePrintSummary = () => {
    if (sales.length === 0) return;

    const totalAmount = sales.reduce((sum, sale) => sum + sale.totalIQD, 0);
    const summaryData: import('../components/PrintingModal').SalesSummaryData = {
      startDate,
      endDate,
      totalCount: sales.length,
      totalAmount,
      sales: sales.map(sale => ({
        id: sale.id,
        date: sale.saleDate,
        total: sale.totalIQD
      }))
    };
    setPrintSummary(summaryData);
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
            ← {t('backToSalesList')}
          </button>
          <h1>{t('sale')} #{selectedSale.id}</h1>
          <button
            className="SalesHistory-print"
            onClick={() => handlePrintSale(selectedSale)}
          >
            🖨️ {t('printReceipt')}
          </button>
          <button
            className="SalesHistory-delete"
            onClick={() => handleDeleteSale(selectedSale.id)}
            style={{ marginLeft: '10px', backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
          >
            🗑️ {t('delete')}
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
            🖨️ {t('printReport')}
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
                        {sale.items.map((item, idx) => (
                          <div key={idx} className="SalesHistory-item-row">
                            {item.productName}
                            {item.size || item.color ? ` (${[item.size, item.color].filter(Boolean).join('/')})` : ''}
                            {' '}x{item.quantity}
                          </div>
                        ))}
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
