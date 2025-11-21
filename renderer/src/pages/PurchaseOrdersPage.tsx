import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import ProductVariantTable from '../components/ProductVariantTable';
import './Pages.css';
import './PurchaseOrdersPage.css';

type Supplier = import('../types/electron').Supplier;
type Product = import('../types/electron').Product;
type PurchaseOrderInput = import('../types/electron').PurchaseOrderInput;
type PurchaseOrderWithItems = import('../types/electron').PurchaseOrderWithItems;

interface DraftItem {
  variantId: number;
  quantity: number;
  costUSD: number;
  costIQD: number;
}

const PurchaseOrdersPage = (): JSX.Element => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(1500);
  const [form, setForm] = useState<PurchaseOrderInput>({
    supplierId: 0,
    branchId: 1,
    status: 'ordered',
    reference: '',
    subtotalUSD: 0,
    shippingUSD: 0,
    taxesUSD: 0,
    notes: '',
    items: [],
  });
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [showVariants, setShowVariants] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!window.evaApi || !token) {
      setError('Desktop bridge unavailable.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [supplierResponse, productResponse, poResponse, rateResponse] = await Promise.all([
        window.evaApi.suppliers.list(token),
        window.evaApi.products.list(token),
        window.evaApi.purchaseOrders.list(token),
        window.evaApi.exchangeRates.getCurrent(),
      ]);
      if (rateResponse.currentRate) {
        setExchangeRate(rateResponse.currentRate.rate);
      }
      setSuppliers(supplierResponse);
      setProducts(productResponse.products);
      setPurchaseOrders(poResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToLoadPurchaseOrders'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  const handleAddItem = (variant: Product) => {
    setDraftItems((prev) => [
      ...prev,
      {
        variantId: variant.id,
        quantity: 1,
        costUSD: variant.purchaseCostUSD || 0,
        costIQD: (variant.purchaseCostUSD || 0) * exchangeRate,
      },
    ]);
    setShowVariants(false);
  };

  const totals = useMemo(() => {
    const subtotalUSD = draftItems.reduce((acc, item) => acc + item.costUSD * item.quantity, 0);
    const subtotalIQD = draftItems.reduce((acc, item) => acc + item.costIQD * item.quantity, 0);
    return { subtotalUSD, subtotalIQD };
  }, [draftItems]);

  const handleCreatePo = async () => {
    if (!form.supplierId || draftItems.length === 0) {
      setError(t('selectSupplierAndAddItems'));
      return;
    }
    if (!window.evaApi) {
      setError('Desktop bridge unavailable.');
      return;
    }
    try {
      setSubmitting(true);
      await window.evaApi.purchaseOrders.create(token!, {
        ...form,
        subtotalUSD: totals.subtotalUSD,
        items: draftItems.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
          costUSD: item.costUSD,
          costIQD: item.costIQD,
        })),
      });
      setForm((prev) => ({ ...prev, supplierId: 0, reference: '', notes: '' }));
      setDraftItems([]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToCreatePO'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceive = async (purchaseOrderId: number) => {
    if (!window.evaApi) return;
    try {
      await window.evaApi.purchaseOrders.receive(token!, { purchaseOrderId, receivedBy: 1 });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to receive purchase order.');
    }
  };

  return (
    <div className="Page Page--transparent PurchaseOrdersPage">
      <div className="PurchaseOrdersPage-header">
        <div>
          <h1>{t('purchaseOrders')}</h1>
          <p>{t('trackInboundStock')}</p>
        </div>
        <div className="PurchaseOrdersPage-actions">
          <button onClick={() => setShowVariants(true)}>{t('addItems')}</button>
          <button className="primary" onClick={handleCreatePo} disabled={submitting || !draftItems.length}>
            {submitting ? t('saving') : t('createPO')}
          </button>
        </div>
      </div>

      {error && <div className="PurchaseOrdersPage-alert">{error}</div>}

      <section className="PurchaseOrdersPage-form">
        <label>
          <span>{t('suppliers')}</span>
          <select
            value={form.supplierId || ''}
            onChange={(event) => setForm((prev) => ({ ...prev, supplierId: Number(event.target.value) }))}
          >
            <option value="">{t('selectSupplier')}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('reference')}</span>
          <input
            type="text"
            value={form.reference ?? ''}
            onChange={(event) => setForm((prev) => ({ ...prev, reference: event.target.value }))}
          />
        </label>
        <label>
          <span>{t('notes')}</span>
          <textarea
            rows={2}
            value={form.notes ?? ''}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </label>
      </section>

      <section className="PurchaseOrdersPage-draft">
        <header>
          <h3>{t('draftItems')}</h3>
          <div>
            <span>{t('subtotalUSD')}: {totals.subtotalUSD.toFixed(2)}</span>
            <span>{t('subtotalIQD')}: {totals.subtotalIQD.toLocaleString('en-IQ')}</span>
          </div>
        </header>
        {draftItems.length === 0 ? (
          <div className="PurchaseOrdersPage-empty">{t('noItemsInDraft')}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Variant</th>
                <th>Qty</th>
                <th>Cost USD</th>
                <th>Cost IQD</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {draftItems.map((item, index) => {
                const variant = products.find((p) => p.id === item.variantId);
                if (!variant) return null;
                return (
                  <tr key={`${item.variantId}-${index}`}>
                    <td>
                      <strong>{variant.productName}</strong>
                      <small>
                        {variant.color ?? 'Any'} / {variant.size ?? 'Any'}
                      </small>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) =>
                          setDraftItems((prev) =>
                            prev.map((draft, idx) =>
                              idx === index ? { ...draft, quantity: Number(event.target.value) } : draft,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.costUSD}
                        onChange={(event) =>
                          setDraftItems((prev) =>
                            prev.map((draft, idx) =>
                              idx === index
                                ? {
                                    ...draft,
                                    costUSD: Number(event.target.value),
                                    costIQD: Number(event.target.value) * exchangeRate,
                                  }
                                : draft,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>{item.costIQD.toLocaleString('en-IQ')}</td>
                    <td>
                      <button
                        className="PurchaseOrdersPage-delete"
                        onClick={() => setDraftItems((prev) => prev.filter((_, idx) => idx !== index))}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="PurchaseOrdersPage-list">
        <header>
          <h3>{t('recentPurchaseOrders')}</h3>
        </header>
        {loading ? (
          <div className="PurchaseOrdersPage-empty">{t('loadingPurchaseOrders')}</div>
        ) : purchaseOrders.length === 0 ? (
          <div className="PurchaseOrdersPage-empty">{t('noPurchaseOrdersRecorded')}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Supplier</th>
                <th>Status</th>
                <th>Subtotal USD</th>
                <th>Items</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((po) => (
                <tr key={po.id}>
                  <td>{po.id}</td>
                  <td>{po.supplierName}</td>
                  <td>
                    <span className={`PurchaseOrdersPage-status ${po.status}`}>{po.status}</span>
                  </td>
                  <td>{po.subtotalUSD.toFixed(2)}</td>
                  <td>{po.items.length}</td>
                  <td>
                    {po.status !== 'received' && (
                      <button onClick={() => handleReceive(po.id)}>Mark Received</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showVariants && (
        <div className="PurchaseOrdersPage-variantsOverlay">
          <div className="PurchaseOrdersPage-variantsCard">
            <header>
              <h3>Select Variants</h3>
              <button onClick={() => setShowVariants(false)}>✕</button>
            </header>
            <ProductVariantTable
              products={products}
              actionLabel="Add Item"
              onAction={(variantId) => {
                const variant = products.find((p) => p.id === variantId);
                if (variant) {
                  handleAddItem(variant);
                }
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default PurchaseOrdersPage;

