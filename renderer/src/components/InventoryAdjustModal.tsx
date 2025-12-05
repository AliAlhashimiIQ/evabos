import React, { useState } from 'react';
import { Product } from '../types/electron';
import './InventoryAdjustModal.css';
import NumberInput from './NumberInput';

interface InventoryAdjustModalProps {
  variant: Product;
  onClose: () => void;
  onSubmit: (payload: { variantId: number; deltaQuantity: number; reason: string; note?: string }) => Promise<void>;
}

const InventoryAdjustModal = ({ variant, onClose, onSubmit }: InventoryAdjustModalProps): JSX.Element => {
  const [quantityStr, setQuantityStr] = useState('');
  const [reason, setReason] = useState('manual_adjustment');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const quantity = Number(quantityStr);

    if (!quantityStr || isNaN(quantity) || quantity === 0) {
      setError('Enter a quantity adjustment (positive to add, negative to remove).');
      return;
    }
    if (!reason.trim()) {
      setError('Select a reason for the adjustment.');
      return;
    }

    try {
      setError(null);
      setLoading(true);
      await onSubmit({ variantId: variant.id, deltaQuantity: quantity, reason, note });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust inventory.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="InventoryAdjustModal-overlay">
      <div className="InventoryAdjustModal-card">
        <header>
          <div>
            <h3>Adjust Stock</h3>
            <p>
              {variant.productName} – {variant.color ?? 'Any'} / {variant.size ?? 'Any'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        {error && <div className="InventoryAdjustModal-alert">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>
            <span>Quantity Change</span>
            <NumberInput
              value={quantityStr}
              onChange={(event) => setQuantityStr(event.target.value)}
              placeholder="e.g. 5 or -2"
            />
          </label>

          <label>
            <span>Reason</span>
            <select value={reason} onChange={(event) => setReason(event.target.value)}>
              <option value="manual_adjustment">Manual adjustment</option>
              <option value="damage_loss">Damage or loss</option>
              <option value="found_stock">Found stock</option>
              <option value="correction">Correction</option>
            </select>
          </label>

          <label className="InventoryAdjustModal-span">
            <span>Note</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Optional details" />
          </label>

          <div className="InventoryAdjustModal-actions">
            <button type="button" onClick={onClose} className="ghost">
              Cancel
            </button>
            <button type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryAdjustModal;

