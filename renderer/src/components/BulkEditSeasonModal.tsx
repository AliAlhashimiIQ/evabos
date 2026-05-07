import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import PortalModal from './PortalModal';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import './BulkEditSeasonModal.css';

interface BulkEditSeasonModalProps {
  productIds: number[];
  onClose: () => void;
  onComplete: () => void;
  existingSeasons: string[];
}

const BulkEditSeasonModal: React.FC<BulkEditSeasonModalProps> = ({
  productIds,
  onClose,
  onComplete,
  existingSeasons,
}) => {
  const [season, setSeason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, isRTL } = useLanguage();
  const { token } = useAuth();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.evaApi || !token) return;

    setIsUpdating(true);
    setError(null);

    try {
      await window.evaApi.products.bulkUpdate(token, {
        productIds,
        season: season || null,
      });
      onComplete();
      onClose();
    } catch (err: any) {
      setError(err.message || t('failedToUpdateProduct'));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <PortalModal onClose={onClose}>
      <div className="BulkEditSeasonModal" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="BulkEditSeasonModal-header">
          <h2>{t('bulkUpdateSeasonTitle')}</h2>
          <button className="BulkEditSeasonModal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleUpdate} className="BulkEditSeasonModal-body">
          <p className="BulkEditSeasonModal-info">
            {t('bulkUpdateInfo', { count: productIds.length })}
          </p>

          <div className="BulkEditSeasonModal-field">
            <label htmlFor="bulk-season">{t('newSeason')}</label>
            <input
              id="bulk-season"
              type="text"
              list="bulk-seasons-list"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="e.g. Winter 2026"
              autoFocus
            />
            <datalist id="bulk-seasons-list">
              {existingSeasons.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <p className="BulkEditSeasonModal-help">
              {t('bulkUpdateHelp')}
            </p>
          </div>

          {error && <div className="BulkEditSeasonModal-error">{error}</div>}

          <div className="BulkEditSeasonModal-footer">
            <button
              type="button"
              className="BulkEditSeasonModal-cancel"
              onClick={onClose}
              disabled={isUpdating}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="BulkEditSeasonModal-submit"
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> {t('updating')}
                </>
              ) : (
                t('updateProducts')
              )}
            </button>
          </div>
        </form>
      </div>
    </PortalModal>
  );
};

export default BulkEditSeasonModal;
