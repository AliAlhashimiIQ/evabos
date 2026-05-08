import { useEffect, useState, useCallback } from 'react';
import {
  ShoppingBag, CheckCircle2, XCircle, Clock, Plus, Search,
  Loader2, Instagram, Phone, MessageCircle, Globe, Package,
  ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './OnlineOrdersPage.css';

type OnlineOrder = import('../types/electron').OnlineOrder;
type OnlineOrderStatus = import('../types/electron').OnlineOrderStatus;
type OnlineOrderSource = import('../types/electron').OnlineOrderSource;
type Product = import('../types/electron').Product;

const SOURCE_ICONS: Record<OnlineOrderSource, JSX.Element> = {
  instagram: <Instagram size={14} />,
  tiktok: <Globe size={14} />,
  whatsapp: <MessageCircle size={14} />,
  phone: <Phone size={14} />,
  other: <Globe size={14} />,
};
const SOURCE_LABELS: Record<OnlineOrderSource, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', whatsapp: 'WhatsApp', phone: 'Phone', other: 'Other',
};
const STATUS_CFG: Record<OnlineOrderStatus, { label: string; cls: string; icon: JSX.Element }> = {
  pending:   { label: 'قيد الانتظار',   cls: 'OO-badge--pending',   icon: <Clock size={12} /> },
  confirmed: { label: 'مؤكد', cls: 'OO-badge--confirmed', icon: <CheckCircle2 size={12} /> },
  rejected:  { label: 'مرفوض',  cls: 'OO-badge--rejected',  icon: <XCircle size={12} /> },
};

interface CartItem { product: Product; quantity: number; unitPrice: number; }

