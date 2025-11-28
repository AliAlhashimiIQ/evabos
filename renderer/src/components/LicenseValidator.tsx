import React, { useEffect, useState } from 'react';
import './LicenseValidator.css';

interface LicenseStatus {
  valid: boolean;
  reason?: string;
  isUsb?: boolean;
}

export function LicenseValidator({ children }: { children: React.ReactNode }): JSX.Element {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const validateLicense = async () => {
      try {
        if (!window.evaApi?.licensing) {
          // In development or if API not available, allow
          setStatus({ valid: true });
          setChecking(false);
          return;
        }

        const result = await window.evaApi.licensing.validate();
        setStatus(result);
      } catch (err) {
        console.error('License validation error:', err);
        setStatus({ valid: false, reason: 'Failed to validate license' });
      } finally {
        setChecking(false);
      }
    };

    validateLicense();
  }, []);

  if (checking) {
    return (
      <div className="LicenseValidator-loading">
        <div className="LicenseValidator-spinner"></div>
        <p>Validating license...</p>
      </div>
    );
  }

  if (!status?.valid) {
    return (
      <div className="LicenseValidator-error">
        <div className="LicenseValidator-errorContent">
          <h1>🔒 USB Dongle Required</h1>
          <div className="LicenseValidator-message">
            {status?.reason?.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
          <div className="LicenseValidator-details">
            <p><strong>This is a USB-locked application:</strong></p>
            <ul>
              <li>Must run from the authorized USB drive</li>
              <li>Cannot be copied to hard drive</li>
              <li>Cannot be used with a different USB drive</li>
            </ul>
            <p className="LicenseValidator-contact">
              Contact your administrator if you need access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

