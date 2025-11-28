import { useEffect } from 'react';

interface ShortcutMap {
  [key: string]: () => void;
}

export function useShortcutKeys(map: ShortcutMap): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input, unless it's a Function key (F1-F12)
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !event.key.startsWith('F')) {
        return;
      }

      const normalizedKey = event.key.toLowerCase();
      if (map[event.key]) {
        event.preventDefault();
        map[event.key]();
        return;
      }
      if (map[normalizedKey]) {
        event.preventDefault();
        map[normalizedKey]();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [map]);
}

