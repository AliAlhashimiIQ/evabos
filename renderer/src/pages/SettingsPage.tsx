import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  Palette,
  Moon,
  Sun,
  Globe,
  RefreshCw,
  Calculator,
  Mail,
  MessageSquare,
  Save,
  Send,
  Lightbulb,
  Receipt,
  Printer,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Download,
  RefreshCcw,
  XCircle,
  Loader2,
  Check,
  UserCheck,
  Sliders,
  DollarSign,
  ShieldAlert,
  Bot,
  Eye,
  EyeOff,
  Copy,
  Sparkles,
  LucideIcon,
  Lock,
  Unlock,
  Key,
} from 'lucide-react';
import LabelSettingsSection from '../components/LabelSettingsSection';
import NumberInput from '../components/NumberInput';
import PortalModal from '../components/PortalModal';
import { confirmDialog } from '../utils/confirmDialog';
import './Pages.css';
import './SettingsPage.css';

type ExchangeRateResponse = import('../types/electron').ExchangeRateResponse;
type SettingsTabId = 'general' | 'financial' | 'notifications' | 'receipts' | 'system';

interface TabItem {
  id: SettingsTabId;
  icon: LucideIcon;
  labelKey: string;
  adminOnly?: boolean;
}

const SETTINGS_TABS: TabItem[] = [
  { id: 'general', icon: Sliders, labelKey: 'settingsTabGeneral' },
  { id: 'financial', icon: DollarSign, labelKey: 'settingsTabFinancial', adminOnly: true },
  { id: 'notifications', icon: MessageSquare, labelKey: 'settingsTabNotifications', adminOnly: true },
  { id: 'receipts', icon: Receipt, labelKey: 'settingsTabReceipts' },
  { id: 'system', icon: ShieldAlert, labelKey: 'settingsTabSystem', adminOnly: true },
];

