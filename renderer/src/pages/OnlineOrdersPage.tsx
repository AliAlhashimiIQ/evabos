import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  ShoppingBag, CheckCircle2, XCircle, Clock, Plus, Search,
  Loader2, Instagram, Phone, MessageCircle, Globe, Package,
  ChevronDown, ChevronUp, X, Printer, RefreshCw, Pause, Play, Filter,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { confirmDialog } from '../utils/confirmDialog';
import WaybillPrintModal from '../components/WaybillPrintModal';
import OnlineOrderWhatsAppModal from '../components/OnlineOrderWhatsAppModal';
import './OnlineOrdersPage.css';

type OnlineOrder = import('../types/electron').OnlineOrder;
type OnlineOrderStatus = import('../types/electron').OnlineOrderStatus;
type OnlineOrderSource = import('../types/electron').OnlineOrderSource;
type Product = import('../types/electron').Product;

const SOURCE_ICONS: Record<OnlineOrderSource, JSX.Element> = {
  instagram: <Instagram size={14} style={{ color: '#E1306C' }} />,
  tiktok: <Globe size={14} />,
  whatsapp: <MessageCircle size={14} style={{ color: '#25D366' }} />,
  phone: <Phone size={14} style={{ color: '#3b82f6' }} />,
  other: <Globe size={14} style={{ color: '#6366f1' }} />,
};
const SOURCE_LABELS: Record<OnlineOrderSource, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  phone: 'Phone',
  other: 'Other',
};
const STATUS_CFG: Record<OnlineOrderStatus, { label: string; cls: string; icon: JSX.Element }> = {
  pending:   { label: 'قيد الانتظار',   cls: 'OO-badge--pending',   icon: <Clock size={12} /> },
  confirmed: { label: 'مؤكد', cls: 'OO-badge--confirmed', icon: <CheckCircle2 size={12} /> },
  rejected:  { label: 'مرفوض',  cls: 'OO-badge--rejected',  icon: <XCircle size={12} /> },
};

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

interface CartItem { product: Product; quantity: number; unitPrice: number; }

