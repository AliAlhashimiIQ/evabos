import { useCallback, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useBarcodeScanner } from './useBarcodeScanner';

type Product = import('../types/electron').Product;

interface UseScannerOptions {
  products: Product[];
  addToCart: (product: Product) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  setSearchTerm: (term: string) => void;
}

/**
 * usePosScanner — Handles barcode/SKU scanning logic including exact match,
 * case-insensitive match, leading-zero fix, and debounce protection.
 */
export function usePosScanner({
  products,
  addToCart,
  searchInputRef,
  setSearchTerm,
}: UseScannerOptions) {
  const { t } = useLanguage();
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  const isScanningRef = useRef(false);

  const handleScan = useCallback(
    (value: string) => {
      setSearchTerm('');
      if (searchInputRef.current) searchInputRef.current.value = '';

      // Debounce protection
      if (isScanningRef.current) return;
      isScanningRef.current = true;

      // 1. Exact match (barcode or SKU)
      let variant = products.find(p => p.barcode === value || p.sku === value);

      // 2. Case-insensitive
      if (!variant) {
        variant = products.find(
          p => p.barcode?.toLowerCase() === value.toLowerCase() ||
               p.sku.toLowerCase() === value.toLowerCase(),
        );
      }

      // 3. Leading-zero fix (some scanners strip the leading zero)
      if (!variant) {
        const withZero = '0' + value;
        variant = products.find(p => p.barcode === withZero || p.sku === withZero);
      }

      if (variant) {
        if (variant.stockOnHand <= 0) {
          setScannerMessage(`"${variant.productName}" ${t('outOfStock')}`);
        } else {
          addToCart(variant);
          setScannerMessage(`${t('added')} ${variant.productName}`);
        }
      } else {
        setScannerMessage(`${t('noMatchFor')} ${value}`);
      }

      setTimeout(() => {
        setScannerMessage(null);
        setSearchTerm('');
        if (searchInputRef.current) searchInputRef.current.value = '';
        isScanningRef.current = false;
      }, 500);
    },
    [products, addToCart, setSearchTerm, searchInputRef, t],
  );

  // Register hardware scanner listener
  useBarcodeScanner({ onScan: handleScan });

  return { scannerMessage, setScannerMessage, handleScan };
}
