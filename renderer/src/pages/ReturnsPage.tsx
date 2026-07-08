import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import ProductVariantTable from '../components/ProductVariantTable';
import PrintingModal, { ReturnPrintData } from '../components/PrintingModal';
import NumberInput from '../components/NumberInput';
import { Search, Receipt, Plus, Trash2, History, Check, Loader2 } from 'lucide-react';
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
  maxQuantity?: number;
  unitPriceIQD?: number;
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

  const getReturnTypeLabel = (type: string) => {
    switch (type) {
      case 'with_receipt': return t('returnWithReceipt') || 'Return with receipt';
      case 'without_receipt': return t('returnWithoutReceipt') || 'Return without receipt';
      case 'exchange': return t('exchange') || 'Exchange';
      default: return type;
    }
  };

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
      setError(err instanceof Error ? err.message : t('failedToLoadReturns'));
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
        unitPriceIQD: variant.salePriceIQD,
      },
    ]);
    setShowVariantPicker(false);
  };

  const parseBarcodeValue = (value: string): number | null => {
    const cleanValue = value.trim();
    const saleMatch = cleanValue.match(/^SALE(\d+)$/i);
    if (saleMatch) return Number(saleMatch[1]);
    const returnMatch = cleanValue.match(/^RETURN(\d+)$/i);
    if (returnMatch) return Number(returnMatch[1]);
    const num = Number(cleanValue);
    if (!isNaN(num) && num > 0) return num;
    return null;
  };

  const handleLoadSale = async (saleIdValue?: string | number) => {
    const idToUse = saleIdValue !== undefined
      ? (typeof saleIdValue === 'string' ? parseBarcodeValue(saleIdValue) : saleIdValue)
      : parseBarcodeValue(saleLookupId);

    if (!idToUse || !window.evaApi) {
      if (saleIdValue !== undefined) {
        setError(t('invalidBarcodeFormat'));
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
      if (saleIdValue !== undefined) {
        setSaleLookupId('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToFindSale'));
      setSaleInfo(null);
    }
  };

  const handleBarcodeScan = (value: string) => {
    const saleId = parseBarcodeValue(value);
    if (saleId) {
      handleLoadSale(saleId);
    } else {
      setError(t('invalidBarcodeScanReceipt'));
    }
  };

  useBarcodeScanner({ onScan: handleBarcodeScan, threshold: 50, minLength: 5 });

  const handleAddSaleItem = (entry: SaleDetail['items'][number]) => {
    const exists = items.some((item) => item.saleItemId === entry.id);
    if (exists) {
      setError(t('itemAlreadyAdded') || 'This item is already in the return list.');
      return;
    }

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
        maxQuantity: entry.quantity,
        unitPriceIQD: entry.lineTotalIQD / entry.quantity,
      },
    ]);
  };

  const handleQuantityChange = (index: number, newQty: number) => {
    setItems((prev) =>
      prev.map((draft, idx) => {
        if (idx !== index) return draft;
        const cappedQty = draft.maxQuantity ? Math.min(draft.maxQuantity, Math.max(1, newQty)) : Math.max(1, newQty);
        const unitPrice = draft.unitPriceIQD ?? (draft.quantity > 0 ? draft.amountIQD / draft.quantity : 0);
        const newAmount = Math.round(cappedQty * unitPrice);
        return {
          ...draft,
          quantity: cappedQty,
          amountIQD: newAmount,
        };
      })
    );
  };

  const handleSubmit = async () => {
    if (!items.length) {
      setError(t('addAtLeastOneItemReturn'));
      return;
    }
    if (!window.evaApi || !token) {
      setError(t('apiUnavailable'));
      return;
    }

    const invalidItems = items.filter((item) => {
      const variantId = item.variantId ?? item.variant?.id;
      return !variantId || variantId === 0;
    });

    if (invalidItems.length > 0) {
      setError(t('missingVariantInfo'));
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
            throw new Error(item.productName ? `${item.productName} is missing variant details` : 'Missing variant details');
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
          variant: `${item.variant?.color ?? item.color ?? t('anyVariant')} / ${item.variant?.size ?? item.size ?? t('anyVariant')}`,
          quantity: item.quantity,
          amountIQD: item.amountIQD,
        })),
      });
      setItems([]);
      setForm((prev) => ({ ...prev, saleId: undefined, customerId: undefined, reason: '' }));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToProcessReturn'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="Page Page--transparent ReturnsPage">
      <div className="ReturnsPage-header">
        <div>
          <h1>{t('returnsExchanges') || 'Returns & Exchanges'}</h1>
          <p>{t('processRefunds') || 'Quickly process customer refunds and exchanges.'}</p>
        </div>
      </div>

      {error && <div className="ReturnsPage-alert">{error}</div>}

      <div className="ReturnsPage-layout">
        {/* Sidebar Configuration Panel */}
        <aside className="ReturnsPage-sidebar">
          {/* Configuration Form Card */}
          <div className="ReturnsPage-formCard">
            <div>
              <h3>{t('returnDetails') || 'Return Details'}</h3>
              
              {/* Total Refund KPI inside Form */}
              <div className="ReturnsPage-kpiDisplay">
                <span>{t('refundTotal') || 'Refund Total'}</span>
                <strong>{totalRefund.toLocaleString('en-IQ')} IQD</strong>
              </div>

              <div className="ReturnsPage-formField" style={{ marginTop: '0.75rem' }}>
                <span>{t('type') || 'Type'}</span>
                <select
                  value={form.type}
                  onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as ReturnInput['type'] }))}
                >
                  <option value="with_receipt">{t('returnWithReceipt') || 'Return With Receipt'}</option>
                  <option value="without_receipt">{t('returnWithoutReceipt') || 'Return Without Receipt'}</option>
                  <option value="exchange">{t('exchange') || 'Exchange'}</option>
                </select>
              </div>

              <div className="ReturnsPage-formField" style={{ marginTop: '0.75rem' }}>
                <span>{t('customer') || 'Customer'}</span>
                <select
                  value={form.customerId ?? ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, customerId: event.target.value ? Number(event.target.value) : undefined }))}
                >
                  <option value="">{t('walkIn') || 'Walk-In Customer'}</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ReturnsPage-formField" style={{ marginTop: '0.75rem' }}>
                <span>{t('reason') || 'Reason'}</span>
                <textarea
                  rows={2}
                  value={form.reason ?? ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
                  placeholder={t('reasonOrNotes') || 'Write return notes...'}
                />
              </div>
            </div>

            <button 
              className="ReturnsPage-btnSubmit" 
              onClick={handleSubmit} 
              disabled={submitting || !items.length}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>{t('processing') || 'Processing...'}</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>{t('completeReturn') || 'Complete Return'}</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Main Processing Area */}
        <main className="ReturnsPage-main">
          {/* Sale Lookup Card */}
          {form.type !== 'without_receipt' && (
            <div className="ReturnsPage-searchBar">
              <div className="ReturnsPage-searchBar-label">
                <Search size={16} />
                <span>{t('lookupSale') || 'Search Sale Receipt'}:</span>
              </div>
              <input
                type="text"
                className="ReturnsPage-lookupInput"
                value={saleLookupId}
                onChange={(event) => setSaleLookupId(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && saleLookupId.trim()) {
                    handleLoadSale();
                  }
                }}
                placeholder={t('enterSaleID') || 'Enter sale ID or scan receipt...'}
              />
              <button type="button" className="ReturnsPage-btnLookup" onClick={() => handleLoadSale()}>
                {t('lookup') || 'Find'}
              </button>
            </div>
          )}

          {/* Loaded Sale Details Card */}
          {saleInfo && (
            <div className="ReturnsPage-card" style={{ borderLeft: '3px solid #10b981' }}>
              <div className="ReturnsPage-saleInfo-header">
                <div>
                  <h4>{t('sale') || 'Sale'} #{saleInfo.id}</h4>
                  <p>{new Date(saleInfo.saleDate).toLocaleString()}</p>
                </div>
                <span>{t('total') || 'Total'}: {saleInfo.totalIQD.toLocaleString('en-IQ')} IQD</span>
              </div>
              
              <div className="ReturnsPage-tableContainer">
                <table className="ReturnsPage-cartTable">
                  <thead>
                    <tr>
                      <th style={{ width: '55%' }}>{t('product') || 'Product'}</th>
                      <th style={{ width: '15%', textAlign: 'center' }}>{t('qty') || 'Quantity'}</th>
                      <th style={{ width: '20%' }}>{t('lineTotal') || 'Total'}</th>
                      <th style={{ width: '10%' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {saleInfo.items.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <strong>{entry.productName}</strong>
                          {(entry.color || entry.size) && (
                            <span className="Reports-variantBadge" style={{ marginInlineStart: '0.5rem' }}>
                              {[entry.color, entry.size].filter(Boolean).join(' / ')}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>{entry.quantity}</td>
                        <td>{entry.lineTotalIQD.toLocaleString('en-IQ')} IQD</td>
                        <td style={{ textAlign: 'end' }}>
                          <button className="ReturnsPage-btnAddItem" onClick={() => handleAddSaleItem(entry)}>
                            {t('add') || 'Add'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Return Cart Card */}
          <div className="ReturnsPage-card">
            <div className="ReturnsPage-cardHeader">
              <h3>
                <Receipt size={16} /> {t('returnItems') || 'Items to Return'}
              </h3>
              <div className="ReturnsPage-cardHeader-actions">
                <button className="ReturnsPage-btnManualAdd" onClick={() => setShowVariantPicker(true)}>
                  <Plus size={14} />
                  <span>{t('addItem') || 'Add Item Manual'}</span>
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="ReturnsPage-empty">{t('noItemsAddedYet') || 'No items added for return yet.'}</div>
            ) : (
              <div className="ReturnsPage-tableContainer" style={{ maxHeight: '280px' }}>
                <table className="ReturnsPage-cartTable">
                  <thead>
                    <tr>
                      <th style={{ width: '38%' }}>{t('product') || 'Product'}</th>
                      <th style={{ width: '12%', textAlign: 'center' }}>{t('qty') || 'Qty'}</th>
                      <th style={{ width: '18%' }}>{t('amount') || 'Amount'} (IQD)</th>
                      <th style={{ width: '24%' }}>{t('direction') || 'Action'}</th>
                      <th style={{ width: '8%' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const name = item.variant?.productName ?? item.productName ?? 'Unknown';
                      const variantStr = [item.variant?.color ?? item.color, item.variant?.size ?? item.size].filter(Boolean).join(' / ') || '—';
                      return (
                        <tr key={`${item.variantId}-${index}`}>
                          <td>
                            <strong>{name}</strong>
                            {variantStr !== '—' && (
                              <span className="Reports-variantBadge" style={{ marginInlineStart: '0.5rem' }}>
                                {variantStr}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <NumberInput
                              min="1"
                              max={item.maxQuantity}
                              style={{ width: '60px', textAlign: 'center' }}
                              value={item.quantity}
                              onChange={(event) =>
                                handleQuantityChange(index, Number(event.target.value))
                              }
                            />
                          </td>
                          <td>
                            <NumberInput
                              min="0"
                              style={{ width: '110px' }}
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
                              <option value="return">{t('returnToStock') || 'Return to Stock'}</option>
                              <option value="exchange_out">{t('exchangeReturningItem') || 'Exchange (Return Item)'}</option>
                              <option value="exchange_in">{t('exchangeNewItem') || 'Exchange (New Item)'}</option>
                            </select>
                          </td>
                          <td style={{ textAlign: 'end' }}>
                            <button className="ReturnsPage-btnDeleteRow" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== index))}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Returns Table Card inside Scrollable Main */}
          <section className="ReturnsPage-recentCard">
            <div className="ReturnsPage-cardHeader">
              <h3>
                <History size={16} /> {t('recentReturns') || 'Recent Returns'}
              </h3>
            </div>
            
            {loading ? (
              <div className="ReturnsPage-empty">
                <Loader2 size={24} className="spin" style={{ color: 'var(--text-secondary)' }} />
              </div>
            ) : returns.length === 0 ? (
              <div className="ReturnsPage-empty">{t('noReturnsRecorded') || 'No returns recorded yet.'}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="ReturnsPage-recentTable">
                  <thead>
                    <tr>
                      <th style={{ width: '10%' }}>{t('id') || 'ID'}</th>
                      <th style={{ width: '25%' }}>{t('type') || 'Type'}</th>
                      <th style={{ width: '25%' }}>{t('customer') || 'Customer'}</th>
                      <th style={{ width: '20%' }}>{t('refund') || 'Refund'} (IQD)</th>
                      <th style={{ width: '20%' }}>{t('date') || 'Date'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returns.map((record) => {
                      const customerName = customers.find((c) => c.id === record.customerId)?.name ?? t('walkIn') ?? 'Walk-In';
                      return (
                        <tr key={record.id}>
                          <td><code className="Reports-skuCode">#{record.id}</code></td>
                          <td>{getReturnTypeLabel(record.type)}</td>
                          <td>{customerName}</td>
                          <td><strong>{record.refundAmountIQD.toLocaleString('en-IQ')} IQD</strong></td>
                          <td>{new Date(record.createdAt).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Manual Product Variant Selector Overlay */}
      {showVariantPicker && (
        <div className="ReturnsPage-variantsOverlay">
          <div className="ReturnsPage-variantsCard">
            <header>
              <h3>{t('selectVariant') || 'Select Product Variant'}</h3>
              <button onClick={() => setShowVariantPicker(false)}>✕</button>
            </header>
            <ProductVariantTable
              products={products}
              actionLabel={t('addToReturn') || 'Add to Return'}
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

      {/* Printing Dialog */}
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
