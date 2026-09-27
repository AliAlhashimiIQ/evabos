import React, { useEffect, useState } from 'react';
import { ShieldCheck, Copy } from 'lucide-react';
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
      setStatus({ valid: false, reason: 'خطأ في النظام أثناء التحقق من الترخيص' });
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
        setError(res.error || 'فشل تفعيل الترخيص');
      }
    } catch (err) {
      setError('حدث خطأ غير متوقع أثناء التفعيل');
    } finally {
      setActivating(false);
    }
  };

  const copyMachineId = () => {
    navigator.clipboard.writeText(machineId);
    alert('تم نسخ معرف الجهاز إلى الحافظة!');
  };

  if (checking) {
    return (
      <div className="LicenseValidator-loading">
        <div className="LicenseValidator-spinner"></div>
        <p>جاري التحقق من الترخيص...</p>
      </div>
    );
  }

  if (!status?.valid) {
    return (
      <div className="LicenseValidator-error">
        <div className="LicenseValidator-overlay">
          <div className="LicenseCard" dir="rtl">
            <div className="LicenseCard-header">
              <div className="LicenseCard-icon"><ShieldCheck size={48} /></div>
              <h1>تفعيل النظام</h1>
              <p>يرجى تفعيل نسختك من نظام Madar POS للمتابعة.</p>
            </div>

            <div className="LicenseCard-body">
              {error && <div className="LicenseCard-alert error">{error}</div>}
              {success && <div className="LicenseCard-alert success">تم تفعيل الترخيص بنجاح! جاري إعادة التحميل...</div>}

              <div className="MachineInfo">
                <label>معرف هذا الجهاز (Machine ID)</label>
                <div className="MachineInfo-row" dir="ltr">
                  <code>{machineId}</code>
                  <button type="button" onClick={copyMachineId} title="نسخ المعرف"><Copy size={16} /></button>
                </div>
                <small>أرسل هذا المعرف إلى المزود لاستلام مفتاح التفعيل الخاص بك.</small>
              </div>

              <form onSubmit={handleActivate}>
                <div className="LicenseInput">
                  <label htmlFor="license-key">مفتاح الترخيص (License Key)</label>
                  <input
                    id="license-key"
                    type="text"
                    placeholder="MADAR-XXXX-XXXX-XXXX-XXXX"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                    disabled={activating || success}
                    required
                    dir="ltr"
                    style={{ textAlign: 'center', letterSpacing: '1px' }}
                  />
                </div>

                <button
                  type="submit"
                  className="ActivateButton"
                  disabled={activating || success || !licenseKey}
                >
                  {activating ? 'جاري التفعيل...' : 'تفعيل النظام'}
                </button>
              </form>
            </div>

            <div className="LicenseCard-footer">
              <p>هل تحتاج إلى مساعدة؟ تواصل معنا: <a href="mailto:support@evapos.com">support@evapos.com</a></p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

