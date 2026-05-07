import { useState, useEffect, useCallback } from 'react';
import { X, Keyboard } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import './ShortcutOverlay.css';

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{ keys: string[]; description: string }>;
}

export const ShortcutOverlay = (): JSX.Element | null => {
  const [visible, setVisible] = useState(false);
  const { t } = useLanguage();

  const toggle = useCallback(() => setVisible(v => !v), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.key === '?' || e.key === '/') {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape' && visible) {
        setVisible(false);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, toggle]);

  if (!visible) return null;

  const groups: ShortcutGroup[] = [
    {
      title: t('navigation') || 'Navigation',
      shortcuts: [
        { keys: ['F1'], description: t('pointOfSale') },
        { keys: ['F2'], description: t('products') },
        { keys: ['F3'], description: t('customers') },
        { keys: ['F4'], description: t('reports') },
      ],
    },
    {
      title: t('pointOfSale'),
      shortcuts: [
        { keys: ['Ctrl', 'Enter'], description: t('completeSale') },
        { keys: ['Delete'], description: t('removeItem') },
        { keys: ['Tab 1-4'], description: t('posTabs') },
      ],
    },
    {
      title: t('settings') || 'General',
      shortcuts: [
        { keys: ['?'], description: t('showShortcuts') || 'Show shortcuts' },
        { keys: ['Esc'], description: t('close') },
      ],
    },
  ];

  return (
    <div className="ShortcutOverlay" onClick={() => setVisible(false)}>
      <div className="ShortcutOverlay-modal" onClick={e => e.stopPropagation()}>
        <div className="ShortcutOverlay-header">
          <div className="ShortcutOverlay-title">
            <Keyboard size={22} />
            <h2>{t('keyboardShortcuts') || 'Keyboard Shortcuts'}</h2>
          </div>
          <button className="ShortcutOverlay-close" onClick={() => setVisible(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="ShortcutOverlay-groups">
          {groups.map((group, gi) => (
            <div key={gi} className="ShortcutOverlay-group">
              <h3>{group.title}</h3>
              <div className="ShortcutOverlay-list">
                {group.shortcuts.map((sc, si) => (
                  <div key={si} className="ShortcutOverlay-item">
                    <span className="ShortcutOverlay-desc">{sc.description}</span>
                    <div className="ShortcutOverlay-keys">
                      {sc.keys.map((k, ki) => (
                        <span key={ki}>
                          <kbd>{k}</kbd>
                          {ki < sc.keys.length - 1 && <span className="ShortcutOverlay-plus">+</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="ShortcutOverlay-footer">
          {t('pressQuestionMark') || 'Press'} <kbd>?</kbd> {t('toToggle') || 'to toggle this overlay'}
        </div>
      </div>
    </div>
  );
};
