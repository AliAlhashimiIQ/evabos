import { useEffect } from 'react';

interface ShortcutMap {
  [key: string]: () => void;
}

export function useShortcutKeys(map: ShortcutMap): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
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

