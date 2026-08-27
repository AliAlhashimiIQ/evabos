import React, { useState } from 'react';
import { Product } from '../types/electron';
import { useLanguage } from '../contexts/LanguageContext';
import { SlidersHorizontal, X } from 'lucide-react';
import NumberInput from './NumberInput';
import PortalModal from './PortalModal';
import './InventoryAdjustModal.css';

interface InventoryAdjustModalProps {
  variant: Product;
  onClose: () => void;
  onSubmit: (payload: {
    variantId: number;
    deltaQuantity: number;
    reason: string;
    note?: string;
  }) => Promise<void>;
}

const InventoryAdjustModal = ({
  variant,
  onClose,
  onSubmit,
}: InventoryAdjustModalProps): JSX.Element => {
  const { t } = useLanguage();
  const [quantityStr, setQuantityStr] = useState('');
  const [reason, setReason] = useState('manual_adjustment');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const quantity = Number(quantityStr);

    if (!quantityStr || isNaN(quantity) || quantity === 0) {
      setError(t('pricePositive') || 'Enter a valid non-zero quantity.');
      return;
    }

    try {
      setError(null);
      setLoading(true);
      await onSubmit({ variantId: variant.id, deltaQuantity: quantity, reason, note });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToAdjustStock'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalModal onClose={onClose}>
      <div className="InventoryAdjustModal-card">
        <header className="InventoryAdjustModal-header">
          <div className="InventoryAdjustModal-headerTitles">
            <h3>
              <SlidersHorizontal size={18} style={{ color: 'var(--accent-primary)' }} />
              <span>{t('adjustStock')}</span>
            </h3>
            <p>
              {variant.productName} • {[variant.color, variant.size].filter(Boolean).join(' / ') || '—'}
            </p>
          </div>
          <button className="InventoryAdjustModal-closeBtn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {error && <div className="InventoryAdjustModal-alert">{error}</div>}

        <form className="InventoryAdjustModal-form" onSubmit={handleSubmit}>
          <div className="InventoryAdjustModal-field">
            <label>{t('quantityChange')}</label>
            <NumberInput
              className="InventoryAdjustModal-input"
              value={quantityStr}
              onChange={(event) => setQuantityStr(event.target.value)}
              placeholder="مثال: 5+ أو 2-"
              required
            />
          </div>

          <div className="InventoryAdjustModal-field">
            <label>{t('reason')}</label>
            <select
              className="InventoryAdjustModal-select"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              <option value="manual_adjustment">{t('manualAdjustment')}</option>
              <option value="damage_loss">{t('damageLoss')}</option>
              <option value="found_stock">{t('foundStock')}</option>
              <option value="correction">{t('correction')}</option>
              <option value="supplier_return">{t('supplierReturn')}</option>
            </select>
          </div>

          <div className="InventoryAdjustModal-field">
            <label>{t('description')}</label>
            <textarea
              className="InventoryAdjustModal-textarea"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder={t('optionalDetails')}
            />
          </div>

          <div className="InventoryAdjustModal-actions">
            <button
              type="button"
              onClick={onClose}
              className="InventoryAdjustModal-btn"
              disabled={loading}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="InventoryAdjustModal-btn primary"
              disabled={loading}
            >
              {loading ? t('saving') : t('applyAdjustment')}
            </button>
          </div>
        </form>
      </div>
    </PortalModal>
  );
};

export default InventoryAdjustModal;
