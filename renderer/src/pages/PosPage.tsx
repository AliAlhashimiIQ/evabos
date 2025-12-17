import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import './Pages.css';
import './PosPage.css';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useShortcutKeys } from '../hooks/useShortcutKeys';
import PrintingModal from '../components/PrintingModal';
import NumberInput from '../components/NumberInput';
import { confirmDialog } from '../utils/confirmDialog';

type Product = import('../types/electron').Product;
type Customer = import('../types/electron').Customer;
type Sale = import('../types/electron').Sale;
type SaleInput = import('../types/electron').SaleInput;

interface CartItem {
  product: Product;
  quantity: number;
}

const PROFILE_COUNT = 4;

interface PosProfile {
  cart: CartItem[];
  selectedCustomerId: number | '';
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
            const updatedProduct = newProducts.find((p) => p.id === item.product.id);
            return updatedProduct ? { ...item, product: updatedProduct } : item;
          }),
        })),
      );
    } catch (err) {
      console.error('Failed to refresh products:', err);
    }
  }, [token, nextCursor]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    await loadProducts(false);
    setIsLoadingMore(false);
  }, [hasMore, isLoadingMore, loadProducts]);

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

        // Load customers and exchange rate
        const [customerResponse, rateResponse] = await Promise.all([
          window.evaApi.customers.list(token),
          window.evaApi.exchangeRates.getCurrent(),
        ]);

        setCustomers(customerResponse);
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

  const profitIQD = useMemo(() => {
    const totalCost = cart.reduce(
      (acc, item) => acc + item.product.purchaseCostUSD * exchangeRate * item.quantity,
      0,
    );
    // Profit = Total Sale Price After Discount - Total Cost
    return Math.max(totalIQD - totalCost, 0);
  }, [cart, exchangeRate, totalIQD]);

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
    (value: string) => {
      // Clear search term in case anything got typed
      setSearchTerm('');
      if (searchInputRef.current) {
        searchInputRef.current.value = '';
      }

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

      if (variant) {
        // Check stock before adding
        if (variant.stockOnHand <= 0) {
          setScannerMessage(`❌ "${variant.productName}" ${t('outOfStock')}`);
        } else {
          addToCart(variant);
          setScannerMessage(`✅ ${t('added')} ${variant.productName}`);
        }
      } else {
        setScannerMessage(`❌ ${t('noMatchFor')} ${value}`);
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
    [products, addToCart, isSubmitting, setSearchTerm],
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
      <section className="Pos-cartPanel">
        <div className="Pos-search">
          <input
            type="text"
            placeholder={t('scanBarcode')}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={(e) => {
              // If Enter is pressed, try to scan
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation(); // Prevent shortcut handler from firing

                // Use ref value to avoid React state update lag with fast scanners
                const currentValue = searchInputRef.current?.value || searchTerm;
                const trimmedValue = currentValue.trim();

                if (trimmedValue.length === 0) {
                  // Ignore empty Enter presses (fixes scanners that send a leading Enter)
                  return;
                }

                if (trimmedValue.length >= 3) { // Reduced min length to 3 to allow shorter codes
                  // AGGRESSIVELY clear input here too
                  setSearchTerm('');
                  if (searchInputRef.current) searchInputRef.current.value = '';

                  handleScan(trimmedValue);
                } else {
                  setScannerMessage(`❌ ${t('pleaseEnterBarcode')}`);
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
                setScannerMessage(`❌ ${t('pleaseEnterBarcode')}`);
                setTimeout(() => setScannerMessage(null), 2000);
              }
            }}
            title={t('scan')}
          >
            🔍 {t('scan')}
          </button>
        </div>
        {scannerMessage && <div className="Pos-scannerMessage">{scannerMessage}</div>}

        {/* Load More button for pagination */}
        {hasMore && (
          <div style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '2px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoadingMore}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: isLoadingMore ? '#ccc' : 'var(--primary-color)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoadingMore ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
              }}
              title={t('productsLoadedTitle', { count: products.length })}
            >
              {isLoadingMore ? `⏳ ${t('loading')}` : `📦 ${t('loadMoreCount', { count: products.length })}`}
            </button>
          </div>
        )}

        <header className="Pos-cartHeader">
          <div>
            <h2>{t('cart')}</h2>
            {cart.length > 0 && (
              <span className="Pos-cartCount">{cart.length} {cart.length === 1 ? t('item') : t('items')}</span>
            )}
          </div>
          <div className="Pos-cartHeaderActions">
            {cart.length > 0 && (
              <button
                className="Pos-clearButton"
                onClick={() => {
                  if (confirmDialog(t('clearAllItems'))) {
                    updateCurrentProfile((profile) => ({
                      ...profile,
                      cart: [],
                      discountValue: 0,
                      isManualDiscount: false, // Reset manual flag
                      success: null,
                      error: null,
                    }));
                  }
                }}
                title={t('clearCart')}
              >
                🗑️ {t('clear')}
              </button>
            )}
            <button className="Pos-returnsButton" onClick={() => navigate('/returns')} title={t('processReturns')}>
              🔄 {t('returns')}
            </button>
          </div>
        </header>

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
                className={`Pos-profileTab ${index === activeProfileIndex ? 'active' : ''} ${profile.cart.length > 0 ? 'filled' : ''
                  }`}
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

        {globalError && <div className="Pos-alert Pos-alert--error">{globalError}</div>}
        {profileError && <div className="Pos-alert Pos-alert--error">{profileError}</div>}
        {profileSuccess && <div className="Pos-alert Pos-alert--success">{profileSuccess}</div>}

        <div className="Pos-cartTableWrapper">
          {cart.length === 0 ? (
            <div className="Pos-empty">{t('noItemsInCart')}</div>
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
                        <button onClick={() => updateQuantity(item.product.id, -1)}>-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, 1)}>+</button>
                      </div>
                    </td>
                    <td>{item.product.salePriceIQD.toLocaleString('en-IQ')}</td>
                    <td className="Pos-lineTotal">{(item.product.salePriceIQD * item.quantity).toLocaleString('en-IQ')}</td>
                    <td>
                      <button className="Pos-deleteButton" onClick={() => removeItem(item.product.id)} title={t('removeItem')}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="Pos-bottomSection">
          <div className="Pos-controls">
            <label>
              {t('customer')}
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
                    ✕
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
            </label>
            <label>
              {t('discount')}
              <div className="Pos-discountModes">
                <button
                  type="button"
                  className={discountMode === 'finalPrice' ? 'active' : ''}
                  onClick={() =>
                    updateCurrentProfile((profile) => ({
                      ...profile,
                      discountMode: 'finalPrice',
                      discountValue: subtotalIQD,
                      isManualDiscount: false, // Reset manual flag when clicking mode
                    }))
                  }
                  title={t('discountByFinalPrice') || 'Enter final price customer will pay'}
                >
                  💰 {t('finalPrice') || 'Final Price'}
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
                  title={t('discountByPercent')}
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
                  title={t('discountByAmount')}
                >
                  💵 {t('amount')}
                </button>
              </div>
              <div className="Pos-discountInput">
                <NumberInput
                  min="0"
                  max={discountMode === 'percent' ? 100 : discountMode === 'finalPrice' ? subtotalIQD : undefined}
                  value={discountValue}
                  onChange={(event) =>
                    updateCurrentProfile((profile) => ({
                      ...profile,
                      discountValue: Number(event.target.value) || 0,
                      isManualDiscount: true, // Mark as manually entered
                    }))
                  }
                  placeholder={
                    discountMode === 'percent'
                      ? '0-100'
                      : discountMode === 'finalPrice'
                        ? t('enterFinalPrice')
                        : t('amount')
                  }
                />
                {discountValue > 0 && (
                  <button
                    className="Pos-clearDiscount"
                    onClick={() =>
                      updateCurrentProfile((profile) => ({
                        ...profile,
                        discountValue: profile.discountMode === 'finalPrice' ? subtotalIQD : 0, // Reset to subtotal for finalPrice
                        isManualDiscount: false, // Reset manual flag
                      }))
                    }
                    title={t('clearDiscount')}
                  >
                    ×
                  </button>
                )}
              </div>
            </label>

            <label>
              {t('paymentMethod')}
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
            </label>
          </div>

          <div className="Pos-summary">
            <div className="Pos-summaryRow">
              <span>{t('subtotal')}</span>
              <strong>{subtotalIQD.toLocaleString('en-IQ')} IQD</strong>
            </div>
            {discountIQD > 0 && (
              <div className="Pos-summaryRow Pos-discountRow">
                <span>
                  {t('discount')} (
                  {discountMode === 'percent'
                    ? `${discountValue}%`
                    : discountMode === 'finalPrice'
                      ? t('finalPrice')
                      : t('amount')}
                  )
                </span>
                <strong>-{discountIQD.toLocaleString('en-IQ')} IQD</strong>
              </div>
            )}
            <div className="Pos-summaryRow Pos-total">
              <span>{t('total')}</span>
              <strong>{totalIQD.toLocaleString('en-IQ')} IQD</strong>
            </div>
            {user?.role === 'admin' && (
              <div className="Pos-summaryRow Pos-profit">
                <span>💰 {t('estimatedProfit')}</span>
                <strong>{profitIQD.toLocaleString('en-IQ')} IQD</strong>
              </div>
            )}
          </div>
        </div>

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
            <>⏳ {t('processing')}</>
          ) : (
            <>✅ {t('completeSale')} ({totalIQD.toLocaleString('en-IQ')} IQD)</>
          )}
        </button>
      </section >

      <PrintingModal
        visible={!!printSale}
        sale={printSale ?? undefined}
        printerName={preferredPrinter}
        onPrinterChange={setPreferredPrinter}
        onClose={() => setPrintSale(null)}
        autoPrint={true}
      />
    </div >
  );
};

export default PosPage;

