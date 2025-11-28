import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import './LabelSettingsSection.css';

interface LabelSettings {
  // labelSize removed, fixed to 50x25mm
  showProductName: boolean;
  showVariant: boolean;
  showSku: boolean;
  showPrice: boolean;
  fontSize: number;
  barcodeHeight: number;
  barcodeWidth: number;
  textAlign: 'left' | 'center' | 'right';
  labelPadding: number;
  customText1: string;
  customText2: string;
  customText3: string;
  fieldOrder: string[];
}

const defaultSettings: LabelSettings = {
  // labelSize fixed to 50x25mm
  showProductName: true,
  showVariant: true,
  showSku: true,
  showPrice: true,
  fontSize: 7,
  barcodeHeight: 35,
  barcodeWidth: 2,
  textAlign: 'center',
  labelPadding: 3,
  customText1: '',
  customText2: '',
  customText3: '',
  fieldOrder: ['productName', 'variant', 'barcode', 'sku', 'price'],
};


const LabelSettingsSection = (): JSX.Element => {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<LabelSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const saved = await window.electronAPI.getSetting('label_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (err) {
      console.error('Failed to load label settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setSuccess(null);
      await window.electronAPI.setSetting('label_settings', JSON.stringify(settings));
      setSuccess(t('labelSettingsSaved'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to save label settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof LabelSettings>(key: K, value: LabelSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="SettingsPage-section">
        <h2>🏷️ {t('labelSettings')}</h2>
        <p>{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="SettingsPage-section">
      <h2>🏷️ {t('labelSettings')}</h2>
      <p>{t('customizeBarcodeLabels')}</p>

      <div className="LabelSettings-content">
        <div className="LabelSettings-grid">
          {/* Basic Settings */}
          <div className="LabelSettings-group">
            <h3>{t('basicSettings')}</h3>

            <label>
              {t('fontSize')}
              <input
                type="number"
                min="6"
                max="24"
                value={settings.fontSize}
                onChange={(e) => updateSetting('fontSize', parseInt(e.target.value) || 7)}
              />
            </label>
            <label>
              {t('textAlignment')}
              <select value={settings.textAlign} onChange={(e) => updateSetting('textAlign', e.target.value as 'left' | 'center' | 'right')}>
                <option value="left">{t('left')}</option>
                <option value="center">{t('center')}</option>
                <option value="right">{t('right')}</option>
              </select>
            </label>
            <label>
              {t('labelPadding')}
              <input
                type="number"
                min="0"
                max="20"
                value={settings.labelPadding}
                onChange={(e) => updateSetting('labelPadding', parseInt(e.target.value) || 3)}
              />
            </label>
          </div>

          {/* Show/Hide Elements */}
          <div className="LabelSettings-group">
            <h3>{t('showHideElements')}</h3>
            <label className="LabelSettings-checkbox">
              <input
                type="checkbox"
                checked={settings.showProductName}
                onChange={(e) => updateSetting('showProductName', e.target.checked)}
              />
              <span>{t('productName')}</span>
            </label>
            <label className="LabelSettings-checkbox">
              <input
                type="checkbox"
                checked={settings.showVariant}
                onChange={(e) => updateSetting('showVariant', e.target.checked)}
              />
              <span>{t('variantColorSize')}</span>
            </label>
            <label className="LabelSettings-checkbox">
              <input
                type="checkbox"
                checked={settings.showSku}
                onChange={(e) => updateSetting('showSku', e.target.checked)}
              />
              <span>{t('sku')}</span>
            </label>
            <label className="LabelSettings-checkbox">
              <input
                type="checkbox"
                checked={settings.showPrice}
                onChange={(e) => updateSetting('showPrice', e.target.checked)}
              />
              <span>{t('price')}</span>
            </label>
          </div>

          {/* Barcode Settings */}
          <div className="LabelSettings-group">
            <h3>{t('barcodeSettings')}</h3>
            <label>
              {t('barcodeHeight')}
              <input
                type="number"
                min="10"
                max="200"
                value={settings.barcodeHeight}
                onChange={(e) => updateSetting('barcodeHeight', parseInt(e.target.value) || 35)}
              />
            </label>
            <label>
              {t('barcodeWidth')}
              <input
                type="number"
                min="1"
                max="10"
                step="0.5"
                value={settings.barcodeWidth}
                onChange={(e) => updateSetting('barcodeWidth', parseFloat(e.target.value) || 2)}
              />
            </label>
          </div>

          {/* Custom Text Fields */}
          <div className="LabelSettings-group">
            <h3>{t('customTextFields')}</h3>
            <p className="LabelSettings-hint">{t('addCustomText')}</p>
            <label>
              {t('customText1')}
              <input
                type="text"
                value={settings.customText1}
                onChange={(e) => updateSetting('customText1', e.target.value)}
                placeholder={t('exampleVIP')}
                maxLength={50}
              />
            </label>
            <div className="LabelSettings-info">
              <strong>{t('customText2')}</strong>
              <p className="LabelSettings-hint">{t('customText2Auto') || 'Automatically set to product name'}</p>
            </div>
            <label>
              {t('storeName') || 'Store Name'}
              <input
                type="text"
                value={settings.customText3}
                onChange={(e) => updateSetting('customText3', e.target.value)}
                placeholder={t('exampleStoreName')}
                maxLength={50}
              />
            </label>
          </div>

          <div className="LabelSettings-actions">
            <button onClick={saveSettings} disabled={saving} className="LabelSettings-saveButton">
              {saving ? t('saving') : `💾 ${t('saveLabelSettings')}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LabelSettingsSection;

