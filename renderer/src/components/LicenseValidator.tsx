import React, { useEffect, useState } from 'react';
import './LicenseValidator.css';

interface LicenseStatus {
  valid: boolean;
  reason?: string;
  isUsb?: boolean;
  expiresAt?: string;
}

export function LicenseValidator({ children }: { children: React.ReactNode }): JSX.Element {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [machineId, setMachineId] = useState<string>('');
  const [licenseKey, setLicenseKey] = useState<string>('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const checkLicense = async () => {
    if (!window.evaApi) return;
    try {
      setChecking(true);
      const res = await window.evaApi.licensing.validate();
      setStatus(res);

      if (!res.valid) {
        const id = await window.evaApi.licensing.getMachineId();
        setMachineId(id);
      }
    } catch (err) {
      console.error('License check failed:', err);
      setStatus({ valid: false, reason: 'System error during validation' });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkLicense();
  }, []);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.evaApi || !licenseKey) return;

    try {
      setActivating(true);
      setError(null);
      const res = await window.evaApi.licensing.activate(licenseKey.trim());

      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          checkLicense();
          setSuccess(false);
        }, 1500);
      } else {
        setError(res.error || 'Activation failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setActivating(false);
    }
  };

  const copyMachineId = () => {
    navigator.clipboard.writeText(machineId);
    alert('Machine ID copied to clipboard!');
  };

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
        <div className="LicenseValidator-overlay">
          <div className="LicenseCard">
            <div className="LicenseCard-header">
              <div className="LicenseCard-icon">🛡️</div>
              <h1>Product Activation</h1>
              <p>Please activate your copy of EVA POS to continue.</p>
            </div>

            <div className="LicenseCard-body">
              {error && <div className="LicenseCard-alert error">{error}</div>}
              {success && <div className="LicenseCard-alert success">License Activated! Reloading...</div>}

              <div className="MachineInfo">
                <label>Your Machine ID</label>
                <div className="MachineInfo-row">
                  <code>{machineId}</code>
                  <button type="button" onClick={copyMachineId} title="Copy ID">📋</button>
                </div>
                <small>Send this ID to your provider to receive your license key.</small>
              </div>

              <form onSubmit={handleActivate}>
                <div className="LicenseInput">
                  <label htmlFor="license-key">License Key</label>
                  <input
                    id="license-key"
                    type="text"
                    placeholder="EVA-XXXX-XXXX-XXXX-XXXX"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                    disabled={activating || success}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="ActivateButton"
                  disabled={activating || success || !licenseKey}
                >
                  {activating ? 'Activating...' : 'Activate System'}
                </button>
              </form>
            </div>

            <div className="LicenseCard-footer">
              <p>Need help? Contact <a href="mailto:support@evapos.com">support@evapos.com</a></p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

