import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Tag, Save, Loader2, Sliders, Eye, Sparkles, Barcode, Type, CheckCircle2 } from 'lucide-react';
import './LabelSettingsSection.css';
import NumberInput from './NumberInput';

interface LabelSettings {
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
  showFakeDiscount: boolean;
  fakeDiscountPercent: number;
}

const defaultSettings: LabelSettings = {
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
  showFakeDiscount: false,
  fakeDiscountPercent: 30,
};

const LabelSettingsSection = (): JSX.Element => {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<LabelSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

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
      setSuccess(t('labelSettingsSaved') || 'Label settings saved successfully!');
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
      <div className="LabelSettings-container">
        <div className="LabelSettings-header">
          <div className="LabelSettings-headerIcon">
            <Tag size={20} />
          </div>
          <div className="LabelSettings-headerTitle">
            <h2>{t('labelSettings')}</h2>
            <p>{t('loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="LabelSettings-container">
      {/* Header */}
      <div className="LabelSettings-header">
        <div className="LabelSettings-headerIcon">
          <Tag size={20} />
        </div>
        <div className="LabelSettings-headerTitle">
          <h2>{t('labelSettings')}</h2>
          <p>{t('customizeBarcodeLabels')}</p>
        </div>
      </div>

      {/* Grid Settings */}
      <div className="LabelSettings-grid">
        {/* 1. Basic Dimensions & Font */}
        <div className="LabelSettings-card">
          <h3 className="LabelSettings-cardTitle">
            <Sliders size={16} />
            {t('basicSettings')}
          </h3>

          <div className="LabelSettings-field">
            <label>{t('fontSize')}</label>
            <NumberInput
              min="6"
              max="24"
              value={settings.fontSize}
              onChange={(e) => updateSetting('fontSize', parseInt(e.target.value) || 7)}
            />
          </div>

          <div className="LabelSettings-field">
            <label>{t('textAlignment')}</label>
            <select
              value={settings.textAlign}
              onChange={(e) => updateSetting('textAlign', e.target.value as 'left' | 'center' | 'right')}
            >
              <option value="left">{t('left') || 'Left'}</option>
              <option value="center">{t('center') || 'Center'}</option>
              <option value="right">{t('right') || 'Right'}</option>
            </select>
          </div>

          <div className="LabelSettings-field">
            <label>{t('labelPadding')}</label>
            <NumberInput
              min="0"
              max="20"
              value={settings.labelPadding}
              onChange={(e) => updateSetting('labelPadding', parseInt(e.target.value) || 3)}
            />
          </div>
        </div>

        {/* 2. Visible Elements */}
        <div className="LabelSettings-card">
          <h3 className="LabelSettings-cardTitle">
            <Eye size={16} />
            {t('showHideElements')}
          </h3>

          <div className="LabelSettings-checkboxList">
            <div
              className="SettingsPage-switchRow"
              style={{ padding: '0.65rem 0.85rem' }}
              onClick={() => updateSetting('showProductName', !settings.showProductName)}
            >
              <div className="SettingsPage-switchInfo">
                <strong style={{ fontSize: '0.88rem' }}>{t('productName')}</strong>
              </div>
              <label className="SettingsPage-switch" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={settings.showProductName}
                  onChange={(e) => updateSetting('showProductName', e.target.checked)}
                />
                <span className="SettingsPage-slider" />
              </label>
            </div>

            <div
              className="SettingsPage-switchRow"
              style={{ padding: '0.65rem 0.85rem' }}
              onClick={() => updateSetting('showVariant', !settings.showVariant)}
            >
              <div className="SettingsPage-switchInfo">
                <strong style={{ fontSize: '0.88rem' }}>{t('variantColorSize')}</strong>
              </div>
              <label className="SettingsPage-switch" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={settings.showVariant}
                  onChange={(e) => updateSetting('showVariant', e.target.checked)}
                />
                <span className="SettingsPage-slider" />
              </label>
            </div>

            <div
              className="SettingsPage-switchRow"
              style={{ padding: '0.65rem 0.85rem' }}
              onClick={() => updateSetting('showSku', !settings.showSku)}
            >
              <div className="SettingsPage-switchInfo">
                <strong style={{ fontSize: '0.88rem' }}>{t('sku')}</strong>
              </div>
              <label className="SettingsPage-switch" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={settings.showSku}
                  onChange={(e) => updateSetting('showSku', e.target.checked)}
                />
                <span className="SettingsPage-slider" />
              </label>
            </div>

            <div
              className="SettingsPage-switchRow"
              style={{ padding: '0.65rem 0.85rem' }}
              onClick={() => updateSetting('showPrice', !settings.showPrice)}
            >
              <div className="SettingsPage-switchInfo">
                <strong style={{ fontSize: '0.88rem' }}>{t('price')}</strong>
              </div>
              <label className="SettingsPage-switch" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={settings.showPrice}
                  onChange={(e) => updateSetting('showPrice', e.target.checked)}
                />
                <span className="SettingsPage-slider" />
              </label>
            </div>
          </div>
        </div>

        {/* 3. Strikethrough Fake Discount */}
        <div className="LabelSettings-card">
          <h3 className="LabelSettings-cardTitle">
            <Sparkles size={16} style={{ color: '#f59e0b' }} />
            {t('fakeDiscount')}
          </h3>
          <p className="LabelSettings-hint">{t('fakeDiscountHint')}</p>

          <div
            className="SettingsPage-switchRow"
            style={{ padding: '0.65rem 0.85rem' }}
            onClick={() => updateSetting('showFakeDiscount', !settings.showFakeDiscount)}
          >
            <div className="SettingsPage-switchInfo">
              <strong style={{ fontSize: '0.88rem' }}>{t('enableFakeDiscount')}</strong>
            </div>
            <label className="SettingsPage-switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={settings.showFakeDiscount}
                onChange={(e) => updateSetting('showFakeDiscount', e.target.checked)}
              />
              <span className="SettingsPage-slider" />
            </label>
          </div>

          {settings.showFakeDiscount && (
            <div className="LabelSettings-field" style={{ marginTop: '0.5rem' }}>
              <label>{t('labelDiscountPercent')}</label>
              <NumberInput
                min="5"
                max="80"
                value={settings.fakeDiscountPercent}
                onChange={(e) => updateSetting('fakeDiscountPercent', parseInt(e.target.value) || 30)}
              />
              <p className="LabelSettings-hint" style={{ marginTop: '0.25rem' }}>
                {t('discountExample')}
              </p>
            </div>
          )}
        </div>

        {/* 4. Barcode Dimensions */}
        <div className="LabelSettings-card">
          <h3 className="LabelSettings-cardTitle">
            <Barcode size={16} />
            {t('barcodeSettings')}
          </h3>

          <div className="LabelSettings-field">
            <label>{t('barcodeHeight')}</label>
            <NumberInput
              min="10"
              max="200"
              value={settings.barcodeHeight}
              onChange={(e) => updateSetting('barcodeHeight', parseInt(e.target.value) || 35)}
            />
          </div>

          <div className="LabelSettings-field">
            <label>{t('barcodeWidth')}</label>
            <NumberInput
              min="1"
              max="10"
              step="0.5"
              value={settings.barcodeWidth}
              onChange={(e) => updateSetting('barcodeWidth', parseFloat(e.target.value) || 2)}
            />
          </div>
        </div>

        {/* 5. Custom Text Fields */}
        <div className="LabelSettings-card">
          <h3 className="LabelSettings-cardTitle">
            <Type size={16} />
            {t('customTextFields')}
          </h3>
          <p className="LabelSettings-hint">{t('addCustomText')}</p>

          <div className="LabelSettings-field">
            <label>{t('customText1')}</label>
            <input
              type="text"
              value={settings.customText1}
              onChange={(e) => updateSetting('customText1', e.target.value)}
              placeholder={t('exampleVIP') || 'e.g. VIP'}
              maxLength={50}
            />
          </div>

          <div className="LabelSettings-field">
            <label>{t('storeName') || 'Store Name'}</label>
            <input
              type="text"
              value={settings.customText3}
              onChange={(e) => updateSetting('customText3', e.target.value)}
              placeholder={t('exampleStoreName') || 'EVA CLOTHING'}
              maxLength={50}
            />
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {success && (
        <div className="SettingsPage-message success" style={{ marginTop: '1rem' }}>
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Action Save Button */}
      <div className="LabelSettings-actions">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="SettingsPage-btn primary"
        >
          {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
          {saving ? (t('saving') || 'Saving...') : (t('saveLabelSettings') || 'Save Label Settings')}
        </button>
      </div>
    </div>
  );
};

export default LabelSettingsSection;
