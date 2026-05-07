import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import './ConfirmDialog.css';

interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
}

interface ConfirmDialogState extends ConfirmDialogOptions {
  resolve: (value: boolean) => void;
}

// Singleton state setter – set by the rendered component
let showDialogFn: ((state: ConfirmDialogState) => void) | null = null;

/**
 * Imperative confirm dialog API — replaces window.confirm().
 * Returns a Promise<boolean>.
 * Usage: `const ok = await confirmDialog('Delete this item?');`
 */
export function confirmDialog(messageOrOptions: string | ConfirmDialogOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const options: ConfirmDialogOptions =
      typeof messageOrOptions === 'string'
        ? { message: messageOrOptions }
        : messageOrOptions;

    if (showDialogFn) {
      showDialogFn({ ...options, resolve });
    } else {
      // Fallback if component not mounted (shouldn't happen)
      const result = window.confirm(options.message);
      resolve(result);
    }
  });
}

/**
 * Mount this component once (in App or main.tsx) to enable the custom confirm dialog.
 */
export const ConfirmDialogHost = (): JSX.Element | null => {
  const [state, setState] = useState<ConfirmDialogState | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    showDialogFn = setState;
    return () => { showDialogFn = null; };
  }, []);

  // Focus confirm button on open
  useEffect(() => {
    if (state && confirmBtnRef.current) {
      confirmBtnRef.current.focus();
    }
  }, [state]);

  // Handle keyboard
  useEffect(() => {
    if (!state) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        state.resolve(false);
        setState(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state]);

  const handleConfirm = useCallback(() => {
    if (state) {
      state.resolve(true);
      setState(null);
    }
  }, [state]);

  const handleCancel = useCallback(() => {
    if (state) {
      state.resolve(false);
      setState(null);
    }
  }, [state]);

  if (!state) return null;

  const isDanger = state.variant === 'danger';

  return (
    <div className="ConfirmDialog-overlay" onClick={handleCancel}>
      <div className="ConfirmDialog" onClick={e => e.stopPropagation()}>
        <div className={`ConfirmDialog-iconWrap ${isDanger ? 'ConfirmDialog-iconWrap--danger' : ''}`}>
          {isDanger ? <AlertTriangle size={28} /> : <HelpCircle size={28} />}
        </div>

        {state.title && <h3 className="ConfirmDialog-title">{state.title}</h3>}
        <p className="ConfirmDialog-message">{state.message}</p>

        <div className="ConfirmDialog-actions">
          <button className="ConfirmDialog-btn ConfirmDialog-btn--cancel" onClick={handleCancel}>
            {state.cancelText || 'Cancel'}
          </button>
          <button
            ref={confirmBtnRef}
            className={`ConfirmDialog-btn ${isDanger ? 'ConfirmDialog-btn--danger' : 'ConfirmDialog-btn--confirm'}`}
            onClick={handleConfirm}
          >
            {state.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};
