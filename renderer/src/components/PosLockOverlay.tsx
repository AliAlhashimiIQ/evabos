import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './PosLockOverlay.css';

export function PosLockOverlay(): JSX.Element | null {
  const { posLocked, unlockPos, user, hasRole } = useAuth();
  const [, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  if (!posLocked) {
    return null;
  }

  const canUnlock = hasRole(['admin', 'manager']);

  const handleUnlock = async () => {
    if (!canUnlock) {
      setError('المسؤول أو المدير فقط يمكنهما إلغاء القفل');
      return;
    }
    setUnlocking(true);
    setError(null);
    try {
      await unlockPos();
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل في إلغاء قفل نقطة البيع');
    } finally {
      setUnlocking(false);
    }
  };

  const getRoleLabel = (role: string) => {
    if (role === 'admin') return 'مسؤول النظام';
    if (role === 'manager') return 'مدير';
    return 'كاشير';
  };

  return (
    <div className="PosLockOverlay" dir="rtl">
      <div className="PosLockOverlay-content">
        <div className="PosLockOverlay-icon">
          <Lock size={44} />
        </div>
        <h2>نقطة البيع مقفلة</h2>
        <p>نظام نقطة البيع مقفل حالياً لأسباب أمنية.</p>
        {canUnlock ? (
          <div className="PosLockOverlay-unlock">
            <p>لديك الصلاحية لإلغاء قفل النظام.</p>
            {error && <div className="PosLockOverlay-error">{error}</div>}
            <button onClick={handleUnlock} disabled={unlocking} className="PosLockOverlay-button">
              {unlocking ? 'جاري إلغاء القفل...' : 'إلغاء قفل نقطة البيع'}
            </button>
          </div>
        ) : (
          <p className="PosLockOverlay-message">يرجى مراجعة مسؤول النظام أو المدير لإلغاء قفل نقطة البيع.</p>
        )}
        {user && (
          <div className="PosLockOverlay-user">
            تم تسجيل الدخول باسم: <strong>{user.username}</strong> ({getRoleLabel(user.role)})
          </div>
        )}
      </div>
    </div>
  );
}

