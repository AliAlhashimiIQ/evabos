import React, { useEffect, useState } from 'react';
import NumberInput from './NumberInput';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
type Supplier = import('../types/electron').Supplier;
type ProductInput = import('../types/electron').ProductInput;
import './ProductForm.css';

interface ProductFormProps {
  onSubmit: (payload: ProductInput) => Promise<void> | void;
  onCancel: () => void;
  loading?: boolean;
}


// Local state interface to allow empty strings for number inputs
interface FormState extends Omit<ProductInput, 'salePriceIQD' | 'purchaseCostUSD'> {
  salePriceIQD: number | string;
  purchaseCostUSD: number | string;
}

const initialState: FormState = {
  name: '',
  code: '',
  barcode: '',
  category: '',
  description: '',
  color: '',
  size: '',
  salePriceIQD: '', // Start empty
  purchaseCostUSD: '', // Start empty
  supplierId: undefined,
};

const ProductForm = ({ onSubmit, onCancel, loading }: ProductFormProps): JSX.Element => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [formState, setFormState] = useState<FormState>(initialState);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(1470); // Default exchange rate

  const [initialStockStr, setInitialStockStr] = useState('');

  const handleChange =
    (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setFormState((prev) => ({
        ...prev,
        // Keep as string for inputs to allow empty state
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

  // Calculate profit margin in real-time
  const calculateProfitMargin = (): { margin: number; profitIQD: number; profitUSD: number; multiplier: number } | null => {
    const purchaseCostUSD = Number(formState.purchaseCostUSD);
    const salePriceIQD = Number(formState.salePriceIQD);

    if (!purchaseCostUSD || purchaseCostUSD <= 0 || !salePriceIQD || salePriceIQD <= 0) {
      return null;
    }

    const costIQD = purchaseCostUSD * exchangeRate;
    const profitIQD = salePriceIQD - costIQD;
    const profitUSD = profitIQD / exchangeRate;

    // Markup on cost (e.g., if cost=$5 and sell=$10, profit=$5, markup=100%)
    const margin = (profitIQD / costIQD) * 100;

    // Multiplier (e.g., if cost=$5 and sell=$10, multiplier=2x)
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

      const payload: ProductInput = {
        ...formState,
        salePriceIQD,
        purchaseCostUSD: Number.isFinite(purchaseCostUSD) ? purchaseCostUSD : 0,
      };

      // Pass initialStock as part of the payload (casting to any to avoid type error for now, or update interface)
      await onSubmit({ ...payload, initialStock: Number(initialStockStr) || 0 } as any);
      setFormState(initialState);
      setInitialStockStr('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('failedToCreateProduct'));
    }
  };

  return (
    <form className="ProductForm" onSubmit={handleSubmit}>
      {formError && <div className="ProductForm-alert">{formError}</div>}
      <div className="ProductForm-grid">
        <label>
          <span>{t('name')}</span>
          <input type="text" value={formState.name} onChange={handleChange('name')} required />
        </label>
        <label>
          <span>{t('supplier')}</span>
          <select
            value={formState.supplierId ?? ''}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                supplierId: event.target.value ? Number(event.target.value) : undefined,
              }))
            }
          >
            <option value="">{t('selectSupplier')}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('code')}</span>
          <input type="text" value={formState.code ?? ''} onChange={handleChange('code')} />
        </label>
        <label>
          <span>{t('barcode')}</span>
          <input type="text" value={formState.barcode ?? ''} onChange={handleChange('barcode')} />
        </label>
        <label>
          <span>{t('category')}</span>
          <input type="text" value={formState.category ?? ''} onChange={handleChange('category')} />
        </label>
        <label className="ProductForm-span">
          <span>{t('description')}</span>
          <textarea value={formState.description ?? ''} onChange={handleChange('description')} rows={3} />
        </label>
        <label>
          <span>{t('color')}</span>
          <input type="text" value={formState.color ?? ''} onChange={handleChange('color')} />
        </label>
        <label>
          <span>{t('size')}</span>
          <input type="text" value={formState.size ?? ''} onChange={handleChange('size')} />
        </label>
        <label>
          <span>{t('salePriceIQD')}</span>
          <NumberInput
            min="0"
            step="100"
            value={formState.salePriceIQD}
            onChange={handleChange('salePriceIQD')}
            required
          />
        </label>
        <label>
          <span>{t('costUSD')}</span>
          <NumberInput
            min="0"
            step="0.01"
            value={formState.purchaseCostUSD}
            onChange={handleChange('purchaseCostUSD')}
          />
        </label>
        <label>
          <span>{t('initialStock') || 'Initial Stock'}</span>
          <NumberInput
            value={initialStockStr}
            onChange={(e) => setInitialStockStr(e.target.value)}
            placeholder="0"
          />
        </label>
      </div>

      {/* Profit Margin Display */}
      {profitInfo && (
        <div className="ProductForm-profitMargin">
          <div className="ProductForm-profitMargin-header">
            <span className="ProductForm-profitMargin-icon">📊</span>
            <span className="ProductForm-profitMargin-title">{t('profitMarginCalculator')}</span>
          </div>
          <div className="ProductForm-profitMargin-content">
            <div className="ProductForm-profitMargin-item">
              <span className="ProductForm-profitMargin-label">{t('markup')}:</span>
              <span className={`ProductForm-profitMargin-value ${profitInfo.margin >= 100 ? 'positive' : profitInfo.margin >= 50 ? 'neutral' : 'negative'}`}>
                {profitInfo.margin.toFixed(1)}%
              </span>
            </div>
            <div className="ProductForm-profitMargin-item">
              <span className="ProductForm-profitMargin-label">{t('multiplier')}:</span>
              <span className="ProductForm-profitMargin-value">
                {profitInfo.multiplier.toFixed(2)}x
              </span>
            </div>
            <div className="ProductForm-profitMargin-item">
              <span className="ProductForm-profitMargin-label">{t('profitAmount')}:</span>
              <span className="ProductForm-profitMargin-value">
                {profitInfo.profitIQD.toLocaleString('en-IQ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} IQD
              </span>
            </div>
            <div className="ProductForm-profitMargin-item">
              <span className="ProductForm-profitMargin-label">{t('profitUSD')}:</span>
              <span className="ProductForm-profitMargin-value">
                ${profitInfo.profitUSD.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="ProductForm-grid">
      </div>
      <div className="ProductForm-actions">
        <button type="button" onClick={onCancel} className="ProductForm-button ProductForm-button--ghost" disabled={loading}>
          {t('cancel')}
        </button>
        <button type="submit" className="ProductForm-button" disabled={loading}>
          {loading ? t('saving') : t('saveProduct')}
        </button>
      </div>
    </form>
  );
};

export default ProductForm;

