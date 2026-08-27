import React, { useEffect, useState } from 'react';
import NumberInput from './NumberInput';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Calculator, Package, Layers, FileText } from 'lucide-react';
import Combobox from './Combobox';
import './ProductForm.css';

type Supplier = import('../types/electron').Supplier;
type ProductInput = import('../types/electron').ProductInput;

interface ProductFormProps {
  onSubmit: (payload: ProductInput & { initialStock?: number }) => Promise<void> | void;
  onCancel: () => void;
  loading?: boolean;
  existingSeasons?: string[];
}

interface FormState extends Omit<ProductInput, 'salePriceIQD' | 'purchaseCostUSD'> {
  salePriceIQD: number | string;
  purchaseCostUSD: number | string;
}

const initialState: FormState = {
  name: '',
  code: '',
  barcode: '',
  category: '',
  season: '',
  description: '',
  color: '',
  size: '',
  salePriceIQD: '',
  purchaseCostUSD: '',
  supplierId: undefined,
};

const ProductForm = ({
  onSubmit,
  onCancel,
  loading,
  existingSeasons = [],
}: ProductFormProps): JSX.Element => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [formState, setFormState] = useState<FormState>(initialState);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(1470);
  const [initialStockStr, setInitialStockStr] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');

  useEffect(() => {
    if (formState.supplierId) {
      const name = suppliers.find((s) => s.id === formState.supplierId)?.name ?? '';
      setSupplierSearch(name);
    } else {
      setSupplierSearch('');
    }
  }, [formState.supplierId, suppliers]);

  const handleChange =
    (field: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setFormState((prev) => ({
        ...prev,
        [field]: field === 'supplierId' ? (value ? Number(value) : undefined) : value,
      }));
    };

  useEffect(() => {
    const loadSuppliers = async () => {
      if (!window.evaApi || !token) return;
      try {
        const response = await window.evaApi.suppliers.list(token);
        setSuppliers(response);
      } catch (err) {
        console.error('Failed to load suppliers', err);
      }
    };

    const loadExchangeRate = async () => {
      if (!window.evaApi || !token) return;
      try {
        const response = await window.evaApi.exchangeRates.getCurrent();
        if (response.currentRate) {
          setExchangeRate(response.currentRate.rate);
        }
      } catch (err) {
        console.error('Failed to load exchange rate', err);
      }
    };

    if (token) {
      loadSuppliers();
      loadExchangeRate();
    }
  }, [token]);

  // Real-time Profit Calculation
  const calculateProfitMargin = (): {
    margin: number;
    profitIQD: number;
    profitUSD: number;
    multiplier: number;
  } | null => {
    const purchaseCostUSD = Number(formState.purchaseCostUSD);
    const salePriceIQD = Number(formState.salePriceIQD);

    if (!purchaseCostUSD || purchaseCostUSD <= 0 || !salePriceIQD || salePriceIQD <= 0) {
      return null;
    }

    const costIQD = purchaseCostUSD * exchangeRate;
    const profitIQD = salePriceIQD - costIQD;
    const profitUSD = profitIQD / exchangeRate;
    const margin = (profitIQD / costIQD) * 100;
    const multiplier = salePriceIQD / costIQD;

    return { margin, profitIQD, profitUSD, multiplier };
  };

  const profitInfo = calculateProfitMargin();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formState.name.trim()) {
      setFormError(t('nameRequired'));
      return;
    }

    const salePriceIQD = Number(formState.salePriceIQD);
    const purchaseCostUSD = Number(formState.purchaseCostUSD);

    if (!Number.isFinite(salePriceIQD) || salePriceIQD <= 0) {
      setFormError(t('pricePositive'));
      return;
    }

    try {
      setFormError(null);
      const selectedSupplier = suppliers.find((s) => s.name === supplierSearch);
      const payload: ProductInput & { initialStock?: number } = {
        ...formState,
        supplierId: selectedSupplier ? selectedSupplier.id : undefined,
        salePriceIQD,
        purchaseCostUSD: Number.isFinite(purchaseCostUSD) ? purchaseCostUSD : 0,
        initialStock: Number(initialStockStr) || 0,
      };

      await onSubmit(payload);
      setFormState(initialState);
      setSupplierSearch('');
      setInitialStockStr('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('failedToCreateProduct'));
    }
  };

  return (
    <form className="ProductForm" onSubmit={handleSubmit}>
      {formError && <div className="ProductForm-alert">{formError}</div>}

      {/* Section 1: Basic Info */}
      <div className="ProductForm-section">
        <span className="ProductForm-sectionTitle">
          <Package size={16} />
          <span>{t('basicInfo')}</span>
        </span>
        <div className="ProductForm-grid">
          <div className="ProductForm-field">
            <label>
              {t('productName')}
              <span className="required">*</span>
            </label>
            <input
              type="text"
              className="ProductForm-input"
              value={formState.name}
              onChange={handleChange('name')}
              placeholder="e.g. طقم رسمي 22"
              required
            />
          </div>

          <div className="ProductForm-field">
            <label>{t('supplier')}</label>
            <Combobox
              value={supplierSearch}
              onChange={(val) => setSupplierSearch(val)}
              options={suppliers.map((s) => s.name)}
              placeholder={t('selectSupplier')}
            />
          </div>

          <div className="ProductForm-field">
            <label>{t('code')}</label>
            <input
              type="text"
              className="ProductForm-input"
              value={formState.code ?? ''}
              onChange={handleChange('code')}
              placeholder="e.g. EVA-22XX"
            />
          </div>

          <div className="ProductForm-field">
            <label>{t('barcode')}</label>
            <input
              type="text"
              className="ProductForm-input"
              value={formState.barcode ?? ''}
              onChange={handleChange('barcode')}
              placeholder="e.g. 6416307152412"
            />
          </div>

          <div className="ProductForm-field">
            <label>{t('category')}</label>
            <input
              type="text"
              className="ProductForm-input"
              value={formState.category ?? ''}
              onChange={handleChange('category')}
              placeholder="e.g. أطقم / فساتين"
            />
          </div>

          <div className="ProductForm-field">
            <label>{t('season')}</label>
            <Combobox
              value={formState.season ?? ''}
              onChange={(value) => setFormState((prev) => ({ ...prev, season: value }))}
              options={existingSeasons}
              placeholder="e.g. Summer26 / Winter26"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Variant & Pricing */}
      <div className="ProductForm-section">
        <span className="ProductForm-sectionTitle">
          <Layers size={16} />
          <span>{t('variantAndPricing')}</span>
        </span>
        <div className="ProductForm-grid">
          <div className="ProductForm-field">
            <label>{t('color')}</label>
            <input
              type="text"
              className="ProductForm-input"
              value={formState.color ?? ''}
              onChange={handleChange('color')}
              placeholder="e.g. أسود / أزرق"
            />
          </div>

          <div className="ProductForm-field">
            <label>{t('size')}</label>
            <input
              type="text"
              className="ProductForm-input"
              value={formState.size ?? ''}
              onChange={handleChange('size')}
              placeholder="e.g. M / L / XL"
            />
          </div>

          <div className="ProductForm-field">
            <label>
              {t('sellingPriceIQD')}
              <span className="required">*</span>
            </label>
            <NumberInput
              className="ProductForm-input"
              min="0"
              step="250"
              value={formState.salePriceIQD}
              onChange={handleChange('salePriceIQD')}
              placeholder="75,000"
              required
            />
          </div>

          <div className="ProductForm-field">
            <label>{t('costUSD')}</label>
            <NumberInput
              className="ProductForm-input"
              min="0"
              step="0.01"
              value={formState.purchaseCostUSD}
              onChange={handleChange('purchaseCostUSD')}
              placeholder="15.00"
            />
          </div>

          <div className="ProductForm-field full-width">
            <label>{t('initialStock')}</label>
            <NumberInput
              className="ProductForm-input"
              value={initialStockStr}
              onChange={(e) => setInitialStockStr(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Live Profit Margin Calculator */}
      {profitInfo && (
        <div className="ProductForm-profitCard">
          <div className="ProductForm-profitHeader">
            <Calculator size={15} style={{ color: 'var(--accent-primary)' }} />
            <span>{t('profitMarginCalculator')}</span>
          </div>
          <div className="ProductForm-profitGrid">
            <div className="ProductForm-profitItem">
              <span className="ProductForm-profitLabel">{t('markup')}</span>
              <span
                className={`ProductForm-profitValue ${
                  profitInfo.margin >= 0 ? 'positive' : 'negative'
                }`}
              >
                {profitInfo.margin.toFixed(1)}%
              </span>
            </div>
            <div className="ProductForm-profitItem">
              <span className="ProductForm-profitLabel">{t('multiplier')}</span>
              <span className="ProductForm-profitValue">{profitInfo.multiplier.toFixed(2)}x</span>
            </div>
            <div className="ProductForm-profitItem">
              <span className="ProductForm-profitLabel">{t('profitAmount')}</span>
              <span
                className={`ProductForm-profitValue ${
                  profitInfo.profitIQD >= 0 ? 'positive' : 'negative'
                }`}
              >
                {profitInfo.profitIQD.toLocaleString('en-IQ')} IQD
              </span>
            </div>
            <div className="ProductForm-profitItem">
              <span className="ProductForm-profitLabel">{t('profitUSD')}</span>
              <span
                className={`ProductForm-profitValue ${
                  profitInfo.profitUSD >= 0 ? 'positive' : 'negative'
                }`}
              >
                ${profitInfo.profitUSD.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Description */}
      <div className="ProductForm-section">
        <span className="ProductForm-sectionTitle">
          <FileText size={16} />
          <span>{t('description')}</span>
        </span>
        <div className="ProductForm-field full-width">
          <textarea
            className="ProductForm-input"
            value={formState.description ?? ''}
            onChange={handleChange('description')}
            rows={2}
            placeholder={t('optionalDetails')}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="ProductForm-actions">
        <button
          type="button"
          onClick={onCancel}
          className="ProductForm-btn"
          disabled={loading}
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          className="ProductForm-btn primary"
          disabled={loading}
        >
          {loading ? t('saving') : t('saveProduct')}
        </button>
      </div>
    </form>
  );
};

export default ProductForm;
