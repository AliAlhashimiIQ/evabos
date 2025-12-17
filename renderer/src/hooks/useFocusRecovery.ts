import { useEffect, useRef } from 'react';

/**
 * Hook to automatically recover from Electron focus desync issues.
 * 
 * This fixes the intermittent input freeze where inputs stop responding
 * until Alt+Tab or window minimize/restore is performed.
 * 
 * Root causes:
 * - BrowserWindow focus state can get out of sync with webContents focus
 * - Modals that manipulate body styles can interfere with focus
 * - Window visibility changes can cause Chromium focus to get stuck
 */
export function useFocusRecovery(): void {
    const lastFocusResetRef = useRef<number>(0);
    const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!window.electronAPI?.resetFocus) {
            return; // Not in Electron environment
        }

        const DEBOUNCE_MS = 500; // Minimum time between focus resets
        const RESET_DELAY_MS = 100; // Delay before triggering reset

        const triggerFocusReset = () => {
            const now = Date.now();
            if (now - lastFocusResetRef.current < DEBOUNCE_MS) {
                return; // Too soon since last reset
            }

            // Clear any pending reset
            if (resetTimeoutRef.current) {
                clearTimeout(resetTimeoutRef.current);
            }

            // Schedule the reset with a small delay to allow event processing
            resetTimeoutRef.current = setTimeout(async () => {
                try {
                    lastFocusResetRef.current = Date.now();
                    await window.electronAPI?.resetFocus();
                } catch (err) {
                    console.error('[useFocusRecovery] Reset focus failed:', err);
                }
            }, RESET_DELAY_MS);
        };

        // Handle window focus event - triggers when the window gains focus
        const handleWindowFocus = () => {
            triggerFocusReset();
        };

        // Handle visibility change - triggers when tab/window becomes visible
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                triggerFocusReset();
            }
        };

        // Handle mouse enter on document body - backup recovery mechanism
        // If focus is stuck, clicking anywhere should help recover
        const handleMouseDown = () => {
            // Only trigger if we haven't reset recently
            const now = Date.now();
            if (now - lastFocusResetRef.current > 2000) {
                // Check if focus might be stuck by seeing if active element is body
                // (which usually indicates focus is lost)
                if (document.activeElement === document.body) {
                    triggerFocusReset();
                }
            }
        };

        window.addEventListener('focus', handleWindowFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('mousedown', handleMouseDown, { passive: true });

        return () => {
            window.removeEventListener('focus', handleWindowFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('mousedown', handleMouseDown);

            if (resetTimeoutRef.current) {
                clearTimeout(resetTimeoutRef.current);
            }
        };
    }, []);
}
