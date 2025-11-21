import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import ProductVariantTable from '../components/ProductVariantTable';
import PrintingModal, { ReturnPrintData } from '../components/PrintingModal';
import './Pages.css';
import './ReturnsPage.css';

type ReturnResponse = import('../types/electron').ReturnResponse;
type ReturnInput = import('../types/electron').ReturnInput;
type Product = import('../types/electron').Product;
type Customer = import('../types/electron').Customer;
type SaleDetail = import('../types/electron').SaleDetail;

interface DraftReturnItem {
  variant?: Product;
  variantId?: number;
  quantity: number;
  amountIQD: number;
  direction: 'return' | 'exchange_out' | 'exchange_in';
  saleItemId?: number | null;
  productName?: string;
  color?: string | null;
  size?: string | null;
}

const ReturnsPage = (): JSX.Element => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [returns, setReturns] = useState<ReturnResponse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showVariantPicker, setShowVariantPicker] = useState(false);
  const [items, setItems] = useState<DraftReturnItem[]>([]);
  const [saleLookupId, setSaleLookupId] = useState<string>('');
  const [saleInfo, setSaleInfo] = useState<SaleDetail | null>(null);
  const [form, setForm] = useState<Omit<ReturnInput, 'items'>>({
    branchId: 1,
    processedBy: 1,
    type: 'with_receipt',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [printData, setPrintData] = useState<ReturnPrintData | null>(null);
  const [preferredPrinter, setPreferredPrinter] = useState<string | null>(null);

  const loadData = async () => {
    if (!window.evaApi || !token) return;
    try {
      setLoading(true);
      const [returnsResponse, productsResponse, customersResponse] = await Promise.all([
        window.evaApi.returns.list(token),
        window.evaApi.products.list(token),
        window.evaApi.customers.list(token),
      ]);
      setReturns(returnsResponse);
      setProducts(productsResponse.products);
      setCustomers(customersResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load returns.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  const totalRefund = useMemo(
    () => items.filter((item) => item.direction !== 'exchange_in').reduce((acc, item) => acc + item.amountIQD, 0),
    [items],
  );

  const handleAddVariant = (variant: Product) => {
    // For exchanges, new items added should be "exchange_in"
    // For returns, they should be "return"
    const direction = form.type === 'exchange' ? 'exchange_in' : 'return';
    setItems((prev) => [
      ...prev,
      {
        variant,
        variantId: variant.id,
        quantity: 1,
        amountIQD: variant.salePriceIQD,
        direction,
        productName: variant.productName,
        color: variant.color ?? null,
        size: variant.size ?? null,
      },
    ]);
    setShowVariantPicker(false);
  };

  const parseBarcodeValue = (value: string): number | null => {
    // Parse barcode formats: "SALE24" -> 24, "RETURN5" -> 5, or just "24" -> 24
    const saleMatch = value.match(/^SALE(\d+)$/i);
    if (saleMatch) {
      return Number(saleMatch[1]);
    }
    const returnMatch = value.match(/^RETURN(\d+)$/i);
    if (returnMatch) {
      return Number(returnMatch[1]);
    }
    // Try parsing as plain number
    const num = Number(value);
    if (!isNaN(num) && num > 0) {
      return num;
    }
    return null;
  };

  const handleLoadSale = async (saleIdValue?: string | number) => {
    const idToUse = saleIdValue !== undefined 
      ? (typeof saleIdValue === 'string' ? parseBarcodeValue(saleIdValue) : saleIdValue)
      : parseBarcodeValue(saleLookupId);
    
    if (!idToUse || !window.evaApi) {
      if (saleIdValue !== undefined) {
        setError('Invalid barcode format. Expected format: SALE[number] or [number]');
      }
      setSaleInfo(null);
      return;
    }
    
    try {
      setError(null);
      const response = await window.evaApi.returns.saleInfo(token!, idToUse);
      setSaleInfo(response);
      if (response?.customerId) {
        setForm((prev) => ({ ...prev, customerId: response.customerId ?? undefined }));
      }
      setForm((prev) => ({ ...prev, saleId: response ? response.id : undefined }));
      // Clear the lookup field after successful scan
      if (saleIdValue !== undefined) {
        setSaleLookupId('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find sale.');
      setSaleInfo(null);
    }
  };

  // Handle barcode scanning
  const handleBarcodeScan = (value: string) => {
    const saleId = parseBarcodeValue(value);
    if (saleId) {
      handleLoadSale(saleId);
    } else {
      setError('Invalid barcode. Please scan a receipt barcode (format: SALE[number]).');
    }
  };

  useBarcodeScanner({ onScan: handleBarcodeScan, threshold: 50, minLength: 5 });

  const handleAddSaleItem = (entry: SaleDetail['items'][number]) => {
    // For exchanges, items from the original sale should be "exchange_out"
    // For returns, they should be "return"
    const direction = form.type === 'exchange' ? 'exchange_out' : 'return';
    setItems((prev) => [
      ...prev,
      {
        variantId: entry.variantId,
        saleItemId: entry.id,
        quantity: entry.quantity,
        amountIQD: entry.lineTotalIQD,
        direction,
        productName: entry.productName,
        color: entry.color ?? null,
        size: entry.size ?? null,
      },
    ]);
  };

  const handleSubmit = async () => {
    if (!items.length) {
      setError('Add at least one item to process a return.');
      return;
    }
    if (!window.evaApi || !token) {
      setError('API unavailable or not authenticated.');
      return;
    }
    
    // Validate all items have valid variantId
    const invalidItems = items.filter((item) => {
      const variantId = item.variantId ?? item.variant?.id;
      return !variantId || variantId === 0;
    });
    
    if (invalidItems.length > 0) {
      setError('Some items are missing variant information. Please remove and re-add them.');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      const payload: ReturnInput = {
        ...form,
        customerId: form.customerId ? Number(form.customerId) : undefined,
        saleId: form.saleId ? Number(form.saleId) : undefined,
        refundAmountIQD: totalRefund,
        items: items.map((item) => {
          const variantId = item.variantId ?? item.variant?.id;
          if (!variantId) {
            throw new Error(`Item "${item.productName ?? 'Unknown'}" is missing variant ID`);
          }
          return {
            saleItemId: item.saleItemId ?? null,
            variantId,
            quantity: item.quantity,
            amountIQD: item.amountIQD,
            direction: item.direction,
          };
        }),
      };
      const response = await window.evaApi.returns.create(token!, payload);
      setPrintData({
        id: response.id,
        totalIQD: response.refundAmountIQD,
        customerName: customers.find((c) => c.id === form.customerId)?.name,
        items: items.map((item) => ({
          name: item.productName ?? item.variant?.productName ?? `Variant #${item.variantId}`,
          variant: `${item.variant?.color ?? item.color ?? 'Any'} / ${item.variant?.size ?? item.size ?? 'Any'}`,
          quantity: item.quantity,
          amountIQD: item.amountIQD,
        })),
      });
      setItems([]);
      setForm((prev) => ({ ...prev, saleId: undefined, customerId: undefined, reason: '' }));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process return.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="Page Page--transparent ReturnsPage">
      <div className="ReturnsPage-header">
        <div>
          <h1>{t('returnsExchanges')}</h1>
          <p>{t('processRefunds')}</p>
        </div>
        <div className="ReturnsPage-actions">
          <span>{t('refundTotal')}: {totalRefund.toLocaleString('en-IQ')} IQD</span>
          <button onClick={() => setShowVariantPicker(true)}>{t('addItem')}</button>
          <button className="primary" onClick={handleSubmit} disabled={submitting || !items.length}>
            {submitting ? t('processing') : t('completeReturn')}
          </button>
        </div>
      </div>

      {error && <div className="ReturnsPage-alert">{error}</div>}

      <section className="ReturnsPage-form">
        <label>
          <span>{t('type')}</span>
          <select
            value={form.type}
            onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as ReturnInput['type'] }))}
          >
            <option value="with_receipt">{t('returnWithReceipt')}</option>
            <option value="without_receipt">{t('returnWithoutReceipt')}</option>
            <option value="exchange">{t('exchange')}</option>
          </select>
        </label>
        <label>
          <span>{t('saleIDOptional')} / {t('scanBarcode') || 'Scan Barcode'}</span>
          <div className="ReturnsPage-saleLookup">
            <input
              type="text"
              value={saleLookupId}
              onChange={(event) => setSaleLookupId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && saleLookupId.trim()) {
                  handleLoadSale();
                }
              }}
              placeholder={t('enterSaleID') + ' or scan receipt barcode'}
            />
            <button type="button" onClick={() => handleLoadSale()}>
              {t('lookup')}
            </button>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'rgba(148, 163, 184, 0.7)', marginTop: '0.25rem' }}>
            {t('scanReceiptBarcode') || 'Scan the barcode from the receipt to automatically load sale information'}
          </p>
        </label>
        <label>
          <span>{t('customer')}</span>
          <select
            value={form.customerId ?? ''}
            onChange={(event) => setForm((prev) => ({ ...prev, customerId: event.target.value ? Number(event.target.value) : undefined }))}
          >
            <option value="">Walk-in</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>
        <label className="ReturnsPage-span">
          <span>Reason</span>
          <textarea
            rows={2}
            value={form.reason ?? ''}
            onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
            placeholder={t('reasonOrNotes')}
          />
        </label>
      </section>

      {saleInfo && (
        <section className="ReturnsPage-saleInfo">
          <header>
            <div>
              <h3>Sale #{saleInfo.id}</h3>
              <p>{new Date(saleInfo.saleDate).toLocaleString()}</p>
            </div>
            <div>
              <span>Total: {saleInfo.totalIQD.toLocaleString('en-IQ')} IQD</span>
            </div>
          </header>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Line (IQD)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {saleInfo.items.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    {entry.productName} – {entry.color ?? 'Any'} / {entry.size ?? 'Any'}
                  </td>
                  <td>{entry.quantity}</td>
                  <td>{entry.lineTotalIQD.toLocaleString('en-IQ')}</td>
                  <td>
                    <button onClick={() => handleAddSaleItem(entry)}>Add</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="ReturnsPage-items">
        <header>
          <h3>{t('returnItems')}</h3>
        </header>
        {items.length === 0 ? (
          <div className="ReturnsPage-empty">{t('noItemsAddedYet')}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Amount (IQD)</th>
                <th>Direction</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.variantId}-${index}`}>
                  <td>
                    <strong>{item.variant?.productName ?? item.productName ?? 'Item'}</strong>
                    <small>
                      {item.variant?.color ?? item.color ?? 'Any'} / {item.variant?.size ?? item.size ?? 'Any'}
                    </small>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(event) =>
                        setItems((prev) =>
                          prev.map((draft, idx) => (idx === index ? { ...draft, quantity: Number(event.target.value) } : draft)),
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={item.amountIQD}
                      onChange={(event) =>
                        setItems((prev) =>
                          prev.map((draft, idx) => (idx === index ? { ...draft, amountIQD: Number(event.target.value) } : draft)),
                        )
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={item.direction}
                      onChange={(event) =>
                        setItems((prev) =>
                          prev.map((draft, idx) =>
                            idx === index ? { ...draft, direction: event.target.value as DraftReturnItem['direction'] } : draft,
                          ),
                        )
                      }
                    >
                      <option value="return">{t('returnToStock') || 'Return to stock'}</option>
                      <option value="exchange_out">{t('exchangeReturningItem') || 'Exchange - returning item'}</option>
                      <option value="exchange_in">{t('exchangeNewItem') || 'Exchange - new item'}</option>
                    </select>
                  </td>
                  <td>
                    <button className="ReturnsPage-delete" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== index))}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="ReturnsPage-list">
        <header>
          <h3>{t('recentReturns')}</h3>
        </header>
        {loading ? (
          <div className="ReturnsPage-empty">{t('loadingReturns')}</div>
        ) : returns.length === 0 ? (
          <div className="ReturnsPage-empty">{t('noReturnsRecorded')}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>{t('type')}</th>
                <th>{t('customer')}</th>
                <th>Refund (IQD)</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((record) => {
                const customerName = customers.find((c) => c.id === record.customerId)?.name ?? 'Walk-in';
                return (
                  <tr key={record.id}>
                    <td>{record.id}</td>
                    <td>{record.type}</td>
                    <td>{customerName}</td>
                    <td>{record.refundAmountIQD.toLocaleString('en-IQ')}</td>
                    <td>{new Date(record.createdAt).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {showVariantPicker && (
        <div className="ReturnsPage-variantsOverlay">
          <div className="ReturnsPage-variantsCard">
            <header>
              <h3>Select Variant</h3>
              <button onClick={() => setShowVariantPicker(false)}>✕</button>
            </header>
            <ProductVariantTable
              products={products}
              actionLabel="Add to Return"
              onAction={(variantId) => {
                const variant = products.find((p) => p.id === variantId);
                if (variant) {
                  handleAddVariant(variant);
                }
              }}
            />
          </div>
        </div>
      )}

      <PrintingModal
        visible={!!printData}
        returnData={printData ?? undefined}
        printerName={preferredPrinter}
        onPrinterChange={setPreferredPrinter}
        onClose={() => setPrintData(null)}
      />
    </div>
  );
};

export default ReturnsPage;

