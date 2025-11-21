import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './PosLockOverlay.css';

export function PosLockOverlay(): JSX.Element | null {
  const { posLocked, unlockPos, user, hasRole } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  if (!posLocked) {
    return null;
  }

  const canUnlock = hasRole(['admin', 'manager']);

  const handleUnlock = async () => {
    if (!canUnlock) {
      setError('Only admin or manager can unlock POS');
      return;
    }
    setUnlocking(true);
    setError(null);
    try {
      await unlockPos();
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock POS');
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="PosLockOverlay">
      <div className="PosLockOverlay-content">
        <div className="PosLockOverlay-icon">🔒</div>
        <h2>POS Locked</h2>
        <p>The POS system is currently locked.</p>
        {canUnlock ? (
          <div className="PosLockOverlay-unlock">
            <p>You have permission to unlock the system.</p>
            {error && <div className="PosLockOverlay-error">{error}</div>}
            <button onClick={handleUnlock} disabled={unlocking} className="PosLockOverlay-button">
              {unlocking ? 'Unlocking...' : 'Unlock POS'}
            </button>
          </div>
        ) : (
          <p className="PosLockOverlay-message">Please contact an administrator or manager to unlock the system.</p>
        )}
        {user && (
          <div className="PosLockOverlay-user">
            Logged in as: <strong>{user.username}</strong> ({user.role})
          </div>
        )}
      </div>
    </div>
  );
}

