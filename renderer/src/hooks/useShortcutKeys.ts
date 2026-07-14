import { useEffect } from 'react';

interface ShortcutMap {
  [key: string]: () => void;
}

export function useShortcutKeys(map: ShortcutMap): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      const isModifierPressed = event.altKey || event.ctrlKey;

      // Ignore standard key presses inside input fields, but let Function keys and modifier combos pass through
      if (isInput && !event.key.startsWith('F') && !isModifierPressed) {
        return;
      }

      // Build key combination string
      let combo = '';
      if (event.ctrlKey) combo += 'Control+';
      if (event.altKey) combo += 'Alt+';
      if (event.shiftKey) combo += 'Shift+';

      const keyName = event.key === ' ' ? 'Space' : event.key;
      const fullCombo = combo + keyName;
      const lowerCombo = combo + keyName.toLowerCase();

      if (map[fullCombo]) {
        event.preventDefault();
        map[fullCombo]();
        return;
      }
      if (map[lowerCombo]) {
        event.preventDefault();
        map[lowerCombo]();
        return;
      }

      // Fallback for single key mappings (without modifiers)
      if (!isModifierPressed) {
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
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [map]);
}

