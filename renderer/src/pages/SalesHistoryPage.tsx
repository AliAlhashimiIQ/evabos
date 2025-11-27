import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import PrintingModal from '../components/PrintingModal';
import './Pages.css';
import './SalesHistoryPage.css';

type Sale = import('../types/electron').Sale;
type SaleDetail = import('../types/electron').SaleDetail;
type DateRange = import('../types/electron').DateRange;

const SalesHistoryPage = (): JSX.Element => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { saleId } = useParams<{ saleId: string }>();
  const [sales, setSales] = useState<Sale[]>([]);
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
      setError('Desktop bridge unavailable.');
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
      setError(err instanceof Error ? err.message : 'Failed to load sales.');
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
      setError(err instanceof Error ? err.message : 'Failed to load sale details.');
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

  if (saleId && selectedSale) {
    // Show sale detail view
    return (
      <div className="Page SalesHistory">
        <div className="Page-header">
          <button className="SalesHistory-back" onClick={() => navigate('/sales')}>
            ← Back to Sales List
          </button>
          <h1>Sale #{selectedSale.id}</h1>
          <button
            className="SalesHistory-print"
            onClick={() => handlePrintSale(selectedSale)}
          >
            🖨️ Print Receipt
          </button>
        </div>

        <div className="Page-content">
          <div className="SalesHistory-detail">
            <div className="SalesHistory-detailSection">
              <h3>Sale Information</h3>
              <div className="SalesHistory-detailGrid">
                <div>
                  <label>Sale ID:</label>
                  <span>#{selectedSale.id}</span>
                </div>
                <div>
                  <label>Date:</label>
                  <span>{new Date(selectedSale.saleDate).toLocaleString()}</span>
                </div>
                <div>
                  <label>Payment Method:</label>
                  <span>{selectedSale.paymentMethod || 'N/A'}</span>
                </div>
                <div>
                  <label>Subtotal:</label>
                  <span>{selectedSale.subtotalIQD.toLocaleString('en-IQ')} IQD</span>
                </div>
                <div>
                  <label>Discount:</label>
                  <span>{selectedSale.discountIQD.toLocaleString('en-IQ')} IQD</span>
                </div>
                <div>
                  <label>Total:</label>
                  <span className="SalesHistory-total">
                    {selectedSale.totalIQD.toLocaleString('en-IQ')} IQD
                  </span>
                </div>
                {selectedSale.profitIQD && (
                  <div>
                    <label>Profit:</label>
                    <span className="SalesHistory-profit">
                      {selectedSale.profitIQD.toLocaleString('en-IQ')} IQD
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="SalesHistory-detailSection">
              <h3>Items</h3>
              <div className="SalesHistory-itemsTable">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Variant</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Total</th>
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
        <h1>Sales History</h1>
      </div>

      <div className="Page-content">
        <div className="SalesHistory-filters">
          <div className="SalesHistory-filterGroup">
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="SalesHistory-filterGroup">
            <label>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <button className="SalesHistory-search" onClick={loadSales}>
            Search
          </button>
          <button
            className="SalesHistory-print-report"
            onClick={handlePrintSummary}
            disabled={sales.length === 0}
            style={{ marginLeft: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
          >
            🖨️ Print Report
          </button>
        </div>

        {error && <div className="SalesHistory-error">{error}</div>}

        {loading ? (
          <div className="SalesHistory-loading">Loading sales...</div>
        ) : (
          <div className="SalesHistory-table">
            <table>
              <thead>
                <tr>
                  <th>Sale ID</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Profit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="SalesHistory-empty">
                      No sales found for the selected date range
                    </td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>#{sale.id}</td>
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
                          View Details
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
