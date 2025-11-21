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
          <h1>⚠️ License Validation Failed</h1>
          <p>{status?.reason || 'This application is not authorized to run on this device.'}</p>
          <div className="LicenseValidator-details">
            <p><strong>Possible reasons:</strong></p>
            <ul>
              <li>Application has been copied to a different computer</li>
              <li>Application has been moved to a different USB drive</li>
              <li>System hardware has changed significantly</li>
            </ul>
            <p className="LicenseValidator-contact">
              Please contact your administrator for assistance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

