import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Search,
  Loader2,
  Package,
  Trash2,
  RotateCcw,
  X,
  CheckCircle2,
  XCircle,
  DollarSign,
  Banknote,
  Plus,
  Minus
} from 'lucide-react';
import './Pages.css';
import './PosPage.css';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useShortcutKeys } from '../hooks/useShortcutKeys';
import PrintingModal from '../components/PrintingModal';
import NumberInput from '../components/NumberInput';
import CalculatorInput from '../components/CalculatorInput';
import { confirmDialog } from '../utils/confirmDialog';

type Product = import('../types/electron').Product;
type Customer = import('../types/electron').Customer;
type Sale = import('../types/electron').Sale;
type SaleInput = import('../types/electron').SaleInput;
type Employee = import('../types/electron').Employee;

interface CartItem {
  product: Product;
  quantity: number;
}

const PROFILE_COUNT = 4;

interface PosProfile {
  cart: CartItem[];
  selectedCustomerId: number | '';
  selectedEmployeeId: number | '';
  discountMode: 'amount' | 'percent' | 'finalPrice';
  discountValue: number;
  isManualDiscount: boolean; // New flag to track manual entry
  paymentMethod: 'cash' | 'card' | 'mixed';
  success: string | null;
  error: string | null;
  isSubmitting: boolean;
}

const createProfile = (): PosProfile => ({
  cart: [],
  selectedCustomerId: '',
  selectedEmployeeId: '',
  discountMode: 'finalPrice',
  discountValue: 0,
  isManualDiscount: false, // Initialize as false
  paymentMethod: 'cash',
  success: null,
  error: null,
  isSubmitting: false,
});

