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

      const trimmedVal = (value || '').trim();
      const candidates = new Set<string>();
      candidates.add(trimmedVal);
      const stripped = trimmedVal.replace(/^0+/, '');
      if (stripped) {
        candidates.add(stripped);
        candidates.add('0' + stripped);
        candidates.add('00' + stripped);
        candidates.add('000' + stripped);
      }
      if (trimmedVal.startsWith('0')) {
        const s1 = trimmedVal.substring(1);
        if (s1) candidates.add(s1);
      } else {
        candidates.add('0' + trimmedVal);
      }
      if (trimmedVal.length === 12) {
        candidates.add('0' + trimmedVal);
      } else if (trimmedVal.length === 13 && trimmedVal.startsWith('0')) {
        candidates.add(trimmedVal.substring(1));
      }
      const candidateList = Array.from(candidates).filter(Boolean);

      let variant: Product | undefined;
      for (const c of candidateList) {
        variant = products.find(p => p.barcode === c || p.sku === c);
        if (variant) break;
      }
      if (!variant) {
        for (const c of candidateList) {
          const cLower = c.toLowerCase();
          variant = products.find(
            p => p.barcode?.toLowerCase() === cLower || p.sku.toLowerCase() === cLower,
          );
          if (variant) break;
        }
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