const SettingsPage = (): JSX.Element => {
  const { token, hasRole, user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<SettingsTabId>('general');

  // POS Preferences
  const [requireEmployeeCheckout, setRequireEmployeeCheckout] = useState(() => {
    return localStorage.getItem('requireEmployeeCheckout') === 'true';
  });

  const handleToggleRequireEmployee = (val: boolean) => {
    setRequireEmployeeCheckout(val);
    localStorage.setItem('requireEmployeeCheckout', String(val));
  };

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
  const [emailSendTime, setEmailSendTime] = useState('20:00');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  // Telegram Bot Settings
  const [telegramToken, setTelegramToken] = useState('');
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramNotifyOnSale, setTelegramNotifyOnSale] = useState(true);
  const [telegramNotifyOnClose, setTelegramNotifyOnClose] = useState(true);
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramTesting, setTelegramTesting] = useState(false);
  const [telegramReporting, setTelegramReporting] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 2FA Security Lock State
  const [isSecurityLocked, setIsSecurityLocked] = useState(true);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

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

  // Printer Configuration
  const [systemPrinters, setSystemPrinters] = useState<Array<{ name: string; isDefault: boolean }>>([]);
  const [receiptPrinterName, setReceiptPrinterName] = useState<string>('');
  const [labelPrinterName, setLabelPrinterName] = useState<string>('');
  const [printerSaving, setPrinterSaving] = useState(false);
  const [printerMessage, setPrinterMessage] = useState<string | null>(null);

  useEffect(() => {
    loadExchangeRate();
    loadReceiptSettings();
    loadPrinterSettings();
    if (token) {
      loadEmailSettings();
      loadTelegramSettings();
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'receipts') {
      loadPrinterSettings();
      loadReceiptSettings();
    } else if (activeTab === 'notifications' && token) {
      loadTelegramSettings();
      loadEmailSettings();
    }
  }, [activeTab, token]);

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

  const loadTelegramSettings = async () => {
    if (!window.evaApi || !token) return;
    try {
      const settings = await window.evaApi.telegram.getSettings(token);
      if (settings) {
        setTelegramToken(settings.botToken || '');
        setTelegramChatId(settings.chatId || '');
        setTelegramEnabled(settings.enabled ?? false);
        setTelegramNotifyOnSale(settings.notifyOnSale ?? true);
        setTelegramNotifyOnClose(settings.notifyOnClose ?? true);

        // Check if security is unlocked
        const isUnlocked = await window.evaApi.telegram.isUnlocked(token);
        setIsSecurityLocked(!isUnlocked);
      }
    } catch (err) {
      console.error('Failed to load telegram settings:', err);
    }
  };

  const handleRequestOtp = async () => {
    if (!window.evaApi || !token) return;
    try {
      setOtpLoading(true);
      setOtpError(null);
      const res = await window.evaApi.telegram.requestUnlockOtp(token);
      if (res.success) {
        setShowOtpModal(true);
      } else {
        setTelegramMessage(res.error || t('unlockFailed'));
      }
    } catch (err: any) {
      setTelegramMessage(err.message || 'Failed to request code');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!window.evaApi || !token || !otpCode) return;
    try {
      setOtpLoading(true);
      setOtpError(null);
      const res = await window.evaApi.telegram.verifyUnlockOtp(token, otpCode);
      if (res.success) {
        setIsSecurityLocked(false);
        setShowOtpModal(false);
        setOtpCode('');
        setTelegramMessage(t('unlockSuccess'));
        setTimeout(() => setTelegramMessage(null), 3000);
      } else {
        setOtpError(res.error || t('unlockFailed'));
      }
    } catch (err: any) {
      setOtpError(err.message || 'Verification failed');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleLockAgain = async () => {
    if (!window.evaApi || !token) return;
    await window.evaApi.telegram.lock(token);
    setIsSecurityLocked(true);
    setTelegramMessage(t('securityLocked'));
    setTimeout(() => setTelegramMessage(null), 3000);
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
      if (showBarcode) setReceiptShowBarcode(showBarcode !== 'false');
      if (showCashier) setReceiptShowCashier(showCashier !== 'false');
      if (showCustomer) setReceiptShowCustomer(showCustomer === 'true');
    } catch (err) {
      console.error('Failed to load receipt settings:', err);
    }
  };

  const loadPrinterSettings = async () => {
    if (!window.evaApi || !window.electronAPI) return;
    try {
      const list = await window.evaApi.printing.getPrinters();
      if (list) setSystemPrinters(list);
      const savedReceipt = await window.electronAPI.getSetting('receipt_printer_name');
      const savedLabel = await window.electronAPI.getSetting('label_printer_name');
      if (savedReceipt) setReceiptPrinterName(savedReceipt);
      if (savedLabel) setLabelPrinterName(savedLabel);
    } catch (err) {
      console.error('Failed to load printer settings:', err);
    }
  };

  const handleSavePrinterSettings = async () => {
    if (!window.electronAPI) return;
    try {
      setPrinterSaving(true);
      setPrinterMessage(null);
      await window.electronAPI.setSetting('receipt_printer_name', receiptPrinterName);
      await window.electronAPI.setSetting('label_printer_name', labelPrinterName);
      setPrinterMessage(t('printerSettingsSaved'));
      setTimeout(() => setPrinterMessage(null), 3000);
    } catch (err) {
      setPrinterMessage('Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setPrinterSaving(false);
    }
  };

  const handleCheckForUpdates = () => {
    if (!window.electronAPI) return;
    setUpdateStatus('checking');
    setUpdateInfo(null);
    window.electronAPI.checkForUpdates().catch((err: any) => {
      setUpdateStatus('error');
      setUpdateInfo(err.message);
    });
  };

  useEffect(() => {
    if (!window.electronAPI) return;

    const removeStatusListener = window.electronAPI.onUpdateStatus((status: string, info: any) => {
      setUpdateStatus(status);
      if (info) setUpdateInfo(info);
    });

    const removeProgressListener = window.electronAPI.onDownloadProgress((progress: any) => {
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
    const confirmed = await confirmDialog({
      message: t('resetDatabaseHint') || 'Are you sure you want to reset the database? This action cannot be undone and will delete all data.',
      variant: 'danger',
      confirmText: t('resetDatabaseButton') || 'Reset Database',
    });

    if (confirmed && window.evaApi) {
      try {
        await window.evaApi.settings.reset(token);
        window.location.reload();
      } catch (err) {
        console.error('Failed to reset database:', err);
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
      setReceiptMessage(t('receiptSettingsSaved') || 'Receipt settings saved successfully!');
      setTimeout(() => setReceiptMessage(null), 3000);
    } catch (err) {
      setReceiptMessage('Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setReceiptSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
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
      setEmailMessage(t('emailSettingsSaved') || 'Email settings saved successfully!');
      setTimeout(() => setEmailMessage(null), 3000);
    } catch (err) {
      setEmailMessage('Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setEmailSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!window.evaApi || !token) return;
    try {
      setEmailTesting(true);
      setEmailMessage(null);
      const result = (await window.evaApi.email.sendTest(token)) as { success: boolean; error?: string };
      if (result.success) {
        setEmailMessage(t('testEmailSuccess') || 'Test email sent! Check your inbox.');
      } else {
        setEmailMessage(result.error || t('testEmailFailed') || 'Email not sent. Please check settings.');
      }
    } catch (err) {
      setEmailMessage('Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setEmailTesting(false);
    }
  };

  const handleSaveTelegramSettings = async () => {
    if (!window.evaApi || !token) return;
    try {
      setTelegramSaving(true);
      setTelegramMessage(null);
      await window.evaApi.telegram.saveSettings(token, {
        botToken: telegramToken,
        chatId: telegramChatId,
        enabled: telegramEnabled,
        notifyOnSale: telegramNotifyOnSale,
        notifyOnClose: telegramNotifyOnClose,
      });
      setTelegramMessage(t('telegramSettingsSaved') || 'Telegram settings saved successfully!');
      setTimeout(() => setTelegramMessage(null), 3000);
    } catch (err) {
      setTelegramMessage('Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setTelegramSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!window.evaApi || !token) return;
    try {
      setTelegramTesting(true);
      setTelegramMessage(null);
      await window.evaApi.telegram.saveSettings(token, {
        botToken: telegramToken,
        chatId: telegramChatId,
        enabled: telegramEnabled,
        notifyOnSale: telegramNotifyOnSale,
        notifyOnClose: telegramNotifyOnClose,
      });
      const result = (await window.evaApi.telegram.sendTest(token)) as { success: boolean; error?: string };
      if (result.success) {
        setTelegramMessage(t('testTelegramSuccess') || 'Test message sent! Check your Telegram.');
      } else {
        setTelegramMessage(result.error || t('testTelegramFailed') || 'Failed to send test message.');
      }
    } catch (err) {
      setTelegramMessage('Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setTelegramTesting(false);
    }
  };

  const handleSendDailyReportNow = async () => {
    if (!window.evaApi || !token) return;
    try {
      setTelegramReporting(true);
      setTelegramMessage(null);
      const result = (await window.evaApi.telegram.sendDailyReportNow(token)) as { success: boolean; error?: string };
      if (result.success) {
        setTelegramMessage(t('telegramReportSent') || 'Daily report and database backup sent to Telegram!');
      } else {
        setTelegramMessage(result.error || 'Failed to send report & backup to Telegram.');
      }
    } catch (err) {
      setTelegramMessage('Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setTelegramReporting(false);
    }
  };

  const handleUpdateRate = async (customRate?: number) => {
    if (!window.evaApi || !token) return;
    const rateToSet = customRate ?? parseFloat(newRate);
    if (isNaN(rateToSet) || rateToSet <= 0) {
      setRateError(t('pleaseEnterValidRate'));
      return;
    }

    try {
      setRateUpdating(true);
      setRateError(null);
      setRateSuccess(null);
      await window.evaApi.exchangeRates.update(token, { rate: rateToSet });
      setCurrentRate(rateToSet);
      setNewRate('');
      setRateSuccess(t('exchangeRateUpdated'));
      setTimeout(() => setRateSuccess(null), 3000);
    } catch (err) {
      setRateError(err instanceof Error ? err.message : t('failedToUpdateRate'));
    } finally {
      setRateUpdating(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
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
    const margin = ((profit / costInIQD) * 100).toFixed(1);

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
      {/* ── Page Header ───────────────────────────────────── */}
      <div className="SettingsPage-header">
        <div className="SettingsPage-headerTitle">
          <h1>
            <Sliders size={22} style={{ color: 'var(--accent-primary, #6366f1)' }} />
            {t('settings')}
          </h1>
          <p>{t('configureSystem')}</p>
        </div>

        {user && (
          <div className="SettingsPage-badge">
            <UserCheck size={14} />
            <span>{user.role ? user.role.toUpperCase() : 'USER'}</span>
          </div>
        )}
      </div>

      {/* ── Tab Navigation Bar ─────────────────────────────── */}
      <div className="SettingsPage-tabs">
        {SETTINGS_TABS.filter((tab) => !tab.adminOnly || hasRole(['admin', 'manager'])).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`SettingsPage-tabButton ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={18} />
              <span>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab Content Container ─────────────────────────── */}
      <div className="SettingsPage-content">
        {/* 1. GENERAL & APPEARANCE TAB */}
        {activeTab === 'general' && (
          <>
            {/* Theme Card */}
            <div className="SettingsPage-card">
              <div className="SettingsPage-cardHeader">
                <div className="SettingsPage-cardHeaderLeft">
                  <div className="SettingsPage-cardHeaderIcon">
                    <Palette size={20} />
                  </div>
                  <div className="SettingsPage-cardHeaderTitle">
                    <h2>{t('theme')}</h2>
                    <p>{t('selectTheme')}</p>
                  </div>
                </div>
              </div>

              <div className="SettingsPage-optionGrid">
                <div
                  className={`SettingsPage-optionCard ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setTheme('dark')}
                >
                  <div className="SettingsPage-optionIcon">
                    <Moon size={22} />
                  </div>
                  <div>
                    <div className="SettingsPage-optionLabel">{t('darkMode')}</div>
                    <div className="SettingsPage-optionDesc">{t('darkModeDesc')}</div>
                  </div>
                  {theme === 'dark' && <Check size={20} className="SettingsPage-optionCheck" />}
                </div>

                <div
                  className={`SettingsPage-optionCard ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => setTheme('light')}
                >
                  <div className="SettingsPage-optionIcon">
                    <Sun size={22} />
                  </div>
                  <div>
                    <div className="SettingsPage-optionLabel">{t('lightMode')}</div>
                    <div className="SettingsPage-optionDesc">{t('lightModeDesc')}</div>
                  </div>
                  {theme === 'light' && <Check size={20} className="SettingsPage-optionCheck" />}
                </div>
              </div>
            </div>

            {/* Language Card */}
            <div className="SettingsPage-card">
              <div className="SettingsPage-cardHeader">
                <div className="SettingsPage-cardHeaderLeft">
                  <div className="SettingsPage-cardHeaderIcon">
                    <Globe size={20} />
                  </div>
                  <div className="SettingsPage-cardHeaderTitle">
                    <h2>{t('language')}</h2>
                    <p>{t('selectLanguage')}</p>
                  </div>
                </div>
              </div>

              <div className="SettingsPage-optionGrid">
                <div
                  className={`SettingsPage-optionCard ${language === 'ar' ? 'active' : ''}`}
                  onClick={() => setLanguage('ar')}
                >
                  <div className="SettingsPage-optionIcon">
                    <span>🇮🇶</span>
                  </div>
                  <div>
                    <div className="SettingsPage-optionLabel">{t('arabic')}</div>
                    <div className="SettingsPage-optionDesc">{t('arabicLanguage')}</div>
                  </div>
                  {language === 'ar' && <Check size={20} className="SettingsPage-optionCheck" />}
                </div>

                <div
                  className={`SettingsPage-optionCard ${language === 'en' ? 'active' : ''}`}
                  onClick={() => setLanguage('en')}
                >
                  <div className="SettingsPage-optionIcon">
                    <span>🇬🇧</span>
                  </div>
                  <div>
                    <div className="SettingsPage-optionLabel">{t('english')}</div>
                    <div className="SettingsPage-optionDesc">{t('englishLanguage')}</div>
                  </div>
                  {language === 'en' && <Check size={20} className="SettingsPage-optionCheck" />}
                </div>
              </div>
            </div>

            {/* POS Checkout Rules Card */}
            <div className="SettingsPage-card">
              <div className="SettingsPage-cardHeader">
                <div className="SettingsPage-cardHeaderLeft">
                  <div className="SettingsPage-cardHeaderIcon">
                    <UserCheck size={20} />
                  </div>
                  <div className="SettingsPage-cardHeaderTitle">
                    <h2>{t('posPreferences') || 'POS Checkout Rules'}</h2>
                    <p>{t('posPreferencesDesc') || 'Customize checkout validations and cashier requirements'}</p>
                  </div>
                </div>
              </div>

              <div
                className="SettingsPage-switchRow"
                onClick={() => handleToggleRequireEmployee(!requireEmployeeCheckout)}
              >
                <div className="SettingsPage-switchInfo">
                  <strong>{t('requireEmployeeLabel') || 'Require Employee Selection'}</strong>
                  <span>{t('requireEmployeeDesc') || 'Prevent completing sales if no sales employee is selected'}</span>
                </div>
                <label className="SettingsPage-switch" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={requireEmployeeCheckout}
                    onChange={(e) => handleToggleRequireEmployee(e.target.checked)}
                  />
                  <span className="SettingsPage-slider" />
                </label>
              </div>
            </div>
          </>
        )}

        {/* 2. FINANCIAL & CURRENCY TAB */}
        {activeTab === 'financial' && hasRole(['admin', 'manager']) && (
          <>
            {/* Exchange Rate Card */}
            <div className="SettingsPage-card">
              <div className="SettingsPage-cardHeader">
                <div className="SettingsPage-cardHeaderLeft">
                  <div className="SettingsPage-cardHeaderIcon">
                    <RefreshCw size={20} />
                  </div>
                  <div className="SettingsPage-cardHeaderTitle">
                    <h2>{t('exchangeRate')}</h2>
                    <p>{t('setExchangeRate')}</p>
                  </div>
                </div>
              </div>

              <div className="SettingsPage-rateLayout">
                <div className="SettingsPage-rateDisplay">
                  <div className="rate-label">{t('currentRate')}</div>
                  <div className="rate-value">{currentRate.toLocaleString('en-IQ')} IQD</div>
                  <div className="rate-sublabel">{t('per1USD')}</div>
                </div>

                <div className="SettingsPage-form">
                  <div className="SettingsPage-formRow">
                    <label>{t('updateExchangeRate')}</label>
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                      <NumberInput
                        value={newRate}
                        onChange={(e) => setNewRate(e.target.value)}
                        placeholder={t('enterNewRate')}
                        step="0.01"
                        disabled={rateUpdating}
                      />
                      <button
                        onClick={() => handleUpdateRate()}
                        disabled={rateUpdating || !newRate}
                        className="SettingsPage-btn primary"
                        style={{ flexShrink: 0 }}
                      >
                        {rateUpdating ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
                        {rateUpdating ? t('updating') : t('update')}
                      </button>
                    </div>

                    {/* Quick rate presets */}
                    <div className="SettingsPage-quickPresets">
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('quickExchangePresets')}:</span>
                      {[1480, 1500, 1510, 1520, 1530].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          className="SettingsPage-presetPill"
                          onClick={() => handleUpdateRate(rate)}
                        >
                          {rate.toLocaleString('en-IQ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {rateSuccess && (
                    <div className="SettingsPage-message success">
                      <CheckCircle2 size={16} />
                      {rateSuccess}
                    </div>
                  )}

                  {rateError && (
                    <div className="SettingsPage-message error">
                      <XCircle size={16} />
                      {rateError}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Profit Margin Calculator Card */}
            <div className="SettingsPage-card">
              <div className="SettingsPage-cardHeader">
                <div className="SettingsPage-cardHeaderLeft">
                  <div className="SettingsPage-cardHeaderIcon">
                    <Calculator size={20} />
                  </div>
                  <div className="SettingsPage-cardHeaderTitle">
                    <h2>{t('marginCalculator')}</h2>
                    <p>{t('calculateMarginDesc')}</p>
                  </div>
                </div>
              </div>

              <div className="SettingsPage-formGrid">
                <div className="SettingsPage-formRow">
                  <label>{t('costPriceUSD')} ($)</label>
                  <NumberInput
                    value={costUSD}
                    onChange={(e) => setCostUSD(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>

                <div className="SettingsPage-formRow">
                  <label>{t('salePriceIQD')} (IQD)</label>
                  <NumberInput
                    value={salePriceIQD}
                    onChange={(e) => setSalePriceIQD(e.target.value)}
                    placeholder="0"
                    step="250"
                  />
                </div>
              </div>

              <div className="SettingsPage-calcResults">
                <div className="SettingsPage-calcResultItem">
                  <span className="res-label">{t('profitMargin')}</span>
                  <span className="res-value" style={{ color: calculatedMargin !== '—' && parseFloat(calculatedMargin) >= 20 ? '#10b981' : '#f59e0b' }}>
                    {calculatedMargin}
                  </span>
                </div>
                <div className="SettingsPage-calcResultItem">
                  <span className="res-label">{t('expectedProfit')}</span>
                  <span className="res-value">{calculatedProfit}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 3. NOTIFICATIONS & CLOUD TAB */}
        {activeTab === 'notifications' && hasRole(['admin', 'manager']) && (
          <>
            {/* 2FA Security Banner */}
            {isSecurityLocked ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  padding: '1.1rem 1.35rem',
                  borderRadius: '0.75rem',
                  marginBottom: '1.25rem',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: 'rgba(239, 68, 68, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ef4444',
                      flexShrink: 0,
                    }}
                  >
                    <Lock size={22} />
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.98rem', color: 'var(--text-primary)', marginBottom: '3px' }}>
                      {t('securityLocked')}
                    </strong>
                    <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      {t('securityLockedDesc')}
                    </span>
                  </div>
                </div>

                <button
                  className="SettingsPage-btn primary"
                  style={{ background: '#ef4444', borderColor: '#ef4444', whiteSpace: 'nowrap' }}
                  onClick={handleRequestOtp}
                  disabled={otpLoading}
                >
                  {otpLoading ? <Loader2 size={16} className="spin" /> : <Key size={16} />}
                  {otpLoading ? (t('loading') || '...') : t('requestUnlockCode')}
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  padding: '1.1rem 1.35rem',
                  borderRadius: '0.75rem',
                  marginBottom: '1.25rem',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: 'rgba(16, 185, 129, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10b981',
                      flexShrink: 0,
                    }}
                  >
                    <Unlock size={22} />
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.98rem', color: 'var(--text-primary)', marginBottom: '3px' }}>
                      {t('unlockedSession')}
                    </strong>
                    <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      {t('unlockSuccess')}
                    </span>
                  </div>
                </div>

                <button className="SettingsPage-btn secondary" onClick={handleLockAgain} style={{ whiteSpace: 'nowrap' }}>
                  <Lock size={16} />
                  {t('lockAgain')}
                </button>
              </div>
            )}

            {/* Telegram Bot Card */}
            <div className="SettingsPage-card" style={{ opacity: isSecurityLocked ? 0.85 : 1 }}>
              <div className="SettingsPage-cardHeader">
                <div className="SettingsPage-cardHeaderLeft">
                  <div className="SettingsPage-cardHeaderIcon" style={{ color: '#0088cc', background: 'rgba(0, 136, 204, 0.12)' }}>
                    <Bot size={22} />
                  </div>
                  <div className="SettingsPage-cardHeaderTitle">
                    <h2>{t('telegramBot')}</h2>
                    <p>{t('telegramBotDesc')}</p>
                  </div>
                </div>

                <div className={`SettingsPage-statusPill ${telegramEnabled && telegramToken && telegramChatId ? 'active' : 'inactive'}`}>
                  <span className="SettingsPage-statusDot" />
                  <span>
                    {telegramEnabled && telegramToken && telegramChatId
                      ? t('telegramStatusActive')
                      : telegramToken && telegramChatId
                      ? t('telegramStatusDisabled')
                      : t('telegramStatusNotConfigured')}
                  </span>
                </div>
              </div>

              <div className="SettingsPage-form">
                <div
                  className="SettingsPage-switchRow"
                  onClick={() => !isSecurityLocked && setTelegramEnabled(!telegramEnabled)}
                  style={{ cursor: isSecurityLocked ? 'not-allowed' : 'pointer' }}
                >
                  <div className="SettingsPage-switchInfo">
                    <strong>{t('enableTelegramBot')}</strong>
                    <span>{t('telegramBotDesc')}</span>
                  </div>
                  <label className="SettingsPage-switch" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={telegramEnabled}
                      onChange={(e) => setTelegramEnabled(e.target.checked)}
                      disabled={isSecurityLocked}
                    />
                    <span className="SettingsPage-slider" />
                  </label>
                </div>

                <div className="SettingsPage-formGrid">
                  <div className="SettingsPage-formRow">
                    <label>{t('telegramBotToken')}</label>
                    <div className="SettingsPage-inputWrapper">
                      <input
                        type={showTelegramToken ? 'text' : 'password'}
                        value={telegramToken}
                        onChange={(e) => setTelegramToken(e.target.value)}
                        placeholder="8853788294:AAH1-1l0iC1s19ZZLbJeNKOCU_YKEXezVYM"
                        style={{ fontFamily: 'monospace' }}
                        disabled={isSecurityLocked}
                      />
                      <button
                        type="button"
                        className="SettingsPage-inputAction"
                        onClick={() => setShowTelegramToken(!showTelegramToken)}
                        title={showTelegramToken ? 'Hide token' : 'Show token'}
                      >
                        {showTelegramToken ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="SettingsPage-formRow">
                    <label>{t('telegramChatId')}</label>
                    <div className="SettingsPage-inputWrapper">
                      <input
                        type="text"
                        value={telegramChatId}
                        onChange={(e) => setTelegramChatId(e.target.value)}
                        placeholder="e.g. 123456789"
                        style={{ fontFamily: 'monospace' }}
                        disabled={isSecurityLocked}
                      />
                      {telegramChatId && (
                        <button
                          type="button"
                          className="SettingsPage-inputAction"
                          onClick={() => copyToClipboard(telegramChatId, 'chatId')}
                          title="Copy Chat ID"
                        >
                          {copiedKey === 'chatId' ? <Check size={16} style={{ color: '#10b981' }} /> : <Copy size={16} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Triggers */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div
                    className="SettingsPage-switchRow"
                    onClick={() => !isSecurityLocked && setTelegramNotifyOnSale(!telegramNotifyOnSale)}
                    style={{ cursor: isSecurityLocked ? 'not-allowed' : 'pointer' }}
                  >
                    <div className="SettingsPage-switchInfo">
                      <strong>{t('telegramNotifyOnSale')}</strong>
                      <span>{t('telegramNotifyOnSaleDesc')}</span>
                    </div>
                    <label className="SettingsPage-switch" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={telegramNotifyOnSale}
                        onChange={(e) => setTelegramNotifyOnSale(e.target.checked)}
                        disabled={isSecurityLocked}
                      />
                      <span className="SettingsPage-slider" />
                    </label>
                  </div>

                  <div
                    className="SettingsPage-switchRow"
                    onClick={() => !isSecurityLocked && setTelegramNotifyOnClose(!telegramNotifyOnClose)}
                    style={{ cursor: isSecurityLocked ? 'not-allowed' : 'pointer' }}
                  >
                    <div className="SettingsPage-switchInfo">
                      <strong>{t('telegramNotifyOnClose')}</strong>
                      <span>{t('telegramNotifyOnCloseDesc')}</span>
                    </div>
                    <label className="SettingsPage-switch" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={telegramNotifyOnClose}
                        onChange={(e) => setTelegramNotifyOnClose(e.target.checked)}
                        disabled={isSecurityLocked}
                      />
                      <span className="SettingsPage-slider" />
                    </label>
                  </div>
                </div>

                {telegramMessage && (
                  <div className={`SettingsPage-message ${telegramMessage.includes('Error') || telegramMessage.includes('Failed') || telegramMessage.includes('فشل') ? 'error' : 'success'}`}>
                    {telegramMessage.includes('Error') || telegramMessage.includes('Failed') || telegramMessage.includes('فشل') ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                    <span>{telegramMessage}</span>
                  </div>
                )}

                <div className="SettingsPage-actions">
                  <button
                    className="SettingsPage-btn primary"
                    onClick={handleSaveTelegramSettings}
                    disabled={telegramSaving || isSecurityLocked}
                  >
                    {telegramSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                    {telegramSaving ? (t('saving') || 'Saving...') : t('saveSettings')}
                  </button>

                  <button
                    className="SettingsPage-btn secondary"
                    onClick={handleTestTelegram}
                    disabled={telegramTesting || !telegramToken || !telegramChatId}
                  >
                    {telegramTesting ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                    {telegramTesting ? (t('sending') || 'Sending...') : t('sendTestMessage')}
                  </button>

                  <button
                    className="SettingsPage-btn secondary"
                    onClick={handleSendDailyReportNow}
                    disabled={telegramReporting || !telegramToken || !telegramChatId}
                  >
                    {telegramReporting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                    {telegramReporting ? (t('sending') || 'Sending...') : t('sendReportNow')}
                  </button>
                </div>

                <div className="SettingsPage-infoBox" style={{ marginTop: '0.5rem' }}>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    <Lightbulb size={15} style={{ verticalAlign: 'middle', marginInlineEnd: '4px' }} />
                    {t('telegramHelpTitle')}
                  </strong>
                  <div>{t('telegramStep1')}</div>
                  <div>{t('telegramStep2')}</div>
                  <div>{t('telegramStep3')}</div>
                </div>
              </div>
            </div>

            {/* Email Reports Card */}
            <div className="SettingsPage-card" style={{ opacity: isSecurityLocked ? 0.85 : 1 }}>
              <div className="SettingsPage-cardHeader">
                <div className="SettingsPage-cardHeaderLeft">
                  <div className="SettingsPage-cardHeaderIcon">
                    <Mail size={20} />
                  </div>
                  <div className="SettingsPage-cardHeaderTitle">
                    <h2>{t('emailReports')}</h2>
                    <p>{t('emailReportsDesc')}</p>
                  </div>
                </div>
              </div>

              <div className="SettingsPage-form">
                <div
                  className="SettingsPage-switchRow"
                  onClick={() => !isSecurityLocked && setEmailEnabled(!emailEnabled)}
                  style={{ cursor: isSecurityLocked ? 'not-allowed' : 'pointer' }}
                >
                  <div className="SettingsPage-switchInfo">
                    <strong>{t('enableEmailReports')}</strong>
                    <span>{t('emailReportsDesc')}</span>
                  </div>
                  <label className="SettingsPage-switch" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={emailEnabled}
                      onChange={(e) => setEmailEnabled(e.target.checked)}
                      disabled={isSecurityLocked}
                    />
                    <span className="SettingsPage-slider" />
                  </label>
                </div>

                <div className="SettingsPage-formGrid">
                  <div className="SettingsPage-formRow">
                    <label>{t('smtpHost')}</label>
                    <input
                      type="text"
                      value={emailHost}
                      onChange={(e) => setEmailHost(e.target.value)}
                      placeholder="smtp.gmail.com"
                      disabled={isSecurityLocked}
                    />
                  </div>

                  <div className="SettingsPage-formRow">
                    <label>{t('smtpPort')}</label>
                    <input
                      type="text"
                      value={emailPort}
                      onChange={(e) => setEmailPort(e.target.value)}
                      placeholder="587"
                      disabled={isSecurityLocked}
                    />
                  </div>

                  <div className="SettingsPage-formRow">
                    <label>{t('senderEmail')}</label>
                    <input
                      type="email"
                      value={emailUser}
                      onChange={(e) => setEmailUser(e.target.value)}
                      placeholder="your-email@gmail.com"
                      disabled={isSecurityLocked}
                    />
                  </div>

                  <div className="SettingsPage-formRow">
                    <label>{t('emailPassword')}</label>
                    <input
                      type="password"
                      value={emailPassword}
                      onChange={(e) => setEmailPassword(e.target.value)}
                      placeholder="••••••••••••"
                      disabled={isSecurityLocked}
                    />
                  </div>

                  <div className="SettingsPage-formRow">
                    <label>{t('recipientEmail')}</label>
                    <input
                      type="email"
                      value={emailRecipient}
                      onChange={(e) => setEmailRecipient(e.target.value)}
                      placeholder="recipient@example.com"
                      disabled={isSecurityLocked}
                    />
                  </div>

                  <div className="SettingsPage-formRow">
                    <label>{t('dailySendTime')}</label>
                    <input
                      type="time"
                      value={emailSendTime}
                      onChange={(e) => setEmailSendTime(e.target.value)}
                      disabled={isSecurityLocked}
                    />
                  </div>
                </div>

                {emailMessage && (
                  <div className={`SettingsPage-message ${emailMessage.includes('Error') || emailMessage.includes('Failed') ? 'error' : 'success'}`}>
                    {emailMessage.includes('Error') || emailMessage.includes('Failed') ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                    <span>{emailMessage}</span>
                  </div>
                )}

                <div className="SettingsPage-actions">
                  <button
                    className="SettingsPage-btn primary"
                    onClick={handleSaveEmailSettings}
                    disabled={emailSaving || isSecurityLocked}
                  >
                    {emailSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                    {emailSaving ? (t('saving') || 'Saving...') : t('saveSettings')}
                  </button>

                  <button
                    className="SettingsPage-btn secondary"
                    onClick={handleTestEmail}
                    disabled={emailTesting || !emailUser || !emailRecipient}
                  >
                    {emailTesting ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                    {emailTesting ? (t('sending') || 'Sending...') : t('sendTestEmail')}
                  </button>
                </div>
              </div>
            </div>

            {/* 2FA OTP Verification Modal */}
            {showOtpModal && (
              <PortalModal onClose={() => setShowOtpModal(false)}>
                <div style={{ width: '100%', maxWidth: '420px', padding: '1.75rem', textAlign: 'center' }}>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      background: 'rgba(59, 130, 246, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1rem',
                      color: '#3b82f6',
                    }}
                  >
                    <Key size={28} />
                  </div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    {t('enterOtpCode')}
                  </h2>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                    {t('unlockCodeSent')}
                  </p>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="• • • • • •"
                    style={{
                      width: '100%',
                      height: '52px',
                      fontSize: '1.75rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      letterSpacing: '0.5rem',
                      borderRadius: '0.75rem',
                      border: '2px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      marginBottom: '1rem',
                      fontFamily: 'monospace',
                    }}
                    autoFocus
                  />
                  {otpError && (
                    <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
                      {otpError}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      className="SettingsPage-btn secondary"
                      style={{ flex: 1 }}
                      onClick={() => setShowOtpModal(false)}
                    >
                      {t('cancel')}
                    </button>
                    <button
                      className="SettingsPage-btn primary"
                      style={{ flex: 1 }}
                      onClick={handleVerifyOtp}
                      disabled={otpLoading || otpCode.length < 4}
                    >
                      {otpLoading ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                      {t('verifyAndUnlock')}
                    </button>
                  </div>
                </div>
              </PortalModal>
            )}
          </>
        )}

        {/* 4. RECEIPTS & LABELS TAB */}
        {activeTab === 'receipts' && (
          <>
            {/* Dedicated Printers Configuration */}
            {hasRole(['admin', 'manager']) && (
              <div className="SettingsPage-card">
                <div className="SettingsPage-cardHeader">
                  <div className="SettingsPage-cardHeaderLeft">
                    <div className="SettingsPage-cardHeaderIcon">
                      <Printer size={20} />
                    </div>
                    <div className="SettingsPage-cardHeaderTitle">
                      <h2>{t('printerSettings') || 'إعدادات الطابعات المخصصة'}</h2>
                      <p>{t('printerSettingsDesc') || 'حدد طابعة منفصلة للفواتير وطابعة منفصلة لملصقات الباركود دون الحاجة لتغيير طابعة الويندوز الافتراضية'}</p>
                    </div>
                  </div>
                </div>

                <div className="SettingsPage-form">
                  <div className="SettingsPage-formGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                    <div className="SettingsPage-formRow">
                      <label>{t('defaultReceiptPrinter') || 'طابعة الإيصالات والفواتير (Receipt Printer)'}</label>
                      <select
                        value={receiptPrinterName}
                        onChange={(e) => setReceiptPrinterName(e.target.value)}
                        className="SettingsPage-select"
                        style={{
                          height: '38px',
                          padding: '0 0.85rem',
                          borderRadius: '0.55rem',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          width: '100%',
                        }}
                      >
                        <option value="">{t('systemDefault') || 'طابعة الويندوز الافتراضية (System Default)'}</option>
                        {systemPrinters.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name} {p.isDefault ? `(${t('default') || 'Default'})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="SettingsPage-formRow">
                      <label>{t('defaultLabelPrinter') || 'طابعة ملصقات الباركود (Barcode Label Printer)'}</label>
                      <select
                        value={labelPrinterName}
                        onChange={(e) => setLabelPrinterName(e.target.value)}
                        className="SettingsPage-select"
                        style={{
                          height: '38px',
                          padding: '0 0.85rem',
                          borderRadius: '0.55rem',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          width: '100%',
                        }}
                      >
                        <option value="">{t('systemDefault') || 'طابعة الويندوز الافتراضية (System Default)'}</option>
                        {systemPrinters.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name} {p.isDefault ? `(${t('default') || 'Default'})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {printerMessage && (
                    <div className={`SettingsPage-message ${printerMessage.includes('Error') ? 'error' : 'success'}`}>
                      {printerMessage.includes('Error') ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                      <span>{printerMessage}</span>
                    </div>
                  )}

                  <div className="SettingsPage-actions" style={{ marginTop: '0.75rem' }}>
                    <button
                      className="SettingsPage-btn primary"
                      onClick={handleSavePrinterSettings}
                      disabled={printerSaving}
                    >
                      {printerSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                      {printerSaving ? (t('saving') || 'جاري الحفظ...') : (t('saveSettings') || 'حفظ إعدادات الطابعات')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Live Side-by-Side Receipt Customizer */}
            {hasRole(['admin', 'manager']) && (
              <div className="SettingsPage-card">
                <div className="SettingsPage-cardHeader">
                  <div className="SettingsPage-cardHeaderLeft">
                    <div className="SettingsPage-cardHeaderIcon">
                      <Receipt size={20} />
                    </div>
                    <div className="SettingsPage-cardHeaderTitle">
                      <h2>{t('receiptSettings') || 'Receipt Customization'}</h2>
                      <p>{t('customizeReceipts') || 'Configure store branding, logo, and return terms with live preview'}</p>
                    </div>
                  </div>
                </div>

                <div className="SettingsPage-receiptLayout">
                  {/* Form Controls */}
                  <div className="SettingsPage-form">
                    <div className="SettingsPage-formRow">
                      <label>{t('storeNameOnReceipt') || 'Store Name on Receipt'}</label>
                      <input
                        type="text"
                        value={receiptStoreName}
                        onChange={(e) => setReceiptStoreName(e.target.value)}
                        placeholder="EVA CLOTHING"
                      />
                    </div>

                    <div className="SettingsPage-formRow">
                      <label>{t('footerText') || 'Footer Return Policy / Terms'}</label>
                      <textarea
                        value={receiptFooterText}
                        onChange={(e) => setReceiptFooterText(e.target.value)}
                        placeholder="لا يوجد تبديل ولا يوجد استرجاع"
                        rows={3}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <div
                        className="SettingsPage-switchRow"
                        onClick={() => setReceiptShowLogo(!receiptShowLogo)}
                      >
                        <div className="SettingsPage-switchInfo">
                          <strong>{t('showLogo') || 'Show Logo'}</strong>
                          <span>{t('showLogoDesc')}</span>
                        </div>
                        <label className="SettingsPage-switch" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={receiptShowLogo}
                            onChange={(e) => setReceiptShowLogo(e.target.checked)}
                          />
                          <span className="SettingsPage-slider" />
                        </label>
                      </div>

                      <div
                        className="SettingsPage-switchRow"
                        onClick={() => setReceiptShowBarcode(!receiptShowBarcode)}
                      >
                        <div className="SettingsPage-switchInfo">
                          <strong>{t('showBarcode') || 'Show Barcode'}</strong>
                          <span>{t('showBarcodeDesc')}</span>
                        </div>
                        <label className="SettingsPage-switch" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={receiptShowBarcode}
                            onChange={(e) => setReceiptShowBarcode(e.target.checked)}
                          />
                          <span className="SettingsPage-slider" />
                        </label>
                      </div>

                      <div
                        className="SettingsPage-switchRow"
                        onClick={() => setReceiptShowCashier(!receiptShowCashier)}
                      >
                        <div className="SettingsPage-switchInfo">
                          <strong>{t('showCashier') || 'Show Cashier Name'}</strong>
                          <span>{t('showCashierDesc')}</span>
                        </div>
                        <label className="SettingsPage-switch" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={receiptShowCashier}
                            onChange={(e) => setReceiptShowCashier(e.target.checked)}
                          />
                          <span className="SettingsPage-slider" />
                        </label>
                      </div>

                      <div
                        className="SettingsPage-switchRow"
                        onClick={() => setReceiptShowCustomer(!receiptShowCustomer)}
                      >
                        <div className="SettingsPage-switchInfo">
                          <strong>{t('showCustomer') || 'Show Customer Name'}</strong>
                          <span>{t('showCustomerDesc')}</span>
                        </div>
                        <label className="SettingsPage-switch" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={receiptShowCustomer}
                            onChange={(e) => setReceiptShowCustomer(e.target.checked)}
                          />
                          <span className="SettingsPage-slider" />
                        </label>
                      </div>
                    </div>

                    {receiptShowLogo && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', padding: '0.85rem', background: 'var(--bg-secondary)', borderRadius: '0.6rem', border: '1px solid var(--border-color)' }}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          id="logo-upload-input"
                          style={{ display: 'none' }}
                        />
                        <button
                          type="button"
                          className="SettingsPage-btn secondary"
                          onClick={() => document.getElementById('logo-upload-input')?.click()}
                        >
                          <Upload size={16} /> {t('uploadLogo') || 'Upload Logo'}
                        </button>

                        {receiptLogoBase64 && (
                          <button
                            type="button"
                            className="SettingsPage-btn danger"
                            onClick={() => setReceiptLogoBase64('')}
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                          >
                            <Trash2 size={14} /> {t('remove') || 'Remove'}
                          </button>
                        )}
                      </div>
                    )}

                    {receiptMessage && (
                      <div className={`SettingsPage-message ${receiptMessage.includes('Error') ? 'error' : 'success'}`}>
                        {receiptMessage.includes('Error') ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                        <span>{receiptMessage}</span>
                      </div>
                    )}

                    <div className="SettingsPage-actions">
                      <button
                        className="SettingsPage-btn primary"
                        onClick={handleSaveReceiptSettings}
                        disabled={receiptSaving}
                      >
                        {receiptSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                        {receiptSaving ? (t('saving') || 'Saving...') : (t('saveSettings') || 'Save Settings')}
                      </button>
                    </div>
                  </div>

                  {/* Live Thermal Paper Mockup */}
                  <div className="ReceiptPreview-container">
                    <div className="ReceiptPreview-title">
                      <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
                      <span>{t('receiptLivePreview')}</span>
                    </div>

                    <div className="ReceiptPreview-paper">
                      {receiptShowLogo && receiptLogoBase64 && (
                        <img src={receiptLogoBase64} alt="Store Logo" className="ReceiptPreview-logo" />
                      )}

                      <div className="ReceiptPreview-storeName">{receiptStoreName || 'EVA CLOTHING'}</div>
                      <div style={{ fontSize: '11px', color: '#555' }}>بغداد - المنصور - شارع 14 رمضان</div>
                      <div style={{ fontSize: '10px', color: '#777', marginTop: '2px' }}>{new Date().toLocaleString('ar-IQ')}</div>

                      <div className="ReceiptPreview-divider" />

                      {receiptShowCashier && (
                        <div className="ReceiptPreview-row">
                          <span>الكاشير:</span>
                          <span>{t('receiptSampleCashier')}</span>
                        </div>
                      )}

                      {receiptShowCustomer && (
                        <div className="ReceiptPreview-row">
                          <span>الزبون:</span>
                          <span>{t('receiptSampleCustomer')}</span>
                        </div>
                      )}

                      <div className="ReceiptPreview-row">
                        <span>رقم الفاتورة:</span>
                        <span>#1042</span>
                      </div>

                      <div className="ReceiptPreview-divider" />

                      {/* Line Items */}
                      <div className="ReceiptPreview-row bold">
                        <span>الصنف</span>
                        <span>السعر</span>
                      </div>
                      <div className="ReceiptPreview-row">
                        <span>1x {t('receiptSampleItem1')}</span>
                        <span>25,000</span>
                      </div>
                      <div className="ReceiptPreview-row">
                        <span>1x {t('receiptSampleItem2')}</span>
                        <span>35,000</span>
                      </div>

                      <div className="ReceiptPreview-divider" />

                      <div className="ReceiptPreview-row bold" style={{ fontSize: '14px' }}>
                        <span>{t('totalSummary')}:</span>
                        <span>60,000 د.ع</span>
                      </div>
                      <div className="ReceiptPreview-row" style={{ color: '#555', fontSize: '11px' }}>
                        <span>طريقة الدفع:</span>
                        <span>نقداً (Cash)</span>
                      </div>

                      {receiptShowBarcode && (
                        <>
                          <div className="ReceiptPreview-divider" />
                          <div className="ReceiptPreview-barcode">||| | ||||| || |||</div>
                          <div style={{ fontSize: '9px', letterSpacing: '1px' }}>*1042*</div>
                        </>
                      )}

                      {receiptFooterText && (
                        <>
                          <div className="ReceiptPreview-divider" />
                          <div className="ReceiptPreview-footer">{receiptFooterText}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Barcode Label Section */}
            <LabelSettingsSection />
          </>
        )}

        {/* 5. SYSTEM & MAINTENANCE TAB */}
        {activeTab === 'system' && hasRole(['admin']) && (
          <>
            {/* Software Update Card */}
            <div className="SettingsPage-card">
              <div className="SettingsPage-cardHeader">
                <div className="SettingsPage-cardHeaderLeft">
                  <div className="SettingsPage-cardHeaderIcon">
                    <RefreshCcw size={20} />
                  </div>
                  <div className="SettingsPage-cardHeaderTitle">
                    <h2>{t('softwareUpdate') || 'Software Update'}</h2>
                    <p>{t('checkForUpdates') || 'Check for new versions and improvements'}</p>
                  </div>
                </div>
              </div>

              <div className="SettingsPage-form">
                <div className="SettingsPage-actions">
                  <button
                    className="SettingsPage-btn primary"
                    onClick={handleCheckForUpdates}
                    disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                  >
                    {updateStatus === 'checking' ? <Loader2 size={16} className="spin" /> : <RefreshCcw size={16} />}
                    {updateStatus === 'checking' ? (t('checkingUpdates') || 'Checking...') : (t('checkForUpdates') || 'Check for Updates')}
                  </button>
                </div>

                {updateStatus && (
                  <div className="SettingsPage-infoBox" style={{ marginTop: '0.75rem' }}>
                    {updateStatus === 'checking' && <p>{t('checkingUpdates') || 'Checking GitHub for releases...'}</p>}
                    {updateStatus === 'available' && (
                      <div>
                        <strong style={{ color: '#10b981' }}>{t('updateAvailableTitle') || 'Update Available!'}</strong>
                        <p style={{ margin: '0.25rem 0' }}>{t('version')}: {updateInfo?.version}</p>
                        <small>{t('downloadingAuto') || 'Downloading automatically in background...'}</small>
                      </div>
                    )}
                    {updateStatus === 'not-available' && (
                      <p><CheckCircle2 size={15} style={{ verticalAlign: 'middle', color: '#10b981' }} /> {t('latestVersion') || 'You are on the latest version.'}</p>
                    )}
                    {updateStatus === 'downloading' && (
                      <div>
                        <p><Download size={15} style={{ verticalAlign: 'middle' }} /> {t('downloadingUpdate', { percent: Math.round(downloadProgress?.percent || 0) }) || `Downloading update... ${Math.round(downloadProgress?.percent || 0)}%`}</p>
                        <div style={{ background: 'var(--border-color)', height: '6px', borderRadius: '3px', width: '100%', marginTop: '6px', overflow: 'hidden' }}>
                          <div style={{
                            background: '#10b981',
                            height: '100%',
                            width: `${downloadProgress?.percent || 0}%`,
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                      </div>
                    )}
                    {updateStatus === 'downloaded' && (
                      <div>
                        <strong style={{ color: '#10b981' }}>{t('updateReadyTitle') || 'Update Ready!'}</strong>
                        <p>{t('restartToInstall') || 'Restart the app to install.'}</p>
                        <button
                          className="SettingsPage-btn primary"
                          style={{ marginTop: '0.5rem' }}
                          onClick={() => window.electronAPI?.quitAndInstall()}
                        >
                          <RefreshCcw size={16} /> {t('restartNow') || 'Restart Now'}
                        </button>
                      </div>
                    )}
                    {updateStatus === 'error' && (
                      <p style={{ color: '#ef4444' }}><XCircle size={15} style={{ verticalAlign: 'middle' }} /> {t('updateError', { error: String(updateInfo) }) || `Error: ${String(updateInfo)}`}</p>
                    )}
                    {updateStatus === 'dev-mode' && (
                      <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        {t('devModeUpdate') || 'Updates are disabled in Development Mode.'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Database Reset Danger Zone */}
            <div className="SettingsPage-dangerCard">
              <div className="SettingsPage-cardHeader">
                <div className="SettingsPage-cardHeaderLeft">
                  <div className="SettingsPage-cardHeaderIcon">
                    <AlertTriangle size={20} />
                  </div>
                  <div className="SettingsPage-cardHeaderTitle">
                    <h2 style={{ color: '#ef4444' }}>{t('dangerZone') || 'Danger Zone'}</h2>
                    <p>{t('systemResetDesc') || 'Reset system and wipe all sales, inventory, and transaction records'}</p>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                {t('resetDatabaseHint') || 'This will permanently delete all sales, products, customers, and expenses. It cannot be undone.'}
              </p>

              <button
                className="SettingsPage-btn danger"
                onClick={handleResetDatabase}
              >
                <Trash2 size={16} />
                {t('resetDatabaseButton') || 'Reset Database (Delete All Data)'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
