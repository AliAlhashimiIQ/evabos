import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import './PasswordChangeModal.css';

interface PasswordChangeModalProps {
    token: string;
    username: string;
    onSuccess: () => void;
    onLogout: () => void;
}

export const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({
    token,
    username,
    onSuccess,
    onLogout,
}) => {
    const { t } = useLanguage();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            setError(t('passwords_do_not_match') || 'Passwords do not match');
            return;
        }

        // Validate password length
        if (newPassword.length < 8) {
            setError(t('password_too_short') || 'Password must be at least 8 characters');
            return;
        }

        // Validate password contains number
        if (!/\d/.test(newPassword)) {
            setError(t('password_needs_number') || 'Password must contain at least one number');
            return;
        }

        setLoading(true);

        try {
            const result = await window.evaApi.auth.changePassword(token, currentPassword, newPassword);
            if (result.success) {
                onSuccess();
            } else {
                setError(result.error || 'Failed to change password');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="PasswordChangeModal-overlay">
            <div className="PasswordChangeModal-container">
                <div className="PasswordChangeModal-header">
                    <h2>{t('change_password_required') || 'Password Change Required'}</h2>
                    <p>{t('change_password_message') || `Welcome ${username}! You must change your password before continuing.`}</p>
                </div>

                <form onSubmit={handleSubmit} className="PasswordChangeModal-form">
                    {error && <div className="PasswordChangeModal-error">{error}</div>}

                    <div className="PasswordChangeModal-field">
                        <label htmlFor="currentPassword">{t('current_password') || 'Current Password'}</label>
                        <input
                            id="currentPassword"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder={t('enter_current_password') || 'Enter current password'}
                            disabled={loading}
                            autoFocus
                        />
                    </div>

                    <div className="PasswordChangeModal-field">
                        <label htmlFor="newPassword">{t('new_password') || 'New Password'}</label>
                        <input
                            id="newPassword"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder={t('enter_new_password') || 'Enter new password (min 8 chars, 1 number)'}
                            disabled={loading}
                        />
                    </div>

                    <div className="PasswordChangeModal-field">
                        <label htmlFor="confirmPassword">{t('confirm_password') || 'Confirm New Password'}</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder={t('confirm_new_password') || 'Confirm new password'}
                            disabled={loading}
                        />
                    </div>

                    <div className="PasswordChangeModal-requirements">
                        <p>{t('password_requirements') || 'Password requirements:'}</p>
                        <ul>
                            <li className={newPassword.length >= 8 ? 'met' : ''}>
                                {t('min_8_chars') || 'At least 8 characters'}
                            </li>
                            <li className={/\d/.test(newPassword) ? 'met' : ''}>
                                {t('one_number') || 'At least one number'}
                            </li>
                        </ul>
                    </div>

                    <div className="PasswordChangeModal-actions">
                        <button
                            type="button"
                            className="PasswordChangeModal-button secondary"
                            onClick={onLogout}
                            disabled={loading}
                        >
                            {t('logout') || 'Logout'}
                        </button>
                        <button
                            type="submit"
                            className="PasswordChangeModal-button primary"
                            disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                        >
                            {loading ? (t('changing') || 'Changing...') : (t('change_password') || 'Change Password')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PasswordChangeModal;
