import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import LabelSettingsSection from '../components/LabelSettingsSection';
import NumberInput from '../components/NumberInput';
import { confirmDialog } from '../utils/confirmDialog';
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

  // Receipt Settings
  const [receiptStoreName, setReceiptStoreName] = useState('EVA CLOTHING');
  const [receiptFooterText, setReceiptFooterText] = useState('لا يوجد تبديل ولا يوجد استرجاع');
  const [receiptShowLogo, setReceiptShowLogo] = useState(false);
  const [receiptLogoBase64, setReceiptLogoBase64] = useState('');
  const [receiptShowBarcode, setReceiptShowBarcode] = useState(true);
  const [receiptShowCashier, setReceiptShowCashier] = useState(true);
  const [receiptShowCustomer, setReceiptShowCustomer] = useState(true);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [receiptMessage, setReceiptMessage] = useState<string | null>(null);

  // Update Settings
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [downloadProgress, setDownloadProgress] = useState<any>(null);

  useEffect(() => {
    loadExchangeRate();
    loadEmailSettings();
    loadReceiptSettings();
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

  const loadReceiptSettings = async () => {
    if (!window.electronAPI) return;
    try {
      const storeName = await window.electronAPI.getSetting('receipt_store_name');
      const footerText = await window.electronAPI.getSetting('receipt_footer_text');
      const showLogo = await window.electronAPI.getSetting('receipt_show_logo');
      const logoBase64 = await window.electronAPI.getSetting('receipt_logo_base64');
      const showBarcode = await window.electronAPI.getSetting('receipt_show_barcode');
      const showCashier = await window.electronAPI.getSetting('receipt_show_cashier');
      const showCustomer = await window.electronAPI.getSetting('receipt_show_customer');

      if (storeName) setReceiptStoreName(storeName);
      if (footerText) setReceiptFooterText(footerText);
      if (showLogo) setReceiptShowLogo(showLogo === 'true');
      if (logoBase64) setReceiptLogoBase64(logoBase64);
      if (showBarcode) setReceiptShowBarcode(showBarcode !== 'false'); // Default true
      if (showCashier) setReceiptShowCashier(showCashier !== 'false'); // Default true
      if (showCustomer) setReceiptShowCustomer(showCustomer === 'true');
    } catch (err) {
      console.error('Failed to load receipt settings:', err);
    }
  };

  const handleCheckForUpdates = () => {
    if (!window.electronAPI) return;
    setUpdateStatus('checking');
    setUpdateInfo(null);
    window.electronAPI.checkForUpdates().catch(err => {
      setUpdateStatus('error');
      setUpdateInfo(err.message);
    });
  };

  useEffect(() => {
    if (!window.electronAPI) return;

    const removeStatusListener = window.electronAPI.onUpdateStatus((status, info) => {
      console.log('[Update] Status:', status, info);
      setUpdateStatus(status);
      if (info) setUpdateInfo(info);
    });

    const removeProgressListener = window.electronAPI.onDownloadProgress((progress) => {
      setUpdateStatus('downloading');
      setDownloadProgress(progress);
    });

    return () => {
      removeStatusListener();
      removeProgressListener();
    };
  }, []);

  const handleResetDatabase = async () => {
    if (!token) return;
    const confirmed = await confirmDialog(
      'Are you sure you want to reset the database? This action cannot be undone and will delete all data.'
    );

    if (confirmed && window.evaApi) {
      try {
        await window.evaApi.settings.reset(token);
        window.location.reload();
      } catch (err) {
        console.error('Failed to reset database:', err);
        alert('Failed to reset database');
      }
    }
  };

  const handleSaveReceiptSettings = async () => {
    if (!window.electronAPI) return;
    try {
      setReceiptSaving(true);
      setReceiptMessage(null);
      await window.electronAPI.setSetting('receipt_store_name', receiptStoreName);
      await window.electronAPI.setSetting('receipt_footer_text', receiptFooterText);
      await window.electronAPI.setSetting('receipt_show_logo', receiptShowLogo ? 'true' : 'false');
      await window.electronAPI.setSetting('receipt_logo_base64', receiptLogoBase64);
      await window.electronAPI.setSetting('receipt_show_barcode', receiptShowBarcode ? 'true' : 'false');
      await window.electronAPI.setSetting('receipt_show_cashier', receiptShowCashier ? 'true' : 'false');
      await window.electronAPI.setSetting('receipt_show_customer', receiptShowCustomer ? 'true' : 'false');
      setReceiptMessage('✅ ' + (t('receiptSettingsSaved') || 'Receipt settings saved successfully!'));
      setTimeout(() => setReceiptMessage(null), 3000);
    } catch (err) {
      setReceiptMessage('❌ Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setReceiptSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) { // 500KB limit
      alert('Logo file is too large. Please use an image smaller than 500KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setReceiptLogoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
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

        {/* Receipt Settings */}
        {hasRole(['admin', 'manager']) && (
          <div className="SettingsPage-section">
            <h2>🧾 {t('receiptSettings') || 'Receipt Settings'}</h2>
            <p>{t('customizeReceipts') || 'Customize how your sales receipts look'}</p>

            <div className="SettingsPage-receiptForm">
              <div className="SettingsPage-emailRow">
                <label>{t('storeNameOnReceipt') || 'Store Name on Receipt'}</label>
                <input
                  type="text"
                  value={receiptStoreName}
                  onChange={(e) => setReceiptStoreName(e.target.value)}
                  placeholder="EVA CLOTHING"
                />
              </div>

              <div className="SettingsPage-emailRow">
                <label>{t('footerText') || 'Footer Text (Terms & Conditions)'}</label>
                <textarea
                  value={receiptFooterText}
                  onChange={(e) => setReceiptFooterText(e.target.value)}
                  placeholder="لا يوجد تبديل ولا يوجد استرجاع"
                  rows={3}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid rgba(148, 163, 184, 0.25)' }}
                />
              </div>

              <div className="SettingsPage-receiptOptions">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={receiptShowLogo}
                    onChange={(e) => setReceiptShowLogo(e.target.checked)}
                  />
                  {t('showLogo') || 'Show Logo'}
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={receiptShowBarcode}
                    onChange={(e) => setReceiptShowBarcode(e.target.checked)}
                  />
                  {t('showBarcode') || 'Show Barcode'}
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={receiptShowCashier}
                    onChange={(e) => setReceiptShowCashier(e.target.checked)}
                  />
                  {t('showCashier') || 'Show Cashier Name'}
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={receiptShowCustomer}
                    onChange={(e) => setReceiptShowCustomer(e.target.checked)}
                  />
                  {t('showCustomer') || 'Show Customer Name'}
                </label>
              </div>

              {receiptShowLogo && (
                <div className="SettingsPage-logoUpload">
                  <label>{t('uploadLogo') || 'Upload Logo'}</label>
                  <div className="logo-controls">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      id="logo-upload-input"
                      style={{ display: 'none' }}
                    />
                    <button
                      className="SettingsPage-testEmailButton"
                      onClick={() => document.getElementById('logo-upload-input')?.click()}
                      style={{ marginBottom: '1rem' }}
                    >
                      📁 {t('uploadLogo') || 'Upload Logo'}
                    </button>
                    {receiptLogoBase64 && (
                      <div className="logo-preview-container">
                        <p>{t('logoPreview') || 'Logo Preview'}:</p>
                        <img src={receiptLogoBase64} alt="Logo Preview" className="receipt-logo-preview" />
                        <button
                          className="SettingsPage-resetButton"
                          onClick={() => setReceiptLogoBase64('')}
                          style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', marginTop: '0.5rem' }}
                        >
                          🗑️ {t('remove') || 'Remove'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="SettingsPage-section">
                <h2>Database & Maintenance</h2>
                <div className="SettingsPage-card">
                  <div className="SettingsPage-field">
                    <label>Database Reset</label>
                    <div className="SettingsPage-actions">
                      <button
                        className="SettingsPage-button danger"
                        onClick={handleResetDatabase}
                      >
                        ⚠️ Reset Database (Delete All Data)
                      </button>
                    </div>
                    <p className="SettingsPage-hint">
                      This will delete all sales, products, and customers. It cannot be undone.
                    </p>
                  </div>

                  <div className="SettingsPage-divider" />

                  <div className="SettingsPage-field">
                    <label>Software Update</label>
                    <div className="SettingsPage-actions">
                      <button
                        className="SettingsPage-button primary"
                        onClick={handleCheckForUpdates}
                        disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                      >
                        {updateStatus === 'checking' ? 'Checking...' : 'Check for Updates'}
                      </button>
                    </div>

                    {updateStatus && (
                      <div className="UpdateStatus-container" style={{ marginTop: '10px' }}>
                        {updateStatus === 'checking' && <p>Checking GitHub for releases...</p>}
                        {updateStatus === 'available' && (
                          <div className="UpdateStatus-available">
                            <p>✅ <b>Update Available!</b> Version {updateInfo?.version}</p>
                            <p>Downloading automatically...</p>
                          </div>
                        )}
                        {updateStatus === 'not-available' && <p>✅ You are on the latest version.</p>}
                        {updateStatus === 'downloading' && (
                          <div className="UpdateStatus-progress">
                            <p>⬇️ Downloading update... {Math.round(downloadProgress?.percent || 0)}%</p>
                            <div style={{ background: '#eee', height: '8px', borderRadius: '4px', width: '100%', marginTop: '5px' }}>
                              <div style={{
                                background: '#4CAF50',
                                height: '100%',
                                borderRadius: '4px',
                                width: `${downloadProgress?.percent || 0}%`,
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                          </div>
                        )}
                        {updateStatus === 'downloaded' && (
                          <div className="UpdateStatus-ready">
                            <p>🚀 <b>Update Ready!</b> Restart the app to install.</p>
                          </div>
                        )}
                        {updateStatus === 'error' && (
                          <p style={{ color: 'red' }}>❌ Error: {String(updateInfo)}</p>
                        )}
                        {updateStatus === 'dev-mode' && (
                          <p style={{ color: '#888', fontStyle: 'italic' }}>
                            Updates are disabled in Development Mode. Build the app to test updates.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {receiptMessage && (
                <div className="SettingsPage-emailMessage">{receiptMessage}</div>
              )}

              <div className="SettingsPage-emailActions">
                <button
                  className="SettingsPage-saveEmailButton"
                  onClick={handleSaveReceiptSettings}
                  disabled={receiptSaving}
                >
                  💾 {receiptSaving ? (t('saving') || 'Saving...') : (t('saveSettings') || 'Save Settings')}
                </button>
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
                  if (confirmDialog('WARNING: This will delete ALL sales, products, customers, and expenses. This action CANNOT be undone.\n\nAre you sure you want to proceed?')) {
                    if (confirmDialog('Double Check: Are you absolutely sure? All data will be lost forever.')) {
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