const OnlineOrdersPage = (): JSX.Element => {
  const { token, user } = useAuth();
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OnlineOrderStatus | 'all'>('pending');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [exchangeRate, setExchangeRate] = useState(1500);
  const [showForm, setShowForm] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [formSource, setFormSource] = useState<OnlineOrderSource>('instagram');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formDiscount, setFormDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!window.evaApi || !token) return;
    try {
      setLoading(true); setError(null);
      const result = await window.evaApi.onlineOrders.list(token, statusFilter === 'all' ? undefined : statusFilter);
      setOrders(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [token, statusFilter]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (!window.evaApi) return;
    window.evaApi.exchangeRates.getCurrent().then((r: any) => { if (r.currentRate) setExchangeRate(r.currentRate.rate); });
  }, []);

  const loadProducts = useCallback(async () => {
    if (!window.evaApi || !token) return;
    const resp = await window.evaApi.products.list(token, { limit: 500, cursor: 0 });
    setProducts(resp.products || resp.items || []);
  }, [token]);

  useEffect(() => { if (showForm) loadProducts(); }, [showForm, loadProducts]);

  const handleConfirm = async (orderId: number) => {
    if (!window.evaApi || !token) return;
    setActionLoading(orderId);
    try { await window.evaApi.onlineOrders.confirm(token, orderId, exchangeRate); await loadOrders(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (orderId: number) => {
    if (!window.evaApi || !token) return;
    setActionLoading(orderId);
    try {
      await window.evaApi.onlineOrders.reject(token, orderId, rejectReason || undefined);
      setRejectingId(null); setRejectReason(''); await loadOrders();
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setActionLoading(null); }
  };

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.product.id === p.id);
      if (ex) return prev.map((i) => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product: p, quantity: 1, unitPrice: p.salePriceIQD }];
    });
  };

  const updateQty = (id: number, q: number) => {
    if (q <= 0) setCart((prev) => prev.filter((i) => i.product.id !== id));
    else setCart((prev) => prev.map((i) => i.product.id === id ? { ...i, quantity: q } : i));
  };

  const updatePrice = (id: number, price: number) =>
    setCart((prev) => prev.map((i) => i.product.id === id ? { ...i, unitPrice: price } : i));

  const cartSubtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const cartTotal = Math.max(cartSubtotal - formDiscount, 0);

  const handleSubmit = async () => {
    if (!window.evaApi || !token || !user) return;
    if (cart.length === 0) { setFormError('Add at least one item'); return; }
    setSubmitting(true); setFormError(null);
    try {
      await window.evaApi.onlineOrders.create(token, {
        branchId: user.branchId ?? 1,
        customerName: formCustomerName || null, customerPhone: formCustomerPhone || null,
        source: formSource, note: formNote || null,
        subtotalIQD: cartSubtotal, discountIQD: formDiscount, totalIQD: cartTotal,
        items: cart.map((i) => ({ variantId: i.product.id, quantity: i.quantity, unitPriceIQD: i.unitPrice, lineTotalIQD: i.unitPrice * i.quantity })),
      });
      setShowForm(false); setCart([]); setFormCustomerName(''); setFormCustomerPhone('');
      setFormNote(''); setFormDiscount(0); setProductSearch('');
      await loadOrders();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  const filteredProducts = products.filter((p) =>
    p.stockOnHand > 0 &&
    (productSearch === '' || 
      p.productName.toLowerCase().includes(productSearch.toLowerCase()) || 
      p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(productSearch.toLowerCase()))
    )
  );

  return (
    <div className="Page OO">
      <div className="OO-header">
        <div>
          <h1><ShoppingBag size={26} style={{ verticalAlign: 'middle', marginInlineEnd: '0.5rem' }} />الطلبات أونلاين</h1>
          <p>إدارة طلبات إنستغرام، تيك توك، وواتساب — يتم خصم المخزون <strong>فقط عند التأكيد</strong></p>
        </div>
        <button className="OO-newBtn" onClick={() => setShowForm(true)}><Plus size={18} /> طلب جديد أونلاين</button>
      </div>

      <div className="OO-tabs">
        {(['all', 'pending', 'confirmed', 'rejected'] as const).map((s) => (
          <button key={s} className={`OO-tab ${statusFilter === s ? 'OO-tab--active' : ''}`} onClick={() => setStatusFilter(s)}>
            {s === 'all' ? 'الكل' : STATUS_CFG[s as OnlineOrderStatus].label}
          </button>
        ))}
      </div>

      {loading && <div className="OO-loading"><Loader2 size={28} className="spin" /> جاري التحميل…</div>}
      {error && <div className="OO-error">{error}</div>}
      {!loading && orders.length === 0 && (
        <div className="OO-empty"><Package size={48} /><p>لا توجد طلبات بعد</p></div>
      )}

      <div className="OO-list">
        {orders.map((order) => {
          const cfg = STATUS_CFG[order.status];
          const expanded = expandedId === order.id;
          return (
            <div key={order.id} className={`OO-card OO-card--${order.status}`}>
              <div className="OO-card-header" onClick={() => setExpandedId(expanded ? null : order.id)}>
                <div className="OO-card-left">
                  <span className={`OO-badge ${cfg.cls}`}>{cfg.icon} {cfg.label}</span>
                  <span className="OO-orderId">#{order.id}</span>
                  <span className="OO-source">{SOURCE_ICONS[order.source]} {SOURCE_LABELS[order.source]}</span>
                  {order.customerName && <span className="OO-customer">{order.customerName}</span>}
                  {order.customerPhone && <span className="OO-phone">{order.customerPhone}</span>}
                </div>
                <div className="OO-card-right">
                  <span className="OO-total">{order.totalIQD.toLocaleString('en-IQ')} IQD</span>
                  <span className="OO-date">{new Date(order.createdAt).toLocaleDateString()}</span>
                  {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>

              {expanded && (
                <div className="OO-card-body">
                  <table className="OO-items">
                    <thead><tr><th>المنتج</th><th>النوع</th><th>الكمية</th><th>سعر الوحدة</th><th>المجموع</th></tr></thead>
                    <tbody>
                      {order.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.productName}</td>
                          <td>{[item.color, item.size].filter(Boolean).join(' / ') || '—'}</td>
                          <td>{item.quantity}</td>
                          <td>{item.unitPriceIQD.toLocaleString('en-IQ')}</td>
                          <td>{item.lineTotalIQD.toLocaleString('en-IQ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="OO-summary">
                    {order.discountIQD > 0 && <div>المجموع الفرعي: {order.subtotalIQD.toLocaleString('en-IQ')} | الخصم: {order.discountIQD.toLocaleString('en-IQ')}</div>}
                    <div className="OO-grandTotal">المجموع: {order.totalIQD.toLocaleString('en-IQ')} د.ع</div>
                    {order.note && <div className="OO-note">ملاحظة: {order.note}</div>}
                    {order.saleId && <div className="OO-saleRef">→ تم إنشاء عملية بيع #{order.saleId}</div>}
                    {order.rejectionReason && <div className="OO-rejReason">مرفوض: {order.rejectionReason}</div>}
                  </div>
                  {order.status === 'pending' && (
                    <div className="OO-actions">
                      {rejectingId === order.id ? (
                        <div className="OO-rejectForm">
                          <input placeholder="السبب (اختياري)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                          <button className="OO-btn OO-btn--danger" disabled={actionLoading === order.id} onClick={() => handleReject(order.id)}>
                            {actionLoading === order.id ? <Loader2 size={14} className="spin" /> : <XCircle size={14} />} تأكيد الرفض
                          </button>
                          <button className="OO-btn OO-btn--ghost" onClick={() => { setRejectingId(null); setRejectReason(''); }}>إلغاء</button>
                        </div>
                      ) : (
                        <>
                          <button className="OO-btn OO-btn--confirm" disabled={actionLoading === order.id} onClick={() => handleConfirm(order.id)}>
                            {actionLoading === order.id ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />} تأكيد — خصم المخزون وإنشاء عملية بيع
                          </button>
                          <button className="OO-btn OO-btn--reject" onClick={() => setRejectingId(order.id)}>
                            <XCircle size={14} /> رفض / إرجاع
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="OO-overlay" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="OO-modal">
            <div className="OO-modal-header">
              <h2>طلب جديد أونلاين</h2>
              <button className="OO-closeBtn" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <div className="OO-modal-body">
              <div className="OO-formSection">
                <h3>العميل والمصدر</h3>
                <div className="OO-formRow">
                  <label>الاسم<input value={formCustomerName} onChange={(e) => setFormCustomerName(e.target.value)} placeholder="اسم العميل" /></label>
                  <label>الهاتف<input value={formCustomerPhone} onChange={(e) => setFormCustomerPhone(e.target.value)} placeholder="07xx-xxx-xxxx" /></label>
                </div>
                <div className="OO-formRow">
                  <label>المصدر
                    <select value={formSource} onChange={(e) => setFormSource(e.target.value as OnlineOrderSource)}>
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="phone">Phone</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>ملاحظة<input value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="العنوان، طلبات خاصة…" /></label>
                </div>
              </div>

              <div className="OO-formSection">
                <h3>إضافة منتجات</h3>
                <div className="OO-productSearch">
                  <Search size={16} />
                  <input 
                    placeholder="البحث بالاسم أو الرمز…" 
                    value={productSearch} 
                    onChange={(e) => setProductSearch(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = (e.target as HTMLInputElement).value.toLowerCase().trim();
                        const exactMatch = products.find(p => 
                          (p.barcode && p.barcode.toLowerCase() === val) || 
                          p.sku.toLowerCase() === val
                        );
                        if (exactMatch) {
                          addToCart(exactMatch);
                          setProductSearch('');
                        } else if (filteredProducts.length === 1) {
                          addToCart(filteredProducts[0]);
                          setProductSearch('');
                        }
                      }
                    }}
                  />
                </div>
                <div className="OO-productGrid">
                  {filteredProducts.slice(0, 40).map((p) => (
                    <button key={p.id} className="OO-productCard" onClick={() => addToCart(p)}>
                      <span className="OO-productName">{p.productName}</span>
                      {(p.color || p.size) && <span className="OO-productVariant">{[p.color, p.size].filter(Boolean).join(' / ')}</span>}
                      <span className="OO-productPrice">{p.salePriceIQD.toLocaleString('en-IQ')} د.ع</span>
                      <span className="OO-productStock">المخزون: {p.stockOnHand}</span>
                    </button>
                  ))}
                </div>
              </div>

              {cart.length > 0 && (
                <div className="OO-formSection">
                  <h3>عناصر الطلب</h3>
                  <table className="OO-cartTable">
                    <thead><tr><th>المنتج</th><th>الكمية</th><th>سعر الوحدة</th><th>المجموع</th><th></th></tr></thead>
                    <tbody>
                      {cart.map((item) => (
                        <tr key={item.product.id}>
                          <td>{item.product.productName}{item.product.color ? ` / ${item.product.color}` : ''}{item.product.size ? ` / ${item.product.size}` : ''}</td>
                          <td><input type="number" min={1} max={item.product.stockOnHand} value={item.quantity} onChange={(e) => updateQty(item.product.id, Number(e.target.value))} className="OO-qtyInput" /></td>
                          <td><input type="number" min={0} value={item.unitPrice} onChange={(e) => updatePrice(item.product.id, Number(e.target.value))} className="OO-priceInput" /></td>
                          <td>{(item.unitPrice * item.quantity).toLocaleString('en-IQ')}</td>
                          <td><button className="OO-removeBtn" onClick={() => updateQty(item.product.id, 0)}><X size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="OO-cartSummary">
                    <div className="OO-discountRow">
                      <label>الخصم (د.ع):</label>
                      <input type="number" min={0} value={formDiscount} onChange={(e) => setFormDiscount(Number(e.target.value))} className="OO-discountInput" />
                    </div>
                    <div className="OO-totalRow">
                      {cartSubtotal.toLocaleString('en-IQ')}{formDiscount > 0 ? ` − ${formDiscount.toLocaleString('en-IQ')}` : ''} = <strong>{cartTotal.toLocaleString('en-IQ')} د.ع</strong>
                    </div>
                  </div>
                </div>
              )}
              {formError && <div className="OO-formError">{formError}</div>}
            </div>
            <div className="OO-modal-footer">
              <button className="OO-btn OO-btn--ghost" onClick={() => setShowForm(false)}>إلغاء</button>
              <button className="OO-btn OO-btn--confirm" disabled={submitting || cart.length === 0} onClick={handleSubmit}>
                {submitting ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} حفظ كطلب قيد الانتظار
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnlineOrdersPage;
