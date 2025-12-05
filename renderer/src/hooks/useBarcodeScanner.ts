import { useEffect, useRef } from 'react';

interface Options {
  onScan: (value: string) => void;
  threshold?: number;
  minLength?: number;
}

export function useBarcodeScanner({ onScan, threshold = 150, minLength = 3 }: Options): void {
  const bufferRef = useRef('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt') {
        return;
      }

      // REMOVED: Ignore if user is typing in an input
      // We now allow scanning even if an input is focused, to support "Global Scanning"
      // as requested by the user. The scanner's speed (threshold) distinguishes it from manual typing.
      /*
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }
      */

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (event.key === 'Enter') {
        if (bufferRef.current.length >= minLength) {
          event.preventDefault(); // Prevent triggering focused buttons
          event.stopPropagation();
          onScan(bufferRef.current);
        }
        bufferRef.current = '';
        return;
      }

      bufferRef.current += event.key;
      timeoutRef.current = setTimeout(() => {
        // If timeout occurs and we have a valid barcode in buffer, scan it!
        // This supports scanners that do NOT send an 'Enter' key at the end.
        if (bufferRef.current.length >= minLength) {
          onScan(bufferRef.current);
        }
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

