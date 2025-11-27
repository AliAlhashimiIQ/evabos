import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import LabelSettingsSection from '../components/LabelSettingsSection';
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

  useEffect(() => {
    loadExchangeRate();
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
                  <input
                    type="number"
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
                <input
                  type="number"
                  value={costUSD}
                  onChange={(e) => setCostUSD(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>

              <div className="SettingsPage-calcField">
                <label>{t('salePriceIQD')}</label>
                <input
                  type="number"
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

        {/* Label Settings */}
        <LabelSettingsSection />
      </div>
    </div>
  );
};

export default SettingsPage;
