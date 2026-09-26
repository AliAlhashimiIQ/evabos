import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import PrintingModal, { ReturnPrintData } from '../components/PrintingModal';
import NumberInput from '../components/NumberInput';
import { Search, Receipt, Plus, Trash2, History, Check, Loader2, Package, AlertTriangle, X } from 'lucide-react';
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
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const [returns, setReturns] = useState<ReturnResponse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showVariantPicker, setShowVariantPicker] = useState(false);
  const [items, setItems] = useState<DraftReturnItem[]>([]);
  const [saleLookupId, setSaleLookupId] = useState<string>('');
  const [saleInfo, setSaleInfo] = useState<SaleDetail | null>(null);
  const [form, setForm] = useState<Omit<ReturnInput, 'items'>>({
    branchId: user?.branchId || 1,
    processedBy: user?.userId || 1,
    type: 'with_receipt',
    paymentMethod: 'cash',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [printData, setPrintData] = useState<ReturnPrintData | null>(null);
  const [preferredPrinter, setPreferredPrinter] = useState<string | null>(null);
  const [selectedReturnDetail, setSelectedReturnDetail] = useState<ReturnResponse | null>(null);
  const [variantSearchQuery, setVariantSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  const filteredPickerProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategoryFilter === 'all' || p.category === selectedCategoryFilter;
      if (!matchesCategory) return false;

      if (!variantSearchQuery.trim()) return true;
      const q = variantSearchQuery.toLowerCase().trim();
      return (
        (p.productName && p.productName.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.color && p.color.toLowerCase().includes(q)) ||
        (p.size && p.size.toLowerCase().includes(q))
      );
    });
  }, [products, variantSearchQuery, selectedCategoryFilter]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  useEffect(() => {
    if (window.electronAPI?.getSetting) {
      window.electronAPI.getSetting('receipt_printer_name').then((p: string | null) => {
        if (p) setPreferredPrinter(p);
      });
    }
  }, []);

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
        window.evaApi.returns.list(token, { limit: 200 }),
        window.evaApi.products.list(token),
        window.evaApi.customers.list(token),
      ]);
      setReturns(returnsResponse || []);
      setProducts(productsResponse.products || []);
      setCustomers(customersResponse || []);
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

  const totalReturned = useMemo(
    () => items.filter((item) => item.direction !== 'exchange_in').reduce((acc, item) => acc + item.amountIQD, 0),
    [items],
  );

  const totalTaken = useMemo(
    () => items.filter((item) => item.direction === 'exchange_in').reduce((acc, item) => acc + item.amountIQD, 0),
    [items],
  );

  const netDifference = totalReturned - totalTaken;
  const refundAmount = netDifference > 0 ? netDifference : 0;
  const customerPaysAmount = netDifference < 0 ? Math.abs(netDifference) : 0;

  const daysSinceSale = useMemo(() => {
    if (!saleInfo?.saleDate) return null;
    const diffMs = Date.now() - new Date(saleInfo.saleDate).getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }, [saleInfo]);

  const handleAddVariant = (variant: Product) => {
    const hasReturnItems = items.some((i) => i.direction !== 'exchange_in');
    const direction = form.type === 'exchange' ? (hasReturnItems ? 'exchange_in' : 'exchange_out') : 'return';

    if (direction === 'exchange_in') {
      const stock = variant.stockOnHand ?? 0;
      if (stock <= 0) {
        setError(`${t('insufficientStockExchange') || 'الكمية غير متوفرة في المخزون لهذا البديل'}: ${variant.productName}`);
        return;
      }
    }

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
    if (!value) return null;
    const cleanValue = value.trim();
    const saleMatch = cleanValue.match(/^SALE[-_#]?(\d+)$/i);
    if (saleMatch) return Number(saleMatch[1]);
    const returnMatch = cleanValue.match(/^RETURN[-_#]?(\d+)$/i);
    if (returnMatch) return Number(returnMatch[1]);
    const invMatch = cleanValue.match(/^INV[-_#]?(\d+)$/i);
    if (invMatch) return Number(invMatch[1]);
    const digitsOnly = cleanValue.replace(/[^\d]/g, '');
    const num = Number(digitsOnly);
    if (!isNaN(num) && num > 0) return num;
    return null;
  };

  const handleLoadSale = async (saleIdValue?: string | number) => {
    const idToUse = saleIdValue !== undefined
      ? (typeof saleIdValue === 'string' ? parseBarcodeValue(saleIdValue) : saleIdValue)
      : parseBarcodeValue(saleLookupId);

    if (!idToUse || !window.evaApi) {
      if (saleIdValue !== undefined || saleLookupId.trim()) {
        setError(t('invalidBarcodeFormat') || 'Invalid invoice number. Please enter digits or scan barcode.');
      }
      setSaleInfo(null);
      return;
    }

    try {
      setError(null);
      const response = await window.evaApi.returns.saleInfo(token!, idToUse);
      if (!response || !response.id) {
        setError(t('failedToFindSale') || 'Invoice not found.');
        setSaleInfo(null);
        return;
      }
      setSaleInfo(response);
      if (response?.customerId) {
        setForm((prev) => ({ ...prev, customerId: response.customerId ?? undefined }));
      }
      setForm((prev) => ({ ...prev, saleId: response ? response.id : undefined }));
      setSaleLookupId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToFindSale'));
      setSaleInfo(null);
    }
  };

  const handleAddAllSaleItems = () => {
    if (!saleInfo?.items?.length) return;
    const direction = form.type === 'exchange' ? 'exchange_out' : 'return';
    const discountRatio = (saleInfo.subtotalIQD > 0 && saleInfo.totalIQD >= 0)
      ? Math.max(0, Math.min(1, saleInfo.totalIQD / saleInfo.subtotalIQD))
      : 1;

    const newItems: DraftReturnItem[] = saleInfo.items
      .filter((entry) => (entry.quantity ?? 0) > 0)
      .map((entry) => {
        const rawUnitPrice = entry.quantity > 0 ? entry.lineTotalIQD / entry.quantity : 0;
        const effectiveUnitPrice = Math.round(rawUnitPrice * discountRatio);
        const effectiveLineTotal = Math.round(entry.lineTotalIQD * discountRatio);

        return {
          variantId: entry.variantId,
          saleItemId: entry.id,
          quantity: entry.quantity,
          amountIQD: effectiveLineTotal,
          direction,
          productName: entry.productName,
          color: entry.color ?? null,
          size: entry.size ?? null,
          maxQuantity: entry.quantity,
          unitPriceIQD: effectiveUnitPrice,
        };
      });
    setItems(newItems);
  };

  const handleViewReturnDetail = async (returnId: number) => {
    if (!window.evaApi || !token) return;
    try {
      const detail = await window.evaApi.returns.get(token, returnId);
      if (detail) {
        setSelectedReturnDetail(detail);
      }
    } catch (err) {
      console.error('Failed to load return details:', err);
    }
  };

  const handleBarcodeScan = (value: string) => {
    if (!value) return;
    const clean = value.trim();

    // 1. Explicit invoice/receipt barcode check (SALE-xxx, INV-xxx, RETURN-xxx)
    const isExplicitReceipt = /^SALE[-_#]?\d+$/i.test(clean) || /^INV[-_#]?\d+$/i.test(clean) || /^RETURN[-_#]?\d+$/i.test(clean);
    const saleId = parseBarcodeValue(clean);

    if (isExplicitReceipt && saleId) {
      handleLoadSale(saleId);
      return;
    }

    // 2. Product garment barcode or SKU scan
    const matchedProduct = products.find(
      (p) => (p.barcode && p.barcode.toLowerCase() === clean.toLowerCase()) || 
             (p.sku && p.sku.toLowerCase() === clean.toLowerCase())
    );

    if (matchedProduct) {
      // If a sale is currently loaded, see if this product is an item on the sale
      if (saleInfo && form.type !== 'without_receipt') {
        const saleItem = saleInfo.items.find((entry) => entry.variantId === matchedProduct.id);
        if (saleItem) {
          handleAddSaleItem(saleItem);
          return;
        }
      }

      // Add directly to cart
      const hasReturnItems = items.some((i) => i.direction !== 'exchange_in');
      const direction = form.type === 'exchange' ? (hasReturnItems ? 'exchange_in' : 'exchange_out') : 'return';

      if (direction === 'exchange_in') {
        if ((matchedProduct.stockOnHand ?? 0) <= 0) {
          setError(`${t('insufficientStockExchange') || 'الكمية غير متوفرة في المخزون لهذا البديل'}: ${matchedProduct.productName}`);
          return;
        }
      }

      const existingIdx = items.findIndex((i) => i.variantId === matchedProduct.id && i.direction === direction);
      if (existingIdx >= 0) {
        handleQuantityChange(existingIdx, items[existingIdx].quantity + 1);
      } else {
        setItems((prev) => [
          ...prev,
          {
            variant: matchedProduct,
            variantId: matchedProduct.id,
            quantity: 1,
            amountIQD: matchedProduct.salePriceIQD,
            direction,
            productName: matchedProduct.productName,
            color: matchedProduct.color ?? null,
            size: matchedProduct.size ?? null,
            unitPriceIQD: matchedProduct.salePriceIQD,
          },
        ]);
      }
      return;
    }

    // 3. Fallback: If numeric and no product matched, try loading as sale ID
    if (saleId) {
      handleLoadSale(saleId);
    } else {
      setError(t('invalidBarcodeScanReceipt') || 'لم يتم العثور على فاتورة أو صنف مطابق للباركود الممسوح.');
    }
  };

  useBarcodeScanner({
    onScan: handleBarcodeScan,
    threshold: 50,
    minLength: 5,
    enabled: !showVariantPicker && !printData && !selectedReturnDetail,
  });

  const handleAddSaleItem = (entry: SaleDetail['items'][number]) => {
    if ((entry.quantity ?? 0) <= 0) {
      setError(t('itemAlreadyFullyReturned') || 'This item has already been fully returned.');
      return;
    }
    const exists = items.some((item) => item.saleItemId === entry.id);
    if (exists) {
      setError(t('itemAlreadyAdded') || 'This item is already in the return list.');
      return;
    }

    const direction = form.type === 'exchange' ? 'exchange_out' : 'return';
    const discountRatio = (saleInfo && saleInfo.subtotalIQD > 0 && saleInfo.totalIQD >= 0)
      ? Math.max(0, Math.min(1, saleInfo.totalIQD / saleInfo.subtotalIQD))
      : 1;
    const rawUnitPrice = entry.quantity > 0 ? entry.lineTotalIQD / entry.quantity : 0;
    const effectiveUnitPrice = Math.round(rawUnitPrice * discountRatio);
    const effectiveLineTotal = Math.round(entry.lineTotalIQD * discountRatio);

    setItems((prev) => [
      ...prev,
      {
        variantId: entry.variantId,
        saleItemId: entry.id,
        quantity: entry.quantity,
        amountIQD: effectiveLineTotal,
        direction,
        productName: entry.productName,
        color: entry.color ?? null,
        size: entry.size ?? null,
        maxQuantity: entry.quantity,
        unitPriceIQD: effectiveUnitPrice,
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

    // Guard stock for exchange replacement items
    for (const item of items) {
      if (item.direction === 'exchange_in') {
        const prod = item.variant ?? products.find((p) => p.id === item.variantId);
        if (prod && (prod.stockOnHand ?? 0) < item.quantity) {
          setError(`${t('insufficientStockExchange') || 'الكمية غير متوفرة في المخزون'}: ${item.productName || prod.productName}`);
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      setError(null);
      const payload: ReturnInput = {
        ...form,
        branchId: user?.branchId || form.branchId || 1,
        processedBy: user?.userId || form.processedBy || 1,
        customerId: form.customerId ? Number(form.customerId) : undefined,
        saleId: form.saleId ? Number(form.saleId) : undefined,
        refundAmountIQD: refundAmount,
        customerPaidIQD: customerPaysAmount,
        paymentMethod: form.paymentMethod || 'cash',
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
        type: response.type,
        totalIQD: response.refundAmountIQD,
        refundAmountIQD: response.refundAmountIQD,
        customerPaidIQD: response.customerPaidIQD,
        paymentMethod: response.paymentMethod,
        totalReturnedIQD: totalReturned,
        totalTakenIQD: totalTaken,
        customerName: customers.find((c) => c.id === form.customerId)?.name,
        items: items.map((item) => ({
          name: item.productName ?? item.variant?.productName ?? `Variant #${item.variantId}`,
          variant: `${item.variant?.color ?? item.color ?? t('anyVariant')} / ${item.variant?.size ?? item.size ?? t('anyVariant')}`,
          quantity: item.quantity,
          amountIQD: item.amountIQD,
          direction: item.direction,
        })),
      });
      setItems([]);
      setForm((prev) => ({ ...prev, saleId: undefined, customerId: undefined, reason: '' }));
      setSaleInfo(null);
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
              
              {/* Dynamic Financial Settlement KPI */}
              <div 
                className="ReturnsPage-kpiDisplay"
                style={{
                  background: netDifference > 0 
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.2) 100%)'
                    : netDifference < 0 
                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.2) 100%)'
                    : 'linear-gradient(135deg, rgba(100, 116, 139, 0.15) 0%, rgba(71, 85, 105, 0.2) 100%)',
                  border: `1.5px solid ${
                    netDifference > 0 ? '#10b981' : netDifference < 0 ? '#3b82f6' : '#64748b'
                  }`,
                  padding: '0.85rem',
                  borderRadius: '0.75rem',
                  marginBottom: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {form.type === 'exchange'
                      ? (netDifference > 0 ? (t('storeRefunds') || 'المبلغ المسترد للزبون') : netDifference < 0 ? (t('customerPays') || 'المبلغ المطلوب من الزبون') : (t('evenExchange') || 'استبدال متكافئ'))
                      : (t('refundTotal') || 'إجمالي الاسترداد')}
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontWeight: 700,
                      background: netDifference > 0 ? 'rgba(16, 185, 129, 0.2)' : netDifference < 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                      color: netDifference > 0 ? '#10b981' : netDifference < 0 ? '#3b82f6' : '#94a3b8',
                    }}
                  >
                    {netDifference > 0 ? 'استرداد' : netDifference < 0 ? 'دفع إضافي' : 'متكافئ'}
                  </span>
                </div>
                <strong style={{ fontSize: '1.4rem', color: netDifference > 0 ? '#10b981' : netDifference < 0 ? '#3b82f6' : 'var(--text-primary)', display: 'block' }}>
                  {Math.abs(netDifference).toLocaleString('en-IQ')} IQD
                </strong>

                {/* Breakdown for Exchange */}
                {form.type === 'exchange' && items.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed rgba(255,255,255,0.1)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>{t('returnedItemsSubtotal') || 'المرتجع'}: <b dir="ltr">{totalReturned.toLocaleString('en-IQ')}</b></span>
                    <span>{t('exchangeItemsSubtotal') || 'البديل'}: <b dir="ltr">{totalTaken.toLocaleString('en-IQ')}</b></span>
                  </div>
                )}
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
                <span>{t('paymentMethodLabel') || 'Payment / Refund Method'}</span>
                <select
                  value={form.paymentMethod || 'cash'}
                  onChange={(event) => setForm((prev) => ({ ...prev, paymentMethod: event.target.value }))}
                >
                  <option value="cash">{t('cash') || 'نقدي (كاش)'}</option>
                  <option value="card">{t('card') || 'بطاقة (كي كارد)'}</option>
                  <option value="balance">{t('customerBalance') || 'رصيد عميل'}</option>
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
              style={{
                background: netDifference < 0 ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : undefined
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>{t('processing') || 'Processing...'}</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>
                    {netDifference < 0
                      ? `${t('completeExchangeAndCollect') || 'إتمام وقبض'} ${Math.abs(netDifference).toLocaleString('en-IQ')} د.ع`
                      : netDifference > 0
                      ? `${t('completeReturnAndRefund') || 'إتمام واسترداد'} ${netDifference.toLocaleString('en-IQ')} د.ع`
                      : (t('completeExchange') || 'إتمام الاستبدال المتكافئ')}
                  </span>
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
                placeholder={t('scanReceiptOrProduct') || 'Enter sale ID or scan receipt/garment barcode...'}
              />
              <button type="button" className="ReturnsPage-btnLookup" onClick={() => handleLoadSale()}>
                {t('lookup') || 'Find'}
              </button>
            </div>
          )}

          {/* Loaded Sale Details Card */}
          {saleInfo && (
            <div className="ReturnsPage-card" style={{ borderInlineStart: '4px solid #10b981' }}>
              <div className="ReturnsPage-saleInfo-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4>{t('sale') || 'Sale'} #{saleInfo.id}</h4>
                    {daysSinceSale !== null && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 7px',
                          borderRadius: '6px',
                          fontWeight: 600,
                          background: daysSinceSale > 14 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: daysSinceSale > 14 ? '#ef4444' : '#3b82f6',
                        }}
                      >
                        {daysSinceSale === 0 ? (t('todayInvoice') || 'اليوم') : `${t('daysAgo') ? t('daysAgo').replace('{days}', String(daysSinceSale)) : `منذ ${daysSinceSale} يوم`}`}
                      </span>
                    )}
                  </div>
                  <p dir="ltr" style={{ textAlign: 'start' }}>
                    {new Date(saleInfo.saleDate).toLocaleString('ar-IQ', {
                      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true
                    })}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {saleInfo.discountIQD > 0 && (
                    <span style={{ fontSize: '0.78rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '0.375rem', fontWeight: 600 }}>
                      خصم الفاتورة: -{saleInfo.discountIQD.toLocaleString('en-IQ')} د.ع (استرجاع بالسعر الصافي)
                    </span>
                  )}
                  <span style={{ fontWeight: 700, color: '#10b981' }}>
                    {t('total') || 'Total'}: <b dir="ltr">{saleInfo.totalIQD.toLocaleString('en-IQ')} IQD</b>
                  </span>
                  <button
                    type="button"
                    className="ReturnsPage-btnAddAll"
                    onClick={handleAddAllSaleItems}
                    style={{
                      padding: '0.4rem 0.8rem',
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                    }}
                  >
                    + {t('addAllItems') || 'إرجاع كل الفاتورة'}
                  </button>
                </div>
              </div>

              {/* Expiration Warning Alert if > 14 days */}
              {daysSinceSale !== null && daysSinceSale > 14 && (
                <div 
                  style={{
                    margin: '0.5rem 1rem',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    color: '#f59e0b',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>
                    {t('returnPolicyWarning') 
                      ? t('returnPolicyWarning').replace('{days}', String(daysSinceSale))
                      : `تنبيه: تم إصدار هذه الفاتورة منذ ${daysSinceSale} يوماً (أكثر من فترة السماح المعتادة 14 يوماً).`}
                  </span>
                </div>
              )}
              
              <div className="ReturnsPage-tableContainer">
                <table className="ReturnsPage-cartTable">
                  <thead>
                    <tr>
                      <th style={{ width: '50%' }}>{t('product') || 'Product'}</th>
                      <th style={{ width: '15%', textAlign: 'center' }}>{t('qty') || 'Quantity'}</th>
                      <th style={{ width: '20%' }}>{t('lineTotal') || 'Total'}</th>
                      <th style={{ width: '15%', textAlign: 'center' }}>{t('action') || 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleInfo.items.map((entry) => {
                      const isFullyReturned = (entry.quantity ?? 0) <= 0;
                      return (
                        <tr key={entry.id} style={isFullyReturned ? { opacity: 0.55 } : undefined}>
                          <td>
                            <strong>{entry.productName}</strong>
                            {(entry.color || entry.size) && (
                              <span className="Reports-variantBadge" style={{ marginInlineStart: '0.5rem' }}>
                                {[entry.color, entry.size].filter(Boolean).join(' / ')}
                              </span>
                            )}
                            {entry.alreadyReturnedQuantity != null && entry.alreadyReturnedQuantity > 0 && (
                              <span
                                style={{
                                  marginInlineStart: '0.5rem',
                                  fontSize: '0.75rem',
                                  color: '#ef4444',
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                }}
                              >
                                {`${t('alreadyReturned') || 'Returned'}: ${entry.alreadyReturnedQuantity}`}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {entry.quantity}
                            {entry.originalQuantity != null && entry.originalQuantity !== entry.quantity && (
                              <span style={{ fontSize: '0.75rem', color: '#888', display: 'block' }}>
                                {`/ ${entry.originalQuantity}`}
                              </span>
                            )}
                          </td>
                          <td dir="ltr" style={{ textAlign: 'start' }}>{entry.lineTotalIQD.toLocaleString('en-IQ')} IQD</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="ReturnsPage-btnAddItem"
                              onClick={() => handleAddSaleItem(entry)}
                              disabled={isFullyReturned}
                              style={isFullyReturned ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                            >
                              {isFullyReturned ? (t('fullyReturned') || 'Returned') : `+ ${t('add') || 'Return'}`}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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

          {/* Recent Returns Table Card */}
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
                      <th style={{ width: '20%' }}>{t('type') || 'Type'}</th>
                      <th style={{ width: '22%' }}>{t('customer') || 'Customer'}</th>
                      <th style={{ width: '20%' }}>{t('settlement') || t('refund') || 'التسوية'}</th>
                      <th style={{ width: '18%' }}>{t('date') || 'Date'}</th>
                      <th style={{ width: '10%', textAlign: 'center' }}>{t('action') || 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returns.map((record) => {
                      const customerName = customers.find((c) => c.id === record.customerId)?.name ?? t('walkIn') ?? 'مشاة';
                      return (
                        <tr
                          key={record.id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleViewReturnDetail(record.id)}
                        >
                          <td><code className="Reports-skuCode">#{record.id}</code></td>
                          <td>
                            <span className={`ReturnsPage-typeBadge ReturnsPage-typeBadge--${record.type}`}>
                              {getReturnTypeLabel(record.type)}
                            </span>
                          </td>
                          <td>{customerName}</td>
                          <td>
                            {record.refundAmountIQD > 0 ? (
                              <strong style={{ color: '#10b981' }} dir="ltr">
                                +{record.refundAmountIQD.toLocaleString('en-IQ')} IQD
                              </strong>
                            ) : (record.customerPaidIQD ?? 0) > 0 ? (
                              <strong style={{ color: '#3b82f6' }} dir="ltr">
                                -{(record.customerPaidIQD ?? 0).toLocaleString('en-IQ')} IQD
                              </strong>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                                0 IQD
                              </span>
                            )}
                          </td>
                          <td dir="ltr" style={{ fontSize: '0.82rem', textAlign: 'start' }}>
                            {new Date(record.createdAt).toLocaleString('ar-IQ', {
                              year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true
                            })}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="ReturnsPage-btnAddItem"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewReturnDetail(record.id);
                              }}
                              style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <Receipt size={13} />
                              <span>{t('viewReceipt') || 'عرض الإيصال'}</span>
                            </button>
                          </td>
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

      {/* Return Detail Modal */}
      {selectedReturnDetail && (
        <div className="ReturnsPage-variantsOverlay" onClick={() => setSelectedReturnDetail(null)}>
          <div className="ReturnsPage-variantsCard" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
            <header>
              <h3>
                <Receipt size={18} /> {t('returnDetails') || 'تفاصيل المرتجع'} #{selectedReturnDetail.id}
              </h3>
              <button onClick={() => setSelectedReturnDetail(null)} aria-label="Close"><X size={18} /></button>
            </header>
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.88rem' }}>
                <div><strong>{t('type') || 'النوع'}:</strong> {getReturnTypeLabel(selectedReturnDetail.type)}</div>
                <div><strong>{t('customer') || 'العميل'}:</strong> {customers.find((c) => c.id === selectedReturnDetail.customerId)?.name || t('walkIn') || 'مشاة'}</div>
                <div><strong>{t('date') || 'التاريخ'}:</strong> <span dir="ltr">{new Date(selectedReturnDetail.createdAt).toLocaleString('ar-IQ', { hour12: true })}</span></div>
                <div>
                  <strong>{t('paymentMethodLabel') || 'طريقة الدفع'}:</strong>{' '}
                  <span>
                    {selectedReturnDetail.paymentMethod === 'card' ? 'بطاقة (كي كارد)' : selectedReturnDetail.paymentMethod === 'balance' ? 'رصيد عميل' : 'نقدي (كاش)'}
                  </span>
                </div>
                {selectedReturnDetail.refundAmountIQD > 0 && (
                  <div><strong>{t('storeRefunds') || 'المبلغ المسترد للزبون'}:</strong> <strong style={{ color: '#10b981' }} dir="ltr">{selectedReturnDetail.refundAmountIQD.toLocaleString('en-IQ')} IQD</strong></div>
                )}
                {(selectedReturnDetail.customerPaidIQD ?? 0) > 0 && (
                  <div><strong>{t('customerPays') || 'المبلغ المقبوض من الزبون'}:</strong> <strong style={{ color: '#3b82f6' }} dir="ltr">{(selectedReturnDetail.customerPaidIQD ?? 0).toLocaleString('en-IQ')} IQD</strong></div>
                )}
                {selectedReturnDetail.refundAmountIQD === 0 && (!selectedReturnDetail.customerPaidIQD || selectedReturnDetail.customerPaidIQD === 0) && (
                  <div><strong>{t('evenExchange') || 'النتيجة'}:</strong> <strong style={{ color: '#64748b' }}>استبدال متكافئ (0 د.ع)</strong></div>
                )}
              </div>
              {selectedReturnDetail.reason && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <strong>{t('reason') || 'السبب'}:</strong> {selectedReturnDetail.reason}
                </div>
              )}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>{t('items') || 'الأصناف'}:</h4>
                <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  <table className="ReturnsPage-cartTable" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>{t('product') || 'المنتج'}</th>
                        <th style={{ textAlign: 'center' }}>{t('direction') || 'الإجراء'}</th>
                        <th style={{ textAlign: 'center' }}>{t('qty') || 'الكمية'}</th>
                        <th>{t('amount') || 'المبلغ'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedReturnDetail.items || []).map((it, idx) => {
                        const prodName = it.productName ?? products.find((p) => p.id === it.variantId)?.productName ?? `Variant #${it.variantId}`;
                        const isReplacement = it.direction === 'exchange_in';
                        return (
                          <tr key={idx}>
                            <td>
                              <strong>{prodName}</strong>
                              {(it.color || it.size) && (
                                <span className="Reports-variantBadge" style={{ marginInlineStart: '0.4rem' }}>
                                  {[it.color, it.size].filter(Boolean).join(' / ')}
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: isReplacement ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                  color: isReplacement ? '#3b82f6' : '#10b981',
                                }}
                              >
                                {isReplacement ? 'بديل جديد' : 'صنف مسترجع'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>{it.quantity}</td>
                            <td dir="ltr" style={{ textAlign: 'start' }}>{it.amountIQD.toLocaleString('en-IQ')} IQD</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setPrintData({
                      id: selectedReturnDetail.id,
                      type: selectedReturnDetail.type,
                      totalIQD: selectedReturnDetail.refundAmountIQD,
                      refundAmountIQD: selectedReturnDetail.refundAmountIQD,
                      customerPaidIQD: selectedReturnDetail.customerPaidIQD,
                      paymentMethod: selectedReturnDetail.paymentMethod,
                      customerName: customers.find((c) => c.id === selectedReturnDetail.customerId)?.name,
                      items: (selectedReturnDetail.items || []).map((it) => ({
                        name: it.productName ?? products.find((p) => p.id === it.variantId)?.productName ?? `Variant #${it.variantId}`,
                        variant: `${it.color ?? ''} ${it.size ?? ''}`.trim() || undefined,
                        quantity: it.quantity,
                        amountIQD: it.amountIQD,
                        direction: it.direction,
                      })),
                    });
                    setSelectedReturnDetail(null);
                  }}
                  className="ReturnsPage-btnLookup"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Receipt size={15} /> {t('printReceipt') || 'طباعة الإيصال'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Product Variant Selector Overlay */}
      {showVariantPicker && (
        <div className="ReturnsPage-variantsOverlay" onClick={() => setShowVariantPicker(false)}>
          <div className="ReturnsPage-variantsCard" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '880px' }}>
            <header>
              <h3>
                <Package size={18} /> {t('selectVariant') || 'اختر متغير المنتج للإرجاع أو الاستبدال'}
              </h3>
              <button onClick={() => setShowVariantPicker(false)} aria-label="Close"><X size={18} /></button>
            </header>

            {/* Filter & Search Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', insetInlineStart: '0.85rem', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  autoFocus
                  placeholder={t('searchProductVariant') || 'ابحث باسم المنتج، الكود أو الباركود...'}
                  value={variantSearchQuery}
                  onChange={(e) => setVariantSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem',
                    paddingInlineStart: '2.5rem',
                    borderRadius: '0.75rem',
                    border: '1.5px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '0.92rem',
                    outline: 'none',
                  }}
                />
              </div>

              {categories.length > 0 && (
                <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryFilter('all')}
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '9999px',
                      border: '1px solid',
                      borderColor: selectedCategoryFilter === 'all' ? '#3b82f6' : 'var(--border-color)',
                      background: selectedCategoryFilter === 'all' ? '#3b82f6' : 'var(--bg-secondary)',
                      color: selectedCategoryFilter === 'all' ? '#fff' : 'var(--text-secondary)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t('all') || 'الكل'}
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategoryFilter(cat)}
                      style={{
                        padding: '0.3rem 0.75rem',
                        borderRadius: '9999px',
                        border: '1px solid',
                        borderColor: selectedCategoryFilter === cat ? '#3b82f6' : 'var(--border-color)',
                        background: selectedCategoryFilter === cat ? '#3b82f6' : 'var(--bg-secondary)',
                        color: selectedCategoryFilter === cat ? '#fff' : 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Results Table */}
            <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '0.75rem' }}>
              {filteredPickerProducts.length === 0 ? (
                <div className="ReturnsPage-empty">
                  <p>{t('noProductsFound') || 'لا توجد منتجات مطابقة للبحث.'}</p>
                </div>
              ) : (
                <table className="ReturnsPage-cartTable" style={{ fontSize: '0.88rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '30%' }}>{t('product') || 'المنتج'}</th>
                      <th style={{ width: '15%' }}>{t('sku') || 'الكود'}</th>
                      <th style={{ width: '15%' }}>{t('barcode') || 'الباركود'}</th>
                      <th style={{ width: '14%' }}>{t('price') || 'السعر'}</th>
                      <th style={{ width: '12%', textAlign: 'center' }}>{t('stock') || 'المخزون'}</th>
                      <th style={{ width: '14%', textAlign: 'center' }}>{t('action') || 'الإجراء'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPickerProducts.map((p) => {
                      const variantTag = [p.color, p.size].filter(Boolean).join(' • ');
                      const isOutOfStock = (p.stockOnHand ?? 0) <= 0;
                      const isExchangeIn = form.type === 'exchange' && items.some((i) => i.direction !== 'exchange_in');
                      const isDisabled = isExchangeIn && isOutOfStock;

                      return (
                        <tr
                          key={p.id}
                          style={{ cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.55 : 1 }}
                          onClick={() => {
                            if (!isDisabled) handleAddVariant(p);
                          }}
                        >
                          <td>
                            <strong>{p.productName}</strong>
                            {variantTag && (
                              <span className="Reports-variantBadge" style={{ marginInlineStart: '0.5rem' }}>
                                {variantTag}
                              </span>
                            )}
                            {p.category && (
                              <span style={{ fontSize: '0.72rem', opacity: 0.65, display: 'block' }}>
                                {p.category}
                              </span>
                            )}
                          </td>
                          <td><code className="Reports-skuCode">{p.sku || '—'}</code></td>
                          <td><span style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>{p.barcode || '—'}</span></td>
                          <td><strong dir="ltr">{p.salePriceIQD.toLocaleString('en-IQ')} IQD</strong></td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              style={{
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: '5px',
                                background: !isOutOfStock ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                color: !isOutOfStock ? '#10b981' : '#ef4444',
                              }}
                            >
                              {!isOutOfStock ? p.stockOnHand : (t('outOfStock') || 'نفد')}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="ReturnsPage-btnAddItem"
                              disabled={isDisabled}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddVariant(p);
                              }}
                              style={{
                                padding: '0.35rem 0.8rem',
                                fontSize: '0.82rem',
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                              }}
                            >
                              + {t('add') || 'إضافة'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
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
