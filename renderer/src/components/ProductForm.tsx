import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
type Supplier = import('../types/electron').Supplier;
import './ProductForm.css';

interface ProductFormProps {
  onSubmit: (payload: ProductInput) => Promise<void> | void;
  onCancel: () => void;
  loading?: boolean;
}

const initialState: ProductInput = {
  name: '',
  code: '',
  barcode: '',
  category: '',
  description: '',
  color: '',
  size: '',
  salePriceIQD: 0,
  purchaseCostUSD: 0,
  supplierId: undefined,
};

const ProductForm = ({ onSubmit, onCancel, loading }: ProductFormProps): JSX.Element => {
  const { token } = useAuth();
  const [formState, setFormState] = useState<ProductInput>(initialState);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(1470); // Default exchange rate

  const handleChange =
    (field: keyof ProductInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setFormState((prev) => ({
      ...prev,
      [field]: field === 'salePriceIQD' || field === 'purchaseCostUSD' ? Number(value) || 0 : value,
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
    const { purchaseCostUSD, salePriceIQD } = formState;
    
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
      setFormError('Name is required.');
      return;
    }

    if (!Number.isFinite(formState.salePriceIQD) || formState.salePriceIQD <= 0) {
      setFormError('Sale price must be a positive number.');
      return;
    }

    try {
      setFormError(null);
      await onSubmit(formState);
      setFormState(initialState);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create product.');
    }
  };

  return (
    <form className="ProductForm" onSubmit={handleSubmit}>
      {formError && <div className="ProductForm-alert">{formError}</div>}
      <div className="ProductForm-grid">
        <label>
          <span>Name</span>
          <input type="text" value={formState.name} onChange={handleChange('name')} required />
        </label>
        <label>
          <span>Supplier</span>
          <select
            value={formState.supplierId ?? ''}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                supplierId: event.target.value ? Number(event.target.value) : undefined,
              }))
            }
          >
            <option value="">Select supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Code</span>
          <input type="text" value={formState.code ?? ''} onChange={handleChange('code')} />
        </label>
        <label>
          <span>Barcode</span>
          <input type="text" value={formState.barcode ?? ''} onChange={handleChange('barcode')} />
        </label>
        <label>
          <span>Category</span>
          <input type="text" value={formState.category ?? ''} onChange={handleChange('category')} />
        </label>
        <label className="ProductForm-span">
          <span>Description</span>
          <textarea value={formState.description ?? ''} onChange={handleChange('description')} rows={3} />
        </label>
        <label>
          <span>Color</span>
          <input type="text" value={formState.color ?? ''} onChange={handleChange('color')} />
        </label>
        <label>
          <span>Size</span>
          <input type="text" value={formState.size ?? ''} onChange={handleChange('size')} />
        </label>
        <label>
          <span>Sale Price (IQD)</span>
          <input
            type="number"
            min="0"
            step="100"
            value={formState.salePriceIQD}
            onChange={handleChange('salePriceIQD')}
            required
          />
        </label>
        <label>
          <span>Purchase Cost (USD)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formState.purchaseCostUSD}
            onChange={handleChange('purchaseCostUSD')}
          />
        </label>
      </div>

      {/* Profit Margin Display */}
      {profitInfo && (
        <div className="ProductForm-profitMargin">
          <div className="ProductForm-profitMargin-header">
            <span className="ProductForm-profitMargin-icon">📊</span>
            <span className="ProductForm-profitMargin-title">Profit Calculator</span>
          </div>
          <div className="ProductForm-profitMargin-content">
            <div className="ProductForm-profitMargin-item">
              <span className="ProductForm-profitMargin-label">Markup:</span>
              <span className={`ProductForm-profitMargin-value ${profitInfo.margin >= 100 ? 'positive' : profitInfo.margin >= 50 ? 'neutral' : 'negative'}`}>
                {profitInfo.margin.toFixed(1)}%
              </span>
            </div>
            <div className="ProductForm-profitMargin-item">
              <span className="ProductForm-profitMargin-label">Multiplier:</span>
              <span className="ProductForm-profitMargin-value">
                {profitInfo.multiplier.toFixed(2)}x
              </span>
            </div>
            <div className="ProductForm-profitMargin-item">
              <span className="ProductForm-profitMargin-label">Profit:</span>
              <span className="ProductForm-profitMargin-value">
                {profitInfo.profitIQD.toLocaleString('en-IQ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} IQD
              </span>
            </div>
            <div className="ProductForm-profitMargin-item">
              <span className="ProductForm-profitMargin-label">Profit (USD):</span>
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
          Cancel
        </button>
        <button type="submit" className="ProductForm-button" disabled={loading}>
          {loading ? 'Saving…' : 'Save Product'}
        </button>
      </div>
    </form>
  );
};

export default ProductForm;

