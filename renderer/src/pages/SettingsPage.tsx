import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import LabelSettingsSection from '../components/LabelSettingsSection';
import NumberInput from '../components/NumberInput';
import './Pages.css';
import './SettingsPage.css';

type ExchangeRateResponse = import('../types/electron').ExchangeRateResponse;

const SettingsPage = (): JSX.Element => {
  const { token, hasRole } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();

  // Exchange Rate
  const [currentRate, setCurrentRate] = useState<number>(1500);
  const [newRate, setNewRate] = useState<string>('');
  const [rateUpdating, setRateUpdating] = useState(false);
  const [rateSuccess, setRateSuccess] = useState<string | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);

  // Margin Calculator
  const [costUSD, setCostUSD] = useState<string>('');
  const [salePriceIQD, setSalePriceIQD] = useState<string>('');
  const [calculatedMargin, setCalculatedMargin] = useState<string>('—');
  const [calculatedProfit, setCalculatedProfit] = useState<string>('—');

  // Email Settings
  const [emailHost, setEmailHost] = useState('smtp.gmail.com');
  const [emailPort, setEmailPort] = useState('587');
  const [emailUser, setEmailUser] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailSendTime, setEmailSendTime] = useState('20:00'); // Default 8 PM
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  useEffect(() => {
    loadExchangeRate();
    loadEmailSettings();
  }, []);

  const loadExchangeRate = async () => {
    if (!window.evaApi) return;
    try {
      const response: ExchangeRateResponse = await window.evaApi.exchangeRates.getCurrent();
      if (response.currentRate) {
        setCurrentRate(response.currentRate.rate);
      }
    } catch (err) {
      console.error('Failed to load exchange rate:', err);
    }
  };

  const loadEmailSettings = async () => {
    if (!window.evaApi || !token) return;
    try {
      const settings = await window.evaApi.email.getSettings(token);
      setEmailHost(settings.smtpHost || 'smtp.gmail.com');
      setEmailPort(String(settings.smtpPort || 587));
      setEmailUser(settings.smtpUser || '');
      setEmailPassword(settings.smtpPassword || '');
      setEmailRecipient(settings.emailRecipient || '');
      setEmailEnabled(settings.emailEnabled || false);
      setEmailSendTime(settings.sendTime || '20:00');
    } catch (err) {
      console.error('Failed to load email settings:', err);
    }
  };

  const handleSaveEmailSettings = async () => {
    if (!window.evaApi || !token) return;
    try {
      setEmailSaving(true);
      setEmailMessage(null);
      await window.evaApi.email.saveSettings(token, {
        smtpHost: emailHost,
        smtpPort: parseInt(emailPort, 10) || 587,
        smtpSecure: parseInt(emailPort, 10) === 465,
        smtpUser: emailUser,
        smtpPassword: emailPassword,
        emailRecipient: emailRecipient,
        emailEnabled: emailEnabled,
        sendTime: emailSendTime,
      });
      setEmailMessage('✅ ' + (t('emailSettingsSaved') || 'Email settings saved successfully!'));
    } catch (err) {
      setEmailMessage('❌ Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setEmailSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!window.evaApi || !token) return;
    try {
      setEmailTesting(true);
      setEmailMessage(null);
      const result = await window.evaApi.email.sendTest(token) as { success: boolean; error?: string };
      if (result.success) {
        setEmailMessage('✅ ' + (t('testEmailSuccess') || 'Test email sent! Check your inbox.'));
      } else {
        setEmailMessage('⚠️ ' + (result.error || t('testEmailFailed') || 'Email not sent. Please check settings.'));
      }
    } catch (err) {
      setEmailMessage('❌ Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setEmailTesting(false);
    }
  };

  const handleUpdateRate = async () => {
    if (!window.evaApi || !token) return;
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate <= 0) {
      setRateError(t('pleaseEnterValidRate'));
      return;
    }

    try {
      setRateUpdating(true);
      setRateError(null);
      setRateSuccess(null);
      await window.evaApi.exchangeRates.update(token, { rate });
      setCurrentRate(rate);
      setNewRate('');
      setRateSuccess(t('exchangeRateUpdated'));
      setTimeout(() => setRateSuccess(null), 3000);
    } catch (err) {
      setRateError(err instanceof Error ? err.message : t('failedToUpdateRate'));
    } finally {
      setRateUpdating(false);
    }
  };

  const calculateMargin = () => {
    const cost = parseFloat(costUSD);
    const sale = parseFloat(salePriceIQD);

    if (isNaN(cost) || isNaN(sale) || cost <= 0 || sale <= 0) {
      setCalculatedMargin('—');
      setCalculatedProfit('—');
      return;
    }

    const costInIQD = cost * currentRate;
    const profit = sale - costInIQD;
    const margin = ((profit / costInIQD) * 100).toFixed(2);

    setCalculatedMargin(`${margin}%`);
    setCalculatedProfit(`${profit.toLocaleString('en-IQ')} IQD`);
  };

  useEffect(() => {
    if (costUSD && salePriceIQD) {
      calculateMargin();
    }
  }, [costUSD, salePriceIQD, currentRate]);

  return (
    <div className="Page SettingsPage">
      <div className="Page-header">
        <h1>{t('settings')}</h1>
        <p>{t('configureSystem')}</p>
      </div>

      <div className="SettingsPage-content">
        {/* Theme Settings */}
        <div className="SettingsPage-section">
          <h2>🎨 {t('theme')}</h2>
          <p>{t('selectTheme')}</p>

          <div className="SettingsPage-themeOptions">
            <button
              className={`SettingsPage-themeButton ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
            >
              <span className="theme-icon">🌙</span>
              <div>
                <div className="label">{t('darkMode')}</div>
                <div className="sublabel">{t('darkModeDesc')}</div>
              </div>
              {theme === 'dark' && <span className="check">✓</span>}
            </button>

            <button
              className={`SettingsPage-themeButton ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
            >
              <span className="theme-icon">☀️</span>
              <div>
                <div className="label">{t('lightMode')}</div>
                <div className="sublabel">{t('lightModeDesc')}</div>
              </div>
              {theme === 'light' && <span className="check">✓</span>}
            </button>
          </div>
        </div>

        {/* Language Settings */}
        <div className="SettingsPage-section">
          <h2>🌐 {t('language')}</h2>
          <p>{t('selectLanguage')}</p>

          <div className="SettingsPage-languageOptions">
            <button
              className={`SettingsPage-langButton ${language === 'en' ? 'active' : ''}`}
              onClick={() => setLanguage('en')}
            >
              <span className="flag">🇬🇧</span>
              <div>
                <div className="label">{t('english')}</div>
                <div className="sublabel">{t('englishLanguage')}</div>
              </div>
              {language === 'en' && <span className="check">✓</span>}
            </button>

            <button
              className={`SettingsPage-langButton ${language === 'ar' ? 'active' : ''}`}
              onClick={() => setLanguage('ar')}
            >
              <span className="flag">🇸🇦</span>
              <div>
                <div className="label">{t('arabic')}</div>
                <div className="sublabel">{t('arabicLanguage')}</div>
              </div>
              {language === 'ar' && <span className="check">✓</span>}
            </button>
          </div>
        </div>

        {/* Exchange Rate */}
        {hasRole(['admin', 'manager']) && (
          <div className="SettingsPage-section">
            <h2>💱 {t('exchangeRate')}</h2>
            <p>{t('setExchangeRate')}</p>

            <div className="SettingsPage-exchangeRate">
              <div className="SettingsPage-currentRate">
                <div className="label">{t('currentRate')}</div>
                <div className="value">{currentRate.toLocaleString('en-IQ')} IQD</div>
                <div className="sublabel">{t('per1USD')}</div>
              </div>

              <div className="SettingsPage-updateRate">
                <label>{t('updateExchangeRate')}</label>
                <div className="input-group">
                  <NumberInput
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    placeholder={t('enterNewRate')}
                    step="0.01"
                    disabled={rateUpdating}
                  />
                  <button
                    onClick={handleUpdateRate}
                    disabled={rateUpdating || !newRate}
                    className="SettingsPage-updateButton"
                  >
                    {rateUpdating ? t('updating') : t('update')}
                  </button>
                </div>
                {rateSuccess && <div className="SettingsPage-success">{rateSuccess}</div>}
                {rateError && <div className="SettingsPage-error">{rateError}</div>}
              </div>
            </div>
          </div>
        )}

        {/* Margin Calculator */}
        <div className="SettingsPage-section">
          <h2>📊 {t('profitMarginCalculator')}</h2>
          <p>{t('calculateProfitMargins')}</p>

          <div className="SettingsPage-calculator">
            <div className="SettingsPage-calcInputs">
              <div className="SettingsPage-calcField">
                <label>{t('costUSD')}</label>
                <NumberInput
                  value={costUSD}
                  onChange={(e) => setCostUSD(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>

              <div className="SettingsPage-calcField">
                <label>{t('salePriceIQD')}</label>
                <NumberInput
                  value={salePriceIQD}
                  onChange={(e) => setSalePriceIQD(e.target.value)}
                  placeholder="0"
                  step="1"
                />
              </div>
            </div>

            <div className="SettingsPage-calcResults">
              <div className="SettingsPage-calcResult">
                <div className="label">{t('profitMargin')}</div>
                <div className="value">{calculatedMargin}</div>
              </div>

              <div className="SettingsPage-calcResult">
                <div className="label">{t('profitAmount')}</div>
                <div className="value">{calculatedProfit}</div>
              </div>

              <div className="SettingsPage-calcResult">
                <div className="label">{t('exchangeRateUsed')}</div>
                <div className="value">{currentRate.toLocaleString('en-IQ')} IQD</div>
              </div>
            </div>

            <div className="SettingsPage-calcFormula">
              <strong>{t('formula')}:</strong> {t('marginFormula')}
            </div>
          </div>
        </div>

        {/* Email Reports - Configuration Section */}
        {hasRole(['admin']) && (
          <div className="SettingsPage-section">
            <h2>📧 {t('emailReports') || 'Email Reports'}</h2>
            <p>{t('emailReportsDesc') || 'Configure daily Arabic email reports with sales summary, profits, and items sold.'}</p>

            <div className="SettingsPage-emailForm">
              <div className="SettingsPage-emailRow">
                <label>
                  <input
                    type="checkbox"
                    checked={emailEnabled}
                    onChange={(e) => setEmailEnabled(e.target.checked)}
                  />
                  {t('enableEmailReports') || 'Enable Email Reports'}
                </label>
              </div>

              <div className="SettingsPage-emailRow">
                <label>{t('smtpHost') || 'SMTP Host'}</label>
                <input
                  type="text"
                  value={emailHost}
                  onChange={(e) => setEmailHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                />
              </div>

              <div className="SettingsPage-emailRow">
                <label>{t('smtpPort') || 'SMTP Port'}</label>
                <input
                  type="text"
                  value={emailPort}
                  onChange={(e) => setEmailPort(e.target.value)}
                  placeholder="587"
                />
              </div>

              <div className="SettingsPage-emailRow">
                <label>{t('senderEmail') || 'Sender Email'}</label>
                <input
                  type="email"
                  value={emailUser}
                  onChange={(e) => setEmailUser(e.target.value)}
                  placeholder="your-email@gmail.com"
                />
              </div>

              <div className="SettingsPage-emailRow">
                <label>{t('emailPassword') || 'App Password'}</label>
                <input
                  type="password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  placeholder="••••••••••••"
                />
              </div>

              <div className="SettingsPage-emailRow">
                <label>{t('recipientEmail') || 'Recipient Email'}</label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  placeholder="recipient@example.com"
                />
              </div>

              <div className="SettingsPage-emailRow">
                <label>{t('dailySendTime') || 'Daily Send Time'}</label>
                <input
                  type="time"
                  value={emailSendTime}
                  onChange={(e) => setEmailSendTime(e.target.value)}
                />
                <small style={{ color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                  {t('emailSendTimeNote') || 'Email will be sent automatically at this time every day'}
                </small>
              </div>

              {emailMessage && (
                <div className="SettingsPage-emailMessage">{emailMessage}</div>
              )}

              <div className="SettingsPage-emailActions">
                <button
                  className="SettingsPage-saveEmailButton"
                  onClick={handleSaveEmailSettings}
                  disabled={emailSaving}
                >
                  💾 {emailSaving ? (t('saving') || 'Saving...') : (t('saveSettings') || 'Save Settings')}
                </button>
                <button
                  className="SettingsPage-testEmailButton"
                  onClick={handleTestEmail}
                  disabled={emailTesting || !emailUser || !emailRecipient}
                >
                  🚀 {emailTesting ? (t('sending') || 'Sending...') : (t('sendTestEmail') || 'Send Test Email')}
                </button>
              </div>

              <div className="SettingsPage-emailHelp">
                <small>💡 {t('gmailNote') || 'For Gmail: Use an App Password from myaccount.google.com > Security > App Passwords'}</small>
              </div>
            </div>
          </div>
        )}

        {/* Label Settings */}
        <LabelSettingsSection />

        {/* System Reset */}
        {hasRole(['admin']) && (
          <div className="SettingsPage-section">
            <h2>⚠️ {t('dangerZone') || 'Danger Zone'}</h2>
            <p>{t('systemResetDesc') || 'Reset the system to factory defaults. This will delete all data.'}</p>

            <div className="SettingsPage-dangerZone">
              <button
                className="SettingsPage-resetButton"
                onClick={async () => {
                  if (window.confirm('WARNING: This will delete ALL sales, products, customers, and expenses. This action CANNOT be undone.\n\nAre you sure you want to proceed?')) {
                    if (window.confirm('Double Check: Are you absolutely sure? All data will be lost forever.')) {
                      if (!window.evaApi || !token) return;
                      try {
                        await window.evaApi.settings.reset(token);
                        alert('System reset successful. The application will now reload.');
                        window.location.reload();
                      } catch (err) {
                        alert('Failed to reset system: ' + (err instanceof Error ? err.message : String(err)));
                      }
                    }
                  }
                }}
              >
                🗑️ {t('formatSystem') || 'Format System / Reset Everything'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
