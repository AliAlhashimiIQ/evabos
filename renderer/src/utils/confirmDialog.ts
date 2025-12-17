/**
 * Wrapper for window.confirm that resets Electron focus after the dialog closes.
 * 
 * Native browser dialogs (confirm, alert, prompt) break Electron's focus state
 * on Windows. This wrapper ensures webContents gets focus back after the dialog.
 */
export function confirmDialog(message: string): boolean {
    const result = window.confirm(message);

    // Reset Electron focus after dialog closes
    // This fixes the focus desync that happens with native dialogs
    if (window.electronAPI?.resetFocus) {
        // Small delay to let the dialog fully close
        setTimeout(() => {
            window.electronAPI?.resetFocus();
        }, 50);
    }

    return result;
}