const OnlineOrdersPage = (): JSX.Element => {
  const { token, user } = useAuth();
  const toast = useToast();
  const [allOrders, setAllOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OnlineOrderStatus | 'all'>('pending');
  const [sourceFilter, setSourceFilter] = useState<OnlineOrderSource | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
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
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  const [editOrderId, setEditOrderId] = useState<number | null>(null);

  // New Modals State
  const [printingOrder, setPrintingOrder] = useState<OnlineOrder | null>(null);
  const [whatsAppOrder, setWhatsAppOrder] = useState<OnlineOrder | null>(null);
  const [storeName, setStoreName] = useState('EVA POS');

  // Auto-refresh state
  const [isAutoRefreshPaused, setIsAutoRefreshPaused] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- Load all orders ---
  const loadOrders = useCallback(async (isSilent = false) => {
    if (!window.evaApi || !token) return;
    try {
      if (!isSilent) setLoading(true);
      setError(null);
      const result = await window.evaApi.onlineOrders.list(token);
      setAllOrders(result);
      setLastRefreshedAt(new Date());
      setSecondsAgo(0);
    } catch (err) {
      if (!isSilent) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    } finally {
      if (!isSilent) setLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Load store name for WhatsApp and Waybill
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.getSetting('receipt_store_name').then((val: string | null) => {
      if (val) setStoreName(val);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!window.evaApi) return;
    window.evaApi.exchangeRates.getCurrent().then((r: any) => {
      if (r.currentRate) setExchangeRate(r.currentRate.rate);
    });
  }, []);

  // --- Auto-Refresh Polling (20s interval with non-intrusive modal guard) ---
  useEffect(() => {
    if (isAutoRefreshPaused) return;

    const interval = setInterval(() => {
      // Guard: Do not poll or disrupt if user is actively filling or interacting with a modal
      if (showForm || editOrderId || printingOrder || whatsAppOrder) {
        return;
      }
      loadOrders(true);
    }, 20000);

    return () => clearInterval(interval);
  }, [isAutoRefreshPaused, showForm, editOrderId, printingOrder, whatsAppOrder, loadOrders]);

  // Timer for seconds since last refresh
  useEffect(() => {
    const timer = setInterval(() => {
      const diff = Math.floor((Date.now() - lastRefreshedAt.getTime()) / 1000);
      setSecondsAgo(diff);
    }, 1000);
    return () => clearInterval(timer);
  }, [lastRefreshedAt]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadOrders(false);
    toast.success('تم تحديث قائمة الطلبات');
  };

  // --- Multi-Field Search & Counts ---
  const counts = useMemo(() => ({
    all: allOrders.length,
    pending: allOrders.filter(o => o.status === 'pending').length,
    confirmed: allOrders.filter(o => o.status === 'confirmed').length,
    rejected: allOrders.filter(o => o.status === 'rejected').length,
  }), [allOrders]);

  const filteredOrders = useMemo(() => {
    let result = allOrders;

    // 1. Status Filter
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }

    // 2. Source Filter
    if (sourceFilter !== 'all') {
      result = result.filter(o => o.source === sourceFilter);
    }

    // 3. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const qCleanDigits = q.replace(/[^\d]/g, '');

      result = result.filter(o => {
        // Match Order ID
        const matchId = String(o.id) === q || `#${o.id}` === q;
        // Match Customer Name
        const matchName = o.customerName?.toLowerCase().includes(q);
        // Match Customer Phone
        const rawDigits = (o.customerPhone || '').replace(/[^\d]/g, '');
        const matchPhone = (qCleanDigits && rawDigits.includes(qCleanDigits)) || o.customerPhone?.toLowerCase().includes(q);
        // Match Note / Address
        const matchNote = o.note?.toLowerCase().includes(q);
        // Match Products in Order
        const matchItem = o.items.some(
          item =>
            item.productName.toLowerCase().includes(q) ||
            item.sku.toLowerCase().includes(q) ||
            (item.color && item.color.toLowerCase().includes(q)) ||
            (item.size && item.size.toLowerCase().includes(q))
        );

        return matchId || matchName || matchPhone || matchNote || matchItem;
      });
    }

    return result;
  }, [allOrders, statusFilter, sourceFilter, searchQuery]);

  // --- Products ---
  const loadProducts = useCallback(async () => {
    if (!window.evaApi || !token) return;
    const resp = await window.evaApi.products.list(token, { limit: 500, cursor: 0 });
    setProducts(resp.products || resp.items || []);
  }, [token]);

  useEffect(() => { if (showForm) loadProducts(); }, [showForm, loadProducts]);

  // --- Barcode Scanner ---
  const processProductSearch = useCallback((value: string) => {
    if (!showForm || !value.trim()) return;
    const val = value.trim();
    const valLower = val.toLowerCase();

    // Exact match (barcode or SKU)
    let variant = products.find(p => 
      (p.barcode && p.barcode.toLowerCase() === valLower) || 
      p.sku.toLowerCase() === valLower
    );
    // Prepend '0' (scanner fix)
    if (!variant) {
      const v0 = '0' + val;
      variant = products.find(p => p.barcode === v0 || p.sku === v0);
    }
    // Name search fallback — only if single result
    if (!variant) {
      const nameMatches = products.filter(p => 
        p.stockOnHand > 0 && p.productName.toLowerCase().includes(valLower)
      );
      if (nameMatches.length === 1) variant = nameMatches[0];
    }

    if (variant) {
      if (variant.stockOnHand <= 0) {
        setScannerMessage(`❌ "${variant.productName}" — نفذ المخزون`);
      } else {
        const existing = cart.find(i => i.product.id === variant!.id);
        if (existing && existing.quantity >= variant.stockOnHand) {
          setScannerMessage(`⚠️ "${variant.productName}" — الكمية القصوى (${variant.stockOnHand})`);
        } else {
          addToCart(variant);
          setScannerMessage(`✅ ${variant.productName}`);
        }
      }
    } else {
      setScannerMessage(`❌ لا يوجد تطابق: ${val}`);
    }

    setProductSearch('');
    setTimeout(() => setScannerMessage(null), 2500);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [products, cart, showForm]);

  useBarcodeScanner({ onScan: processProductSearch, threshold: 50, minLength: 3 });

  // --- Confirm Order ---
  const handleConfirm = async (orderId: number) => {
    if (!window.evaApi || !token) return;
    const ok = await confirmDialog({
      title: 'تأكيد الطلب',
      message: 'سيتم خصم المخزون وإنشاء عملية بيع جديدة. هل تريد المتابعة؟',
      confirmText: 'تأكيد',
      cancelText: 'إلغاء',
    });
    if (!ok) return;
    setActionLoading(orderId);
    try {
      const result = await window.evaApi.onlineOrders.confirm(token, orderId, exchangeRate);
      toast.success(`تم تأكيد الطلب #${orderId} — عملية بيع #${result.saleId}`);
      await loadOrders(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل التأكيد');
    } finally { setActionLoading(null); }
  };

  // --- Reject Order ---
  const handleReject = async (orderId: number) => {
    if (!window.evaApi || !token) return;
    setActionLoading(orderId);
    try {
      await window.evaApi.onlineOrders.reject(token, orderId, rejectReason || undefined);
      setRejectingId(null); setRejectReason('');
      toast.success(`تم رفض الطلب #${orderId}`);
      await loadOrders(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل الرفض');
    } finally { setActionLoading(null); }
  };

  // --- Cart Logic with Stock Validation ---
  const addToCart = (p: Product) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.product.id === p.id);
      if (ex) {
        if (ex.quantity >= p.stockOnHand) {
          toast.warning(`الكمية القصوى المتاحة: ${p.stockOnHand}`);
          return prev;
        }
        return prev.map((i) => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      if (p.stockOnHand <= 0) {
        toast.warning(`"${p.productName}" نفذ المخزون`);
        return prev;
      }
      return [...prev, { product: p, quantity: 1, unitPrice: p.salePriceIQD }];
    });
  };

  const updateQty = (id: number, q: number) => {
    if (q <= 0) setCart((prev) => prev.filter((i) => i.product.id !== id));
    else {
      setCart((prev) => prev.map((i) => {
        if (i.product.id !== id) return i;
        if (q > i.product.stockOnHand) {
          toast.warning(`الكمية القصوى: ${i.product.stockOnHand}`);
          return { ...i, quantity: i.product.stockOnHand };
        }
        return { ...i, quantity: q };
      }));
    }
  };

  const updatePrice = (id: number, price: number) =>
    setCart((prev) => prev.map((i) => i.product.id === id ? { ...i, unitPrice: price } : i));

  const cartSubtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const cartTotal = Math.max(cartSubtotal - formDiscount, 0);
  
  // Calculate Profit
  const cartCost = cart.reduce((s, i) => s + (i.product.avgCostUSD || 0) * exchangeRate * i.quantity, 0);
  const cartProfit = cartTotal - cartCost;

  // --- Submit ---
  const handleSubmit = async () => {
    if (!window.evaApi || !token || !user) return;
    if (cart.length === 0) { setFormError('أضف منتج واحد على الأقل'); return; }

    // Stock validation
    const overstock = cart.find(i => i.quantity > i.product.stockOnHand);
    if (overstock) {
      setFormError(`"${overstock.product.productName}" — الكمية (${overstock.quantity}) تتجاوز المخزون (${overstock.product.stockOnHand})`);
      return;
    }

    setSubmitting(true); setFormError(null);
    try {
      const payload = {
        branchId: user.branchId ?? 1,
        customerName: formCustomerName || null, customerPhone: formCustomerPhone || null,
        source: formSource, note: formNote || null,
        subtotalIQD: cartSubtotal, discountIQD: formDiscount, totalIQD: cartTotal,
        items: cart.map((i) => ({ variantId: i.product.id, quantity: i.quantity, unitPriceIQD: i.unitPrice, lineTotalIQD: i.unitPrice * i.quantity })),
      };

      if (editOrderId) {
        await window.evaApi.onlineOrders.update(token, editOrderId, payload);
        toast.success('تم تحديث الطلب بنجاح');
      } else {
        await window.evaApi.onlineOrders.create(token, payload);
        toast.success('تم إنشاء الطلب بنجاح');
      }
      
      setShowForm(false); setCart([]); setFormCustomerName(''); setFormCustomerPhone('');
      setFormNote(''); setFormDiscount(0); setProductSearch(''); setEditOrderId(null);
      await loadOrders(true);
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  const openEditForm = async (order: OnlineOrder) => {
    setEditOrderId(order.id);
    setFormCustomerName(order.customerName || '');
    setFormCustomerPhone(order.customerPhone || '');
    setFormNote(order.note || '');
    setFormSource(order.source);
    setFormDiscount(order.discountIQD || 0);

    // Map order.items to cart
    setCart(order.items.map(item => {
      const found = products.find(p => p.id === item.variantId);
      return {
        product: found || {
          id: item.variantId,
          productId: 0,
          sku: item.sku || '',
          productName: item.productName || 'Unknown Product',
          color: item.color || null,
          size: item.size || null,
          barcode: null,
          salePriceIQD: item.unitPriceIQD,
          stockOnHand: 9999,
          avgCostUSD: 0
        } as Product,
        quantity: item.quantity,
        unitPrice: item.unitPriceIQD
      };
    }));
    setShowForm(true);
  };

  const handleDelete = async (orderId: number) => {
    if (!window.evaApi || !token) return;
    const ok = await confirmDialog({
      title: 'حذف الطلب',
      message: 'هل أنت متأكد من حذف هذا الطلب نهائياً؟ لا يمكن التراجع عن هذه الخطوة.',
      confirmText: 'حذف',
      cancelText: 'إلغاء'
    });
    if (!ok) return;
    setActionLoading(orderId);
    try {
      await window.evaApi.onlineOrders.delete(token, orderId);
      toast.success('تم حذف الطلب بنجاح');
      await loadOrders(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل الحذف');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="Page OO">
      {/* Header with Title & Action Controls */}
      <div className="OO-header">
        <div>
          <h1><ShoppingBag size={26} style={{ verticalAlign: 'middle', marginInlineEnd: '0.5rem' }} />الطلبات أونلاين</h1>
          <p>إدارة طلبات إنستغرام، تيك توك، وواتساب — يتم خصم المخزون <strong>فقط عند التأكيد</strong></p>
        </div>
        <div className="OO-header-right">
          {/* Live Sync Status Bar */}
          <div className="OO-syncBar" title={isAutoRefreshPaused ? 'التحديث التلقائي متوقف مؤقتاً' : 'تحديث تلقائي كل 20 ثانية'}>
            <span className={`OO-syncPulse ${isAutoRefreshPaused ? 'paused' : 'live'}`} />
            <span className="OO-syncText">
              {isAutoRefreshPaused ? 'متوقف مؤقتاً' : `محدث (قبل ${secondsAgo} ث)`}
            </span>
            <button
              className="OO-syncBtn"
              onClick={() => setIsAutoRefreshPaused(!isAutoRefreshPaused)}
              title={isAutoRefreshPaused ? 'استئناف التحديث التلقائي' : 'إيقاف التحديث التلقائي مؤقتاً'}
            >
              {isAutoRefreshPaused ? <Play size={13} /> : <Pause size={13} />}
            </button>
            <button
              className="OO-syncBtn"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="تحديث القائمة الآن"
            >
              <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
            </button>
          </div>

          <button className="OO-newBtn" onClick={() => {
            setEditOrderId(null);
            setCart([]); setFormCustomerName(''); setFormCustomerPhone(''); setFormNote(''); setFormDiscount(0);
            setShowForm(true);
          }}><Plus size={18} /> طلب جديد أونلاين</button>
        </div>
      </div>

      {/* Filter & Live Search Toolbar */}
      <div className="OO-toolbar">
        {/* Status Tabs */}
        <div className="OO-tabs">
          {(['all', 'pending', 'confirmed', 'rejected'] as const).map((s) => (
            <button key={s} className={`OO-tab ${statusFilter === s ? 'OO-tab--active' : ''}`} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'الكل' : STATUS_CFG[s as OnlineOrderStatus].label}
              <span className="OO-tab-count">{counts[s]}</span>
            </button>
          ))}
        </div>

        {/* Live Multi-Field Search Bar */}
        <div className="OO-searchBarWrap">
          <div className="OO-searchIcon"><Search size={18} /></div>
          <input
            type="text"
            className="OO-searchInput"
            placeholder="بحث سريع برقم الطلب #، اسم العميل، الهاتف، أو المنتج…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="OO-searchClear" onClick={() => setSearchQuery('')}>
              <X size={15} />
            </button>
          )}
        </div>

        {/* Source Filter Select */}
        <div className="OO-sourceFilterWrap">
          <Filter size={15} className="OO-sourceFilterIcon" />
          <select
            className="OO-sourceFilterSelect"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as OnlineOrderSource | 'all')}
          >
            <option value="all">جميع المصادر</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Phone</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {loading && <div className="OO-loading"><Loader2 size={28} className="spin" /> جاري التحميل…</div>}
      {error && <div className="OO-error">{error}</div>}
      {!loading && filteredOrders.length === 0 && (
        <div className="OO-empty">
          <Package size={48} />
          <p>{searchQuery ? 'لا توجد نتائج تطابق بحثك' : 'لا توجد طلبات في هذا القسم'}</p>
          {searchQuery && (
            <button className="OO-btn OO-btn--ghost" onClick={() => setSearchQuery('')}>
              إلغاء تصفية البحث
            </button>
          )}
        </div>
      )}

      {/* Orders Cards List */}
      <div className="OO-list">
        {filteredOrders.map((order) => {
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
                  {order.customerPhone && (
                    <span className="OO-phone" dir="ltr">{order.customerPhone}</span>
                  )}
                </div>

                <div className="OO-card-right">
                  {/* Quick Card WhatsApp Action */}
                  {order.customerPhone && (
                    <button
                      className="OO-card-actionBtn OO-card-actionBtn--wa"
                      onClick={(e) => {
                        e.stopPropagation();
                        setWhatsAppOrder(order);
                      }}
                      title="مراسلة سريعة عبر واتساب"
                    >
                      <MessageCircle size={14} />
                      <span>واتساب</span>
                    </button>
                  )}

                  {/* Quick Card Waybill Print Action */}
                  <button
                    className="OO-card-actionBtn OO-card-actionBtn--waybill"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPrintingOrder(order);
                    }}
                    title="طباعة فاتورة شحن وتوصيل حرارية"
                  >
                    <Printer size={14} />
                    <span>فاتورة شحن</span>
                  </button>

                  <span className="OO-total">{order.totalIQD.toLocaleString('en-IQ')} IQD</span>
                  <span className="OO-date" dir="ltr">{formatEnglishDateTime(order.createdAt)}</span>
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

                  {/* Actions Area */}
                  <div className="OO-actions">
                    {/* Communication & Waybill always available */}
                    <button className="OO-btn OO-btn--waybill" onClick={() => setPrintingOrder(order)}>
                      <Printer size={15} /> فاتورة شحن
                    </button>

                    {order.customerPhone && (
                      <button className="OO-btn OO-btn--whatsapp" onClick={() => setWhatsAppOrder(order)}>
                        <MessageCircle size={15} /> مراسلة واتساب
                      </button>
                    )}

                    {order.status === 'pending' && (
                      rejectingId === order.id ? (
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
                            {actionLoading === order.id ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />} تأكيد البيع
                          </button>
                          <button className="OO-btn OO-btn--ghost" onClick={() => openEditForm(order)}>
                            تعديل
                          </button>
                          <button className="OO-btn OO-btn--reject" onClick={() => setRejectingId(order.id)}>
                            <XCircle size={14} /> رفض
                          </button>
                          <button className="OO-btn OO-btn--danger" onClick={() => handleDelete(order.id)} title="حذف نهائي">
                            <X size={14} />
                          </button>
                        </>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New / Edit Order Modal */}
      {showForm && (
        <div className="OO-overlay" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="OO-modal OO-modal--large">
            <div className="OO-modal-header">
              <h2>{editOrderId ? `تعديل طلب #${editOrderId}` : 'طلب جديد أونلاين'}</h2>
              <button className="OO-closeBtn" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            
            <div className="OO-modal-body OO-modal-split">
              {/* Right Side: Cart & Total */}
              <div className="OO-modal-split-cart">
                <div className="OO-formSection OO-cartSection">
                  <h3>عناصر الطلب ({cart.reduce((s, i) => s + i.quantity, 0)} منتج)</h3>
                  
                  {cart.length === 0 ? (
                    <div className="OO-emptyCart">
                      <Package size={48} />
                      <p>السلة فارغة</p>
                      <span>امسح منتجات لإضافتها للطلب</span>
                    </div>
                  ) : (
                    <>
                      <div className="OO-cartTableWrap">
                        <table className="OO-cartTable">
                          <thead><tr><th>المنتج</th><th>النوع</th><th>الكمية</th><th>سعر الوحدة</th><th>المجموع</th><th></th></tr></thead>
                          <tbody>
                            {cart.map((item) => (
                              <tr key={item.product.id}>
                                <td>
                                  <div className="OO-cartProductName">{item.product.productName}</div>
                                  <div className="OO-cartProductSku">{item.product.sku}</div>
                                </td>
                                <td className="OO-cartVariant">{[item.product.color, item.product.size].filter(Boolean).join(' / ') || '—'}</td>
                                <td>
                                  <div className="OO-qtyWrapper">
                                    <input
                                      type="number"
                                      min={1}
                                      max={item.product.stockOnHand}
                                      value={item.quantity}
                                      onChange={(e) => updateQty(item.product.id, Number(e.target.value))}
                                      className={`OO-qtyInput ${item.quantity > item.product.stockOnHand ? 'OO-qtyInput--exceeded' : ''}`}
                                    />
                                  </div>
                                </td>
                                <td>
                                  <input type="number" min={0} value={item.unitPrice} onChange={(e) => updatePrice(item.product.id, Number(e.target.value))} className="OO-priceInput" />
                                </td>
                                <td className="OO-cartLineTotal">{(item.unitPrice * item.quantity).toLocaleString('en-IQ')}</td>
                                <td>
                                  <button className="OO-removeBtn" onClick={() => updateQty(item.product.id, 0)} title="حذف">
                                    <X size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="OO-cartSummary">
                        <div className="OO-cartSummary-left">
                          <div className="OO-profitRow">
                            الربح المتوقع: <span className={cartProfit >= 0 ? 'OO-profit-positive' : 'OO-profit-negative'}>{cartProfit.toLocaleString('en-IQ')} د.ع</span>
                          </div>
                        </div>
                        <div className="OO-cartSummary-right">
                          <div className="OO-discountRow">
                            <label>الخصم:</label>
                            <input type="number" min={0} value={formDiscount} onChange={(e) => setFormDiscount(Number(e.target.value))} className="OO-discountInput" placeholder="0" />
                          </div>
                          <div className="OO-totalRow">
                            المجموع النهائي <strong>{cartTotal.toLocaleString('en-IQ')} د.ع</strong>
                            {formDiscount > 0 && <span className="OO-subtotalHint">({cartSubtotal.toLocaleString('en-IQ')} - خصم)</span>}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="OO-modal-actions">
                  <button className="OO-btn OO-btn--ghost" onClick={() => setShowForm(false)}>إلغاء</button>
                  <button className="OO-btn OO-btn--confirm OO-btn--block" disabled={submitting || cart.length === 0} onClick={handleSubmit}>
                    {submitting ? <Loader2 size={16} className="spin" /> : (editOrderId ? <CheckCircle2 size={16} /> : <Plus size={16} />)} 
                    {editOrderId ? 'حفظ التعديلات' : 'حفظ كطلب قيد الانتظار'}
                  </button>
                </div>
              </div>

              {/* Left Side: Adding & Customer */}
              <div className="OO-modal-split-form">
                <div className="OO-formSection">
                  <h3>إضافة منتجات</h3>

                  <div className="OO-scanBar">
                    <div className="OO-scanBar-icon"><Search size={20} /></div>
                    <input 
                      ref={searchInputRef}
                      placeholder="امسح الباركود أو اكتب رقم المنتج واضغط Enter…" 
                      value={productSearch} 
                      onChange={(e) => setProductSearch(e.target.value)}
                      autoFocus
                      data-barcode-input
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) processProductSearch(val);
                        }
                      }}
                    />
                    {productSearch && (
                      <button className="OO-scanBar-clear" onClick={() => { setProductSearch(''); searchInputRef.current?.focus(); }}>
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {scannerMessage && (
                    <div className={`OO-scannerFeedback ${scannerMessage.startsWith('✅') ? 'OO-scannerFeedback--success' : scannerMessage.startsWith('⚠️') ? 'OO-scannerFeedback--warning' : 'OO-scannerFeedback--error'}`}>
                      {scannerMessage}
                    </div>
                  )}

                  {!scannerMessage && (
                    <div className="OO-scanHint">
                      <Package size={32} />
                      <p>امسح الباركود للإضافة السريعة</p>
                      <span>سيتم تجميع الكميات تلقائياً</span>
                    </div>
                  )}
                </div>

                <div className="OO-formSection">
                  <h3>العميل والمصدر</h3>
                  <div className="OO-formCol">
                    <label>الاسم<input value={formCustomerName} onChange={(e) => setFormCustomerName(e.target.value)} placeholder="اسم العميل" /></label>
                    <label>الهاتف<input value={formCustomerPhone} onChange={(e) => setFormCustomerPhone(e.target.value)} placeholder="07xx-xxx-xxxx" /></label>
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

                {formError && <div className="OO-formError">{formError}</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Waybill Print Modal */}
      <WaybillPrintModal
        visible={!!printingOrder}
        order={printingOrder}
        onClose={() => setPrintingOrder(null)}
      />

      {/* WhatsApp Dispatch Modal */}
      <OnlineOrderWhatsAppModal
        visible={!!whatsAppOrder}
        order={whatsAppOrder}
        storeName={storeName}
        onClose={() => setWhatsAppOrder(null)}
      />
    </div>
  );
};

export default OnlineOrdersPage;
