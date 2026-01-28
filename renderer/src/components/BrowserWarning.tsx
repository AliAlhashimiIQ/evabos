import { AlertTriangle } from 'lucide-react';
import './BrowserWarning.css';

export function BrowserWarning(): JSX.Element | null {
  // Check if we're in Electron (window.evaApi exists) or in a browser
  const isElectron = typeof window !== 'undefined' && window.evaApi;

  if (isElectron) {
    return null; // Don't show warning in Electron
  }

  return (
    <div className="BrowserWarning">
      <div className="BrowserWarning-content">
        <div className="BrowserWarning-icon"><AlertTriangle size={48} /></div>
        <h2>This App Must Run in Electron</h2>
        <p>
          It looks like you&apos;re opening this app in a browser. This application is designed to run as a <strong>desktop application</strong> that
          must run in Electron.
        </p>
        <div className="BrowserWarning-steps">
          <h3>How to Run Correctly:</h3>
          <ol>
            <li>Close this browser tab</li>
            <li>Open PowerShell/Command Prompt in the project folder</li>
            <li>Run: <code>npm run dev</code></li>
            <li>Wait for the Electron window to open automatically</li>
            <li>Use the Electron window (not the browser)</li>
          </ol>
        </div>
        <div className="BrowserWarning-note">
          <strong>Note:</strong> The Electron window will open automatically when you run <code>npm run dev</code>. Do
          not open http://localhost:5174 in your browser.
        </div>
      </div>
    </div >
  );
}

