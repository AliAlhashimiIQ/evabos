import { useCallback, useMemo, useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

type Product = import('../types/electron').Product;

export interface CartItem {
  product: Product;
  quantity: number;
}

export const PROFILE_COUNT = 4;

export interface PosProfile {
  cart: CartItem[];
  selectedCustomerId: number | '';
  discountMode: 'amount' | 'percent' | 'finalPrice';
  discountValue: number;
  isManualDiscount: boolean;
  paymentMethod: 'cash' | 'card' | 'mixed';
  success: string | null;
  error: string | null;
  isSubmitting: boolean;
}

export const createProfile = (): PosProfile => ({
  cart: [],
  selectedCustomerId: '',
  discountMode: 'finalPrice',
  discountValue: 0,
  isManualDiscount: false,
  paymentMethod: 'cash',
  success: null,
  error: null,
  isSubmitting: false,
});

/**
 * useCart — Manages multi-profile cart state, item add/remove/quantity,
 * and derived financial calculations (subtotal, discount, total, profit).
 */
export function useCart(exchangeRate: number) {
  const { t } = useLanguage();

  const [profiles, setProfiles] = useState<PosProfile[]>(() => {
    try {
      const saved = localStorage.getItem('pos_profiles');
      if (saved) return JSON.parse(saved);
    } catch (e) { console.error('Failed to load profiles from localStorage', e); }
    return Array.from({ length: PROFILE_COUNT }, createProfile);
  });

  const [activeProfileIndex, setActiveProfileIndex] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_active_profile_index');
      if (saved) return parseInt(saved, 10);
    } catch (e) { console.error('Failed to load active profile index', e); }
    return 0;
  });

  // Persist profiles
  useEffect(() => {
    try {
      const profilesToSave = profiles.map(p => ({
        ...p, success: null, error: null, isSubmitting: false,
      }));
      localStorage.setItem('pos_profiles', JSON.stringify(profilesToSave));
    } catch (e) { console.error('Failed to save profiles', e); }
  }, [profiles]);

  // Persist active index
  useEffect(() => {
    try { localStorage.setItem('pos_active_profile_index', activeProfileIndex.toString()); }
    catch (e) { console.error('Failed to save active profile index', e); }
  }, [activeProfileIndex]);

  // ─── Profile Updaters ───────────────────────────────────────────────────────

  const updateProfileAtIndex = useCallback(
    (index: number, updater: (profile: PosProfile) => PosProfile) => {
      setProfiles(prev => prev.map((profile, idx) => (idx === index ? updater(profile) : profile)));
    }, [],
  );

  const updateCurrentProfile = useCallback(
    (updater: (profile: PosProfile) => PosProfile) => {
      updateProfileAtIndex(activeProfileIndex, updater);
    }, [activeProfileIndex, updateProfileAtIndex],
  );

  const currentProfile = profiles[activeProfileIndex] ?? createProfile();
  const {
    cart, selectedCustomerId, discountMode, discountValue,
    isManualDiscount: _isManualDiscount, paymentMethod,
    success: profileSuccess, error: profileError, isSubmitting,
  } = currentProfile;

  // ─── Cart Actions ───────────────────────────────────────────────────────────

  const addToCart = useCallback((product: Product) => {
    if (product.stockOnHand <= 0) {
      updateCurrentProfile(p => ({ ...p, error: `"${product.productName}" ${t('outOfStock')}`, success: null }));
      return;
    }
    updateCurrentProfile(profile => {
      const existing = profile.cart.find(item => item.product.id === product.id);
      if (existing) {
        const newQty = existing.quantity + 1;
        if (newQty > product.stockOnHand) {
          return {
            ...profile,
            error: t('onlyXAvailable', { count: String(product.stockOnHand), item: product.stockOnHand === 1 ? t('item') : t('items'), name: product.productName }),
            success: null,
          };
        }
        return { ...profile, cart: profile.cart.map(item => item.product.id === product.id ? { ...item, quantity: newQty } : item), error: null, success: null };
      }
      return { ...profile, cart: [...profile.cart, { product, quantity: 1 }], error: null, success: null };
    });
  }, [updateCurrentProfile, t]);

  const removeLastItem = useCallback(() => {
    updateCurrentProfile(p => ({ ...p, cart: p.cart.slice(0, -1), error: null, success: null }));
  }, [updateCurrentProfile]);

  const updateQuantity = useCallback((productId: number, delta: number) => {
    updateCurrentProfile(profile => {
      const cartItem = profile.cart.find(item => item.product.id === productId);
      if (!cartItem) return profile;
      const newQty = cartItem.quantity + delta;
      if (delta > 0 && newQty > cartItem.product.stockOnHand) {
        return { ...profile, error: t('onlyXAvailable', { count: String(cartItem.product.stockOnHand), item: cartItem.product.stockOnHand === 1 ? t('item') : t('items'), name: cartItem.product.productName }), success: null };
      }
      if (delta > 0 && cartItem.product.stockOnHand <= 0) {
        return { ...profile, error: `"${cartItem.product.productName}" ${t('outOfStockCannotAdd')}`, success: null };
      }
      const updatedCart = profile.cart
        .map(item => item.product.id === productId ? { ...item, quantity: Math.max(newQty, 1) } : item)
        .filter(item => item.quantity > 0);
      return { ...profile, cart: updatedCart, error: null, success: null };
    });
  }, [updateCurrentProfile, t]);

  const removeItem = useCallback((productId: number) => {
    updateCurrentProfile(p => ({ ...p, cart: p.cart.filter(item => item.product.id !== productId), error: null, success: null }));
  }, [updateCurrentProfile]);

  // ─── Derived Calculations ───────────────────────────────────────────────────

  const subtotalIQD = useMemo(
    () => cart.reduce((acc, item) => acc + item.product.salePriceIQD * item.quantity, 0),
    [cart],
  );

  // Auto-sync finalPrice discount with subtotal when cart changes
  useEffect(() => {
    if (discountMode === 'finalPrice') {
      updateCurrentProfile(profile => {
        if (!profile.isManualDiscount) return { ...profile, discountValue: subtotalIQD };
        return profile;
      });
    }
  }, [subtotalIQD, discountMode, updateCurrentProfile]);

  const discountIQD = useMemo(() => {
    if (discountMode === 'amount') return Math.min(discountValue, subtotalIQD);
    if (discountMode === 'percent') return Math.min((subtotalIQD * discountValue) / 100, subtotalIQD);
    if (discountMode === 'finalPrice') {
      const fp = Math.max(0, Math.min(discountValue, subtotalIQD));
      return Math.max(0, subtotalIQD - fp);
    }
    return 0;
  }, [discountMode, discountValue, subtotalIQD]);

  const totalIQD = useMemo(() => Math.max(subtotalIQD - discountIQD, 0), [subtotalIQD, discountIQD]);

  const profitIQD = useMemo(() => {
    const totalCost = cart.reduce((acc, item) => acc + item.product.purchaseCostUSD * exchangeRate * item.quantity, 0);
    return Math.max(totalIQD - totalCost, 0);
  }, [cart, exchangeRate, totalIQD]);

  return {
    // Profile state
    profiles, setProfiles,
    activeProfileIndex, setActiveProfileIndex,
    currentProfile,
    updateProfileAtIndex,
    updateCurrentProfile,
    // Cart state
    cart, selectedCustomerId, discountMode, discountValue,
    paymentMethod, profileSuccess, profileError, isSubmitting,
    // Cart actions
    addToCart, removeLastItem, updateQuantity, removeItem,
    // Financials
    subtotalIQD, discountIQD, totalIQD, profitIQD,
  };
}
