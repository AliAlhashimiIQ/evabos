import { useEffect, useRef } from 'react';

interface Options {
  onScan: (value: string) => void;
  threshold?: number;
  minLength?: number;
}

export function useBarcodeScanner({ onScan, threshold = 50, minLength = 5 }: Options): void {
  const bufferRef = useRef('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt') {
        return;
      }

      // Ignore if user is typing in an input
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (event.key === 'Enter') {
        if (bufferRef.current.length >= minLength) {
          onScan(bufferRef.current);
        }
        bufferRef.current = '';
        return;
      }

      bufferRef.current += event.key;
      timeoutRef.current = setTimeout(() => {
        bufferRef.current = '';
      }, threshold);
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [onScan, threshold, minLength]);
}