const PosPage = (): JSX.Element => {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [profiles, setProfiles] = useState<PosProfile[]>(() => {
    try {
      const saved = localStorage.getItem('pos_profiles');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load profiles from localStorage', e);
    }
    return Array.from({ length: PROFILE_COUNT }, createProfile);
  });
  const [activeProfileIndex, setActiveProfileIndex] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_active_profile_index');
      if (saved) {
        return parseInt(saved, 10);
      }
    } catch (e) {
      console.error('Failed to load active profile index', e);
    }
    return 0;
  });

  // Persist profiles to localStorage whenever they change
  useEffect(() => {
    try {
      // Don't persist transient states like success, error, or isSubmitting
      const profilesToSave = profiles.map(p => ({
        ...p,
        success: null,
        error: null,
        isSubmitting: false
      }));
      localStorage.setItem('pos_profiles', JSON.stringify(profilesToSave));
    } catch (e) {
      console.error('Failed to save profiles to localStorage', e);
    }
  }, [profiles]);

  // Persist active profile index
  useEffect(() => {
    try {
      localStorage.setItem('pos_active_profile_index', activeProfileIndex.toString());
    } catch (e) {
      console.error('Failed to save active profile index', e);
    }
  }, [activeProfileIndex]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [printSale, setPrintSale] = useState<Sale | null>(null);
  const [preferredPrinter, setPreferredPrinter] = useState<string | null>(null);
  const [, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(1500);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const updateProfileAtIndex = useCallback(
    (index: number, updater: (profile: PosProfile) => PosProfile) => {
      setProfiles((prev) => prev.map((profile, idx) => (idx === index ? updater(profile) : profile)));
    },
    [],
  );

  const updateCurrentProfile = useCallback(
    (updater: (profile: PosProfile) => PosProfile) => {
      updateProfileAtIndex(activeProfileIndex, updater);
    },
    [activeProfileIndex, updateProfileAtIndex],
  );

  const currentProfile = profiles[activeProfileIndex] ?? createProfile();
  const {
    cart,
    selectedCustomerId,
    selectedEmployeeId = '',
    discountMode,
    discountValue,
    isManualDiscount: _isManualDiscount,
    paymentMethod,
    success: profileSuccess,
    error: profileError,
    isSubmitting,
  } = currentProfile;

  const loadProducts = useCallback(async (reset = false) => {
    if (!window.evaApi || !token) {
      return;
    }
    try {
      const cursor = reset ? 0 : (nextCursor ?? 0);
      const productResponse = await window.evaApi.products.list(token, { limit: 100, cursor });

      // Handle both paginated and legacy responses
      const newProducts = productResponse.products || productResponse.items || [];
      const cursor_next = productResponse.nextCursor ?? null;
      const more = productResponse.hasMore ?? false;

      if (reset) {
        setProducts(newProducts);
      } else {
        setProducts(prev => [...prev, ...newProducts]);
      }

      setNextCursor(cursor_next);
      setHasMore(more);

      // Update products in all cart profiles to reflect new stock levels
      setProfiles((prevProfiles) =>
        prevProfiles.map((profile) => ({
          ...profile,
          cart: profile.cart.map((item) => {
            const updatedProduct = newProducts.find((p: Product) => p.id === item.product.id);
            return updatedProduct ? { ...item, product: updatedProduct } : item;
          }),
        })),
      );
    } catch (err) {
      console.error('Failed to refresh products:', err);
    }
  }, [token, nextCursor]);



  useEffect(() => {
    const loadData = async () => {
      if (!window.evaApi || !token) {
        setGlobalError(t('desktopBridgeUnavailable'));
        return;
      }
      try {
        setLoading(true);
        setGlobalError(null);

        // Load first 100 products with pagination
        const productResponse = await window.evaApi.products.list(token, { limit: 100, cursor: 0 });
        const newProducts = productResponse.products || productResponse.items || [];
        setProducts(newProducts);
        setNextCursor(productResponse.nextCursor ?? null);
        setHasMore(productResponse.hasMore ?? false);

        // Load customers, exchange rate, and employees
        const [customerResponse, rateResponse, employeeResponse] = await Promise.all([
          window.evaApi.customers.list(token),
          window.evaApi.exchangeRates.getCurrent(),
          window.evaApi.employees.list(token, false), // only active
        ]);

        setCustomers(customerResponse);
        setEmployees(employeeResponse || []);
        if (rateResponse.currentRate) {
          setExchangeRate(rateResponse.currentRate.rate);
        }
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : t('failedToLoadData'));
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      loadData();
    }
  }, [token]);

  // Periodic Inventory Refresh (every 30 seconds)
  // This prevents stale cart data if another cashier sells an item
  useEffect(() => {
    if (!token || !window.evaApi) return;
    
    const pollInventory = async () => {
      try {
        // Fetch enough products to cover what's currently loaded
        const limit = Math.max(100, products.length);
        const productResponse = await window.evaApi.products.list(token, { limit, cursor: 0 });
        const freshProducts = productResponse.products || productResponse.items || [];
        
        // Update product list without resetting pagination
        setProducts(prev => {
          const merged = [...prev];
          freshProducts.forEach((fp: Product) => {
            const idx = merged.findIndex((p: Product) => p.id === fp.id);
            if (idx !== -1) merged[idx] = fp;
          });
          return merged;
        });

        // Update cart items to reflect new stock levels
        setProfiles((prevProfiles) =>
          prevProfiles.map((profile) => ({
            ...profile,
            cart: profile.cart.map((item) => {
              const updatedProduct = freshProducts.find((p: Product) => p.id === item.product.id);
              // Only update if stock changed
              if (updatedProduct && updatedProduct.stockOnHand !== item.product.stockOnHand) {
                return { ...item, product: updatedProduct };
              }
              return item;
            }),
          })),
        );
      } catch (err) {
        console.error('Failed to poll inventory:', err);
      }
    };

    const interval = setInterval(pollInventory, 30000); // 30s
    return () => clearInterval(interval);
  }, [token, products.length]);



  const subtotalIQD = useMemo(
    () =>
      cart.reduce((acc, item) => acc + item.product.salePriceIQD * item.quantity, 0),
    [cart],
  );

  // Auto-update discountValue to subtotal when in finalPrice mode and cart changes
  useEffect(() => {
    if (discountMode === 'finalPrice') {
      updateCurrentProfile((profile) => {
        // If user hasn't manually set a price, keep it in sync with subtotal
        if (!profile.isManualDiscount) {
          return {
            ...profile,
            discountValue: subtotalIQD,
          };
        }
        return profile;
      });
    }
  }, [subtotalIQD, discountMode, updateCurrentProfile]);

  const discountIQD = useMemo(
    () => {
      if (discountMode === 'amount') {
        return Math.min(discountValue, subtotalIQD);
      } else if (discountMode === 'percent') {
        return Math.min((subtotalIQD * discountValue) / 100, subtotalIQD);
      } else if (discountMode === 'finalPrice') {
        // Final price mode: discount = subtotal - finalPrice
        const finalPrice = Math.max(0, Math.min(discountValue, subtotalIQD));
        return Math.max(0, subtotalIQD - finalPrice);
      }
      return 0;
    },
    [discountMode, discountValue, subtotalIQD],
  );

  const totalIQD = useMemo(() => Math.max(subtotalIQD - discountIQD, 0), [subtotalIQD, discountIQD]);

  const totalCostIQD = useMemo(() => {
    return cart.reduce(
      (acc, item) => acc + item.product.purchaseCostUSD * exchangeRate * item.quantity,
      0,
    );
  }, [cart, exchangeRate]);

  const profitIQD = useMemo(() => {
    return Math.max(totalIQD - totalCostIQD, 0);
  }, [totalCostIQD, totalIQD]);

  const profitPercent = useMemo(() => {
    return totalIQD > 0 ? ((profitIQD / totalIQD) * 100).toFixed(1) : '0.0';
  }, [profitIQD, totalIQD]);

  const profitMultiplier = useMemo(() => {
    return totalCostIQD > 0 ? (totalIQD / totalCostIQD).toFixed(2) : '0.00';
  }, [totalCostIQD, totalIQD]);

  const addToCart = useCallback(
    (product: Product) => {
      // Check if product is out of stock
      if (product.stockOnHand <= 0) {
        updateCurrentProfile((profile) => ({
          ...profile,
          error: `"${product.productName}" ${t('outOfStock')}`,
          success: null,
        }));
        return;
      }

      updateCurrentProfile((profile) => {
        const existing = profile.cart.find((item) => item.product.id === product.id);

        if (existing) {
          // Check if adding one more would exceed available stock
          const newQuantity = existing.quantity + 1;
          if (newQuantity > product.stockOnHand) {
            return {
              ...profile,
              error: t('onlyXAvailable', { count: String(product.stockOnHand), item: product.stockOnHand === 1 ? t('item') : t('items'), name: product.productName }),
              success: null,
            };
          }

          const nextCart = profile.cart.map((item) =>
            item.product.id === product.id ? { ...item, quantity: newQuantity } : item,
          );
          return { ...profile, cart: nextCart, error: null, success: null };
        } else {
          // Adding new item to cart
          const nextCart = [...profile.cart, { product, quantity: 1 }];
          return { ...profile, cart: nextCart, error: null, success: null };
        }
      });
    },
    [updateCurrentProfile],
  );

  const removeLastItem = useCallback(() => {
    updateCurrentProfile((profile) => ({
      ...profile,
      cart: profile.cart.slice(0, -1),
      error: null,
      success: null,
    }));
  }, [updateCurrentProfile]);

  const updateQuantity = (productId: number, delta: number) => {
    updateCurrentProfile((profile) => {
      const cartItem = profile.cart.find((item) => item.product.id === productId);
      if (!cartItem) {
        return profile;
      }

      const newQuantity = cartItem.quantity + delta;

      // Check if trying to increase beyond available stock
      if (delta > 0 && newQuantity > cartItem.product.stockOnHand) {
        return {
          ...profile,
          error: t('onlyXAvailable', { count: String(cartItem.product.stockOnHand), item: cartItem.product.stockOnHand === 1 ? t('item') : t('items'), name: cartItem.product.productName }),
          success: null,
        };
      }

      // Check if product is out of stock and trying to add
      if (delta > 0 && cartItem.product.stockOnHand <= 0) {
        return {
          ...profile,
          error: `"${cartItem.product.productName}" ${t('outOfStockCannotAdd')}`,
          success: null,
        };
      }

      const updatedCart = profile.cart
        .map((item) =>
          item.product.id === productId ? { ...item, quantity: Math.max(newQuantity, 1) } : item,
        )
        .filter((item) => item.quantity > 0);

      return {
        ...profile,
        cart: updatedCart,
        error: null,
        success: null,
      };
    });
  };

  const removeItem = (productId: number) => {
    updateCurrentProfile((profile) => ({
      ...profile,
      cart: profile.cart.filter((item) => item.product.id !== productId),
      error: null,
      success: null,
    }));
  };

  const handleCompleteSale = useCallback(
    async (profileIndex = activeProfileIndex) => {
      const targetProfile = profiles[profileIndex];
      if (!targetProfile) {
        return;
      }
      const {
        cart: targetCart,
        selectedCustomerId: targetCustomerId,
        paymentMethod: targetPaymentMethod,
        discountMode: targetDiscountMode,
        discountValue: targetDiscountValue,
      } = targetProfile;

      if (!window.evaApi) {
        setGlobalError(t('desktopBridgeUnavailable'));
        return;
      }
      if (!token) {
        setGlobalError('Authentication token missing.');
        return;
      }
      if (targetCart.length === 0) {
        updateProfileAtIndex(profileIndex, (profile) => ({
          ...profile,
          error: t('addAtLeastOne'),
          success: null,
        }));
        return;
      }
      if (!targetProfile.selectedEmployeeId) {
        updateProfileAtIndex(profileIndex, (profile) => ({
          ...profile,
          error: t('pleaseSelectEmployee'),
          success: null,
        }));
        return;
      }

      // Final stock validation before completing sale - check against latest product data
      const outOfStockItems: Array<{ item: CartItem; currentStock: number }> = [];
      const overStockItems: Array<{ item: CartItem; currentStock: number }> = [];

      for (const cartItem of targetCart) {
        const currentProduct = products.find((p) => p.id === cartItem.product.id);
        if (!currentProduct) {
          // Product no longer exists
          outOfStockItems.push({ item: cartItem, currentStock: 0 });
          continue;
        }

        if (currentProduct.stockOnHand <= 0) {
          outOfStockItems.push({ item: cartItem, currentStock: currentProduct.stockOnHand });
        } else if (cartItem.quantity > currentProduct.stockOnHand) {
          overStockItems.push({ item: cartItem, currentStock: currentProduct.stockOnHand });
        }
      }

      if (outOfStockItems.length > 0) {
        const itemNames = outOfStockItems.map(({ item }) => item.product.productName).join(', ');
        updateProfileAtIndex(profileIndex, (profile) => ({
          ...profile,
          error: t('cannotCompleteOutOfStock', { items: itemNames }),
          success: null,
        }));
        return;
      }

      if (overStockItems.length > 0) {
        const itemDetails = overStockItems
          .map(({ item, currentStock }) => `"${item.product.productName}" (only ${currentStock} available, ${item.quantity} requested)`)
          .join(', ');
        updateProfileAtIndex(profileIndex, (profile) => ({
          ...profile,
          error: t('cannotCompleteQuantity', { details: itemDetails }),
          success: null,
        }));
        return;
      }

      const subtotal = targetCart.reduce((acc, item) => acc + item.product.salePriceIQD * item.quantity, 0);
      const discount =
        targetDiscountMode === 'amount'
          ? Math.min(targetDiscountValue, subtotal)
          : targetDiscountMode === 'percent'
            ? Math.min((subtotal * targetDiscountValue) / 100, subtotal)
            : targetDiscountMode === 'finalPrice'
              ? Math.max(0, subtotal - Math.max(0, Math.min(targetDiscountValue, subtotal)))
              : 0;
      const total = Math.max(subtotal - discount, 0);

      // NaN/Infinity guard — block sale if financial values are corrupt
      if (!isFinite(subtotal) || !isFinite(discount) || !isFinite(total) || total < 0) {
        updateProfileAtIndex(profileIndex, (profile) => ({
          ...profile,
          error: 'Invalid calculation detected. Please check prices and discount.',
          success: null,
        }));
        return;
      }

      try {
        updateProfileAtIndex(profileIndex, (profile) => ({
          ...profile,
          isSubmitting: true,
          error: null,
          success: null,
        }));
        const sale: SaleInput = {
          branchId: user?.branchId ?? 1,
          cashierId: user?.userId ?? 1,
          customerId: targetCustomerId ? Number(targetCustomerId) : null,
          employeeId: targetProfile.selectedEmployeeId ? Number(targetProfile.selectedEmployeeId) : null,
          saleDate: new Date().toISOString(),
          subtotalIQD: subtotal,
          discountIQD: discount,
          totalIQD: total,
          paymentMethod: targetPaymentMethod,
          items: targetCart.map((item) => ({
            variantId: item.product.id,
            quantity: item.quantity,
            unitPriceIQD: item.product.salePriceIQD,
            unitCostIQDAtSale: item.product.purchaseCostUSD * exchangeRate,
            lineTotalIQD: item.product.salePriceIQD * item.quantity,
          })),
        };

        const created = await window.evaApi.sales.create(token, sale);
        setPrintSale(created);

        // Refresh products to update stock levels
        await loadProducts();

        updateProfileAtIndex(profileIndex, (profile) => ({
          ...profile,
          cart: [],
          discountValue: 0,
          isManualDiscount: false, // Reset manual flag
          paymentMethod: 'cash',
          selectedCustomerId: '',
          selectedEmployeeId: '',
          success: t('saleCompleted'),
          error: null,
          isSubmitting: false,
        }));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : t('failedToCompleteSale');
        updateProfileAtIndex(profileIndex, (profile) => ({
          ...profile,
          error: errorMessage,
          success: null,
          isSubmitting: false,
        }));
        setGlobalError(errorMessage);
      }
    },
    [activeProfileIndex, exchangeRate, profiles, products, token, updateProfileAtIndex, user, loadProducts],
  );

  const isScanningRef = useRef(false);

  const handleScan = useCallback(
    async (value: string) => {
      // Clear search term in case anything got typed
      setSearchTerm('');
      if (searchInputRef.current) {
        searchInputRef.current.value = '';
      }

      if (!window.evaApi || !token) return;

      // Prevent double scanning (debounce)
      if (isScanningRef.current) return;

      // Lock scanning
      isScanningRef.current = true;

      // Try exact match first (barcode or SKU)
      let variant = products.find((p) => p.barcode === value || p.sku === value);

      // If no exact match, try case-insensitive
      if (!variant) {
        variant = products.find(
          (p) =>
            p.barcode?.toLowerCase() === value.toLowerCase() ||
            p.sku.toLowerCase() === value.toLowerCase(),
        );
      }

      // If still no match, try prepending a '0' (fix for scanners stripping leading zero)
      if (!variant) {
        const valueWithZero = '0' + value;
        variant = products.find((p) => p.barcode === valueWithZero || p.sku === valueWithZero);
      }

      // If still not found in memory (e.g. it is an older product not in the first 100 pages), query the database
      if (!variant) {
        try {
          const response = await window.evaApi.products.list(token, { search: value, limit: 10 });
          const items = response.products || response.items || [];
          
          variant = items.find((p: Product) => p.barcode === value || p.sku === value);
          if (!variant) {
            variant = items.find(
              (p: Product) =>
                p.barcode?.toLowerCase() === value.toLowerCase() ||
                p.sku.toLowerCase() === value.toLowerCase(),
            );
          }
          if (!variant) {
            const valueWithZero = '0' + value;
            variant = items.find((p: Product) => p.barcode === valueWithZero || p.sku === valueWithZero);
          }

          if (variant) {
            const matched = variant;
            setProducts((prev) => {
              if (prev.some((p) => p.id === matched.id)) return prev;
              return [...prev, matched];
            });
          }
        } catch (err) {
          console.error('Failed to query scanned product from database:', err);
        }
      }

      if (variant) {
        // Check stock before adding
        if (variant.stockOnHand <= 0) {
          setScannerMessage(`"${variant.productName}" ${t('outOfStock')}`);
        } else {
          addToCart(variant);
          setScannerMessage(`${t('added')} ${variant.productName}`);
        }
      } else {
        setScannerMessage(`${t('noMatchFor')} ${value}`);
      }

      // Keep the timeout as a backup for React render cycles
      setTimeout(() => {
        setScannerMessage(null);
        setSearchTerm('');
        if (searchInputRef.current) {
          searchInputRef.current.value = '';
        }
        // Release lock after 500ms (ignoring any secondary Enters)
        isScanningRef.current = false;
      }, 500);
    },
    [products, addToCart, isSubmitting, setSearchTerm, token, t],
  );

  useBarcodeScanner({ onScan: handleScan });

  const shortcutMap = useMemo(
    () => ({
      F1: () => navigate('/pos'),
      F2: () => navigate('/products'),
      F3: () => navigate('/customers'),
      F4: () => navigate('/reports'),
      'Control+Enter': () => {
        if (!isSubmitting && cart.length > 0) {
          handleCompleteSale();
        }
      },
      Delete: removeLastItem,
    }),
    [navigate, handleCompleteSale, isSubmitting, removeLastItem, cart.length],
  );

  useShortcutKeys(shortcutMap);

  return (
    <div className="Pos">
      <div className="Pos-layout">

        {/* ── LEFT: Cart Panel ─────────────────────── */}
        <section className="Pos-left">

          {/* Search Bar */}
          <div className="Pos-search">
            <Search size={18} className="Pos-searchIcon" />
            <input
              type="text"
              placeholder={t('scanBarcode')}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  const currentValue = searchInputRef.current?.value || searchTerm;
                  const trimmedValue = currentValue.trim();
                  if (trimmedValue.length === 0) return;
                  if (trimmedValue.length >= 3) {
                    setSearchTerm('');
                    if (searchInputRef.current) searchInputRef.current.value = '';
                    handleScan(trimmedValue);
                  } else {
                    setScannerMessage(t('pleaseEnterBarcode'));
                    setTimeout(() => setScannerMessage(null), 2000);
                  }
                }
              }}
              ref={searchInputRef}
              autoComplete="off"
              data-barcode-input="true"
            />
            <button
              className="Pos-searchButton"
              onClick={() => {
                const currentValue = searchInputRef.current?.value || searchTerm;
                if (currentValue.trim().length >= 3) {
                  handleScan(currentValue.trim());
                } else {
                  setScannerMessage(t('pleaseEnterBarcode'));
                  setTimeout(() => setScannerMessage(null), 2000);
                }
              }}
              title={t('scan')}
            >
              {t('scan')}
            </button>
          </div>

          {scannerMessage && <div className="Pos-scannerMessage">{scannerMessage}</div>}

          {/* Profile Tabs */}
          <div className="Pos-profileTabs">
            <div className="Pos-profileTabs-label">
              <strong>{t('posTabs')}</strong>
              <span>{t('holdUpToCustomers', { count: String(PROFILE_COUNT) })}</span>
            </div>
            <div className="Pos-profileTabs-buttons">
              {profiles.map((profile, index) => (
                <button
                  key={index}
                  type="button"
                  className={`Pos-profileTab ${index === activeProfileIndex ? 'active' : ''} ${profile.cart.length > 0 ? 'filled' : ''}`}
                  onClick={() => setActiveProfileIndex(index)}
                  title={
                    profile.cart.length > 0
                      ? `${profile.cart.length} ${profile.cart.length === 1 ? t('item') : t('items')} ${t('inCart')}`
                      : t('emptyTab')
                  }
                >
                  <span>{t('tab')} {index + 1}</span>
                  {profile.cart.length > 0 ? (
                    <small>{profile.cart.length} {profile.cart.length === 1 ? t('item') : t('items')}</small>
                  ) : (
                    <small>{t('empty')}</small>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Alerts */}
          {globalError && <div className="Pos-alert Pos-alert--error"><XCircle size={16} /> {globalError}</div>}
          {profileError && <div className="Pos-alert Pos-alert--error"><XCircle size={16} /> {profileError}</div>}
          {profileSuccess && <div className="Pos-alert Pos-alert--success"><CheckCircle2 size={16} /> {profileSuccess}</div>}

          {/* Cart Header */}
          <div className="Pos-cartHeader">
            <div className="Pos-cartHeaderTitle">
              <span className="Pos-cartTitle">{t('cart')}</span>
              {cart.length > 0 && (
                <span className="Pos-cartBadge">{cart.length}</span>
              )}
            </div>
            <div className="Pos-cartHeaderActions">
              {cart.length > 0 && (
                <button
                  className="Pos-clearButton"
                  onClick={async () => {
                    if (await confirmDialog(t('clearAllItems'))) {
                      updateCurrentProfile((profile) => ({
                        ...profile,
                        cart: [],
                        discountValue: 0,
                        isManualDiscount: false,
                        success: null,
                        error: null,
                      }));
                    }
                  }}
                  title={t('clearCart')}
                >
                  <Trash2 size={14} /> {t('clear')}
                </button>
              )}
              <button className="Pos-returnsButton" onClick={() => navigate('/returns')} title={t('processReturns')}>
                <RotateCcw size={14} /> {t('returns')}
              </button>
            </div>
          </div>

          {/* Cart Table */}
          <div className="Pos-cartTableWrapper">
            {cart.length === 0 ? (
              <div className="Pos-empty">
                <Package size={40} />
                <p>{t('noItemsInCart')}</p>
              </div>
            ) : (
              <table className="Pos-cartTable">
                <thead>
                  <tr>
                    <th>{t('itemHeader')}</th>
                    <th>{t('qty')}</th>
                    <th>{t('unitPrice')}</th>
                    <th>{t('lineTotal')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.product.id}>
                      <td>
                        <div className="Pos-cartItem">
                          <span className="Pos-cartItemName">{item.product.productName}</span>
                          {(item.product.color || item.product.size) && (
                            <span className="Pos-cartItemVariant">
                              {[item.product.color, item.product.size].filter(Boolean).join(' / ')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="Pos-qtyControls">
                          <button onClick={() => updateQuantity(item.product.id, -1)}><Minus size={12} /></button>
                          <span>{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.product.id, 1)}><Plus size={12} /></button>
                        </div>
                      </td>
                      <td className="Pos-priceCell">{item.product.salePriceIQD.toLocaleString('en-IQ')}</td>
                      <td className="Pos-lineTotal">{(item.product.salePriceIQD * item.quantity).toLocaleString('en-IQ')}</td>
                      <td>
                        <button className="Pos-deleteButton" onClick={() => removeItem(item.product.id)} title={t('removeItem')}>
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </section>

        {/* ── RIGHT: Checkout Sidebar ───────────────── */}
        <aside className="Pos-sidebar">

          {/* Customer */}
          <div className="Pos-field">
            <label className="Pos-fieldLabel">{t('customer')}</label>
            <div className="Pos-customerSearch">
              <input
                type="text"
                placeholder={t('searchCustomer') || 'Search by name or phone...'}
                value={customerSearchTerm}
                onChange={(e) => {
                  setCustomerSearchTerm(e.target.value);
                  setShowCustomerDropdown(true);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
              />
              {selectedCustomerId && (
                <button
                  type="button"
                  className="Pos-clearCustomer"
                  onClick={() => {
                    updateCurrentProfile((profile) => ({
                      ...profile,
                      selectedCustomerId: '',
                    }));
                    setCustomerSearchTerm('');
                  }}
                  title={t('clear')}
                >
                  <X size={12} />
                </button>
              )}
              {showCustomerDropdown && (
                <div className="Pos-customerDropdown">
                  <div
                    className={`Pos-customerOption ${selectedCustomerId === '' ? 'selected' : ''}`}
                    onMouseDown={() => {
                      updateCurrentProfile((profile) => ({
                        ...profile,
                        selectedCustomerId: '',
                      }));
                      setCustomerSearchTerm('');
                      setShowCustomerDropdown(false);
                    }}
                  >
                    {t('walkIn')}
                  </div>
                  {customers
                    .filter((c) => {
                      const search = customerSearchTerm.toLowerCase();
                      return (
                        c.name.toLowerCase().includes(search) ||
                        (c.phone && c.phone.includes(search))
                      );
                    })
                    .slice(0, 10)
                    .map((customer) => (
                      <div
                        key={customer.id}
                        className={`Pos-customerOption ${selectedCustomerId === customer.id ? 'selected' : ''}`}
                        onMouseDown={() => {
                          updateCurrentProfile((profile) => ({
                            ...profile,
                            selectedCustomerId: customer.id,
                          }));
                          setCustomerSearchTerm(customer.name);
                          setShowCustomerDropdown(false);
                        }}
                      >
                        <span className="Pos-customerName">{customer.name}</span>
                        {customer.phone && <span className="Pos-customerPhone">{customer.phone}</span>}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Employee + Payment row */}
          <div className="Pos-fieldRow">
            <div className="Pos-field">
              <label 
                className="Pos-fieldLabel" 
                style={{ color: !selectedEmployeeId && profileError === t('pleaseSelectEmployee') ? '#ef4444' : undefined }}
              >
                {t('employee')} {!selectedEmployeeId && profileError === t('pleaseSelectEmployee') && '*'}
              </label>
              <select
                value={selectedEmployeeId}
                style={{
                  border: !selectedEmployeeId && profileError === t('pleaseSelectEmployee') ? '1px solid #ef4444' : undefined,
                  boxShadow: !selectedEmployeeId && profileError === t('pleaseSelectEmployee') ? '0 0 0 2px rgba(239, 68, 68, 0.1)' : undefined,
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onChange={(event) =>
                  updateCurrentProfile((profile) => ({
                    ...profile,
                    selectedEmployeeId: event.target.value ? Number(event.target.value) : '',
                    error: profile.error === t('pleaseSelectEmployee') ? null : profile.error,
                  }))
                }
              >
                <option value="">{t('selectEmployee')}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div className="Pos-field">
              <label className="Pos-fieldLabel">{t('paymentMethod')}</label>
              <select
                value={paymentMethod}
                onChange={(event) =>
                  updateCurrentProfile((profile) => ({
                    ...profile,
                    paymentMethod: event.target.value as 'cash' | 'card' | 'mixed',
                  }))
                }
              >
                <option value="cash">{t('cash')}</option>
                <option value="card">{t('card')}</option>
                <option value="mixed">{t('mixed')}</option>
              </select>
            </div>
          </div>

          {/* Discount */}
          <div className="Pos-field">
            <label className="Pos-fieldLabel">{t('discount')}</label>
            <div className="Pos-discountModes">
              <button
                type="button"
                className={discountMode === 'finalPrice' ? 'active' : ''}
                onClick={() =>
                  updateCurrentProfile((profile) => ({
                    ...profile,
                    discountMode: 'finalPrice',
                    discountValue: subtotalIQD,
                    isManualDiscount: false,
                  }))
                }
              >
                <DollarSign size={13} /> {t('finalPrice') || 'Final'}
              </button>
              <button
                type="button"
                className={discountMode === 'percent' ? 'active' : ''}
                onClick={() =>
                  updateCurrentProfile((profile) => ({
                    ...profile,
                    discountMode: 'percent',
                    discountValue: 0,
                    isManualDiscount: false,
                  }))
                }
              >
                % {t('percent')}
              </button>
              <button
                type="button"
                className={discountMode === 'amount' ? 'active' : ''}
                onClick={() =>
                  updateCurrentProfile((profile) => ({
                    ...profile,
                    discountMode: 'amount',
                    discountValue: 0,
                    isManualDiscount: false,
                  }))
                }
              >
                <Banknote size={13} /> {t('amount')}
              </button>
            </div>
            <div className="Pos-discountInput">
              {discountMode === 'finalPrice' ? (
                <CalculatorInput
                  min={0}
                  max={subtotalIQD}
                  value={discountValue}
                  onChange={(value) =>
                    updateCurrentProfile((profile) => ({
                      ...profile,
                      discountValue: value,
                      isManualDiscount: true,
                    }))
                  }
                  placeholder={t('enterFinalPrice') || 'e.g. 40+50+45'}
                />
              ) : (
                <NumberInput
                  min="0"
                  max={discountMode === 'percent' ? 100 : undefined}
                  value={discountValue}
                  onChange={(event) =>
                    updateCurrentProfile((profile) => ({
                      ...profile,
                      discountValue: Number(event.target.value) || 0,
                      isManualDiscount: true,
                    }))
                  }
                  placeholder={discountMode === 'percent' ? '0-100' : t('amount')}
                />
              )}
              {discountValue > 0 && (
                <button
                  className="Pos-clearDiscount"
                  onClick={() =>
                    updateCurrentProfile((profile) => ({
                      ...profile,
                      discountValue: profile.discountMode === 'finalPrice' ? subtotalIQD : 0,
                      isManualDiscount: false,
                    }))
                  }
                  title={t('clearDiscount')}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="Pos-divider" />

          {/* Summary */}
          <div className="Pos-summary">
            <div className="Pos-summaryRow">
              <span>{t('subtotal')}</span>
              <span>{subtotalIQD.toLocaleString('en-IQ')} IQD</span>
            </div>
            {discountIQD > 0 && (
              <div className="Pos-summaryRow Pos-discountRow">
                <span>
                  {t('discount')} (
                  {discountMode === 'percent'
                    ? `${discountValue}%`
                    : discountMode === 'finalPrice'
                      ? `${subtotalIQD > 0 ? ((discountIQD / subtotalIQD) * 100).toFixed(1) : 0}%`
                      : t('amount')}
                  )
                </span>
                <span>−{discountIQD.toLocaleString('en-IQ')} IQD</span>
              </div>
            )}
            <div className="Pos-summaryTotal">
              <span>{t('total')}</span>
              <strong>{totalIQD.toLocaleString('en-IQ')} IQD</strong>
            </div>
            {user?.role === 'admin' && (
              <>
                <div className="Pos-summaryRow Pos-profitRow">
                  <span><DollarSign size={13} /> {t('estimatedProfit')}</span>
                  <span>{profitIQD.toLocaleString('en-IQ')} IQD</span>
                </div>
                <div className="Pos-summaryRow" style={{ fontSize: '0.8rem', marginTop: '0.1rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('profitStats') || 'Margin / Multiplier'}</span>
                  <strong style={{ color: '#10b981', fontWeight: '700' }}>{profitPercent}% ({profitMultiplier}x)</strong>
                </div>
              </>
            )}
          </div>

          {/* Complete Button */}
          <button
            className="Pos-completeButton"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isSubmitting && cart.length > 0) {
                handleCompleteSale();
              }
            }}
            disabled={isSubmitting || cart.length === 0}
            title={cart.length === 0 ? t('addItemsFirst') : t('completeSaleEnter')}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} className="spin" /> {t('processing')}
              </>
            ) : (
              <>
                <CheckCircle2 size={20} /> {t('completeSale')} ({totalIQD.toLocaleString('en-IQ')} IQD)
              </>
            )}
          </button>

        </aside>
      </div>

      <PrintingModal
        visible={!!printSale}
        sale={printSale ?? undefined}
        printerName={preferredPrinter}
        onPrinterChange={setPreferredPrinter}
        onClose={() => setPrintSale(null)}
        autoPrint={true}
      />
    </div>
  );
};

export default PosPage;
