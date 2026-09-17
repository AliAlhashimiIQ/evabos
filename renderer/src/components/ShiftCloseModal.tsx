import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Printer, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { CurrentShiftSummary, ShiftClosingRecord } from '../types/electron';
import './ShiftCloseModal.css';

interface ShiftCloseModalProps {
  visible: boolean;
  onClose: () => void;
  branchId?: number;
  onShiftClosed: (closingRecord: ShiftClosingRecord) => void;
}

const IQD_DENOMINATIONS = [50000, 25000, 10000, 5000, 1000, 500, 250];

export const ShiftCloseModal: React.FC<ShiftCloseModalProps> = ({
  visible,
  onClose,
  branchId,
  onShiftClosed,
}) => {
  const { token, user } = useAuth();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<CurrentShiftSummary | null>(null);
  const [openingCash, setOpeningCash] = useState<number>(0);
  const [actualCashStr, setActualCashStr] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showDenomCalc, setShowDenomCalc] = useState(false);
  const [denoms, setDenoms] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);

  // Load shift summary
  const loadSummary = useCallback(async () => {
    if (!token || !window.evaApi) return;
    setLoading(true);
    setError(null);
    try {
      const data = await window.evaApi.shifts.getCurrentSummary(token, branchId);
      setSummary(data);
      setOpeningCash(data.openingCashIQD || 0);
      setActualCashStr(String(data.expectedCashIQD || 0));
    } catch (err) {
      console.error('Failed to load shift summary:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [token, branchId]);

  useEffect(() => {
    if (visible) {
      loadSummary();
      setNotes('');
      setShowDenomCalc(false);
      setDenoms({});
    }
  }, [visible, loadSummary]);

  // Support F9 shortcut while modal is open
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'F9') {
        e.preventDefault();
        e.stopPropagation();
        window.evaApi?.printing?.kickDrawer?.().catch(console.error);
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [visible, onClose]);

  // Calculate live expected cash
  const expectedCash = useMemo(() => {
    if (!summary) return 0;
    const cashIn = (openingCash || 0) + (summary.cashSalesIQD || 0) + (summary.mixedSalesIQD || 0) + (summary.exchangeCashIQD || 0);
    const cashOut = (summary.cashRefundsIQD || 0) + (summary.expensesIQD || 0);
    return Math.max(0, cashIn - cashOut);
  }, [summary, openingCash]);

  const actualCash = useMemo(() => {
    const parsed = parseFloat(actualCashStr.replace(/,/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }, [actualCashStr]);

  const difference = useMemo(() => {
    return actualCash - expectedCash;
  }, [actualCash, expectedCash]);

  // Denomination counter
  const handleDenomChange = (denom: number, countStr: string) => {
    const count = parseInt(countStr, 10) || 0;
    const updated = { ...denoms, [denom]: Math.max(0, count) };
    setDenoms(updated);

    const totalFromNotes = IQD_DENOMINATIONS.reduce((sum, d) => {
      return sum + d * (updated[d] || 0);
    }, 0);

    setActualCashStr(String(totalFromNotes));
  };

  // Submit Shift Close
  const handleSubmit = async () => {
    if (!token || !window.evaApi || !summary) return;
    setSubmitting(true);
    setError(null);
    try {
      const record = await window.evaApi.shifts.close(token, {
        branchId: summary.branchId,
        cashierId: user?.id || 1,
        openingCashIQD: openingCash,
        cashSalesIQD: summary.cashSalesIQD,
        cardSalesIQD: summary.cardSalesIQD,
        mixedSalesCashIQD: summary.mixedSalesIQD,
        mixedSalesCardIQD: 0,
        exchangeCashIQD: summary.exchangeCashIQD,
        cashRefundsIQD: summary.cashRefundsIQD,
        expensesIQD: summary.expensesIQD,
        expectedCashIQD: expectedCash,
        actualCashIQD: actualCash,
        differenceIQD: difference,
        notes: notes.trim() || null,
      });

      onShiftClosed(record);
      onClose();
    } catch (err) {
      console.error('Failed to close shift:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  const formattedShiftStart = summary?.shiftStartTime
    ? new Date(summary.shiftStartTime).toLocaleString('ar-IQ', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : '';

  return (
    <div className="ShiftCloseModal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ShiftCloseModal-container">
        {/* Header */}
        <div className="ShiftCloseModal-header">
          <div className="ShiftCloseModal-headerTitles">
            <h3>{t('closeShiftTitle') || 'إغلاق الصندوق والوردية (Z-Report)'}</h3>
            {summary && (
              <p>
                <span>{summary.branchName || 'EVA Main'}</span>
                <span>•</span>
                <span>بدء الوردية: {formattedShiftStart}</span>
                <span>•</span>
                <span>{summary.salesCount} عمليات بيع</span>
              </p>
            )}
          </div>
          <button className="ShiftCloseModal-closeBtn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="ShiftCloseModal-body">
          {error && (
            <div style={{ background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.25)', padding: '0.65rem 0.9rem', borderRadius: '0.5rem', color: '#dc2626', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              جاري جرد حركات الصندوق...
            </div>
          ) : summary ? (
            <>
              {/* Financial Movements Ledger */}
              <div className="ShiftCloseModal-ledger">
                <div className="ShiftCloseModal-ledgerRow">
                  <span className="ShiftCloseModal-ledgerLabel">رصيد الافتتاح (كاش بداية الوردية)</span>
                  <div className="ShiftCloseModal-floatInputWrapper">
                    <input
                      type="number"
                      className="ShiftCloseModal-floatInput"
                      value={openingCash}
                      onChange={(e) => setOpeningCash(parseFloat(e.target.value) || 0)}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>د.ع</span>
                  </div>
                </div>

                <div className="ShiftCloseModal-ledgerRow">
                  <span className="ShiftCloseModal-ledgerLabel">إجمالي مبيعات الكاش</span>
                  <span className="ShiftCloseModal-ledgerValue" style={{ color: '#059669' }}>
                    +{summary.cashSalesIQD.toLocaleString('en-IQ')} د.ع
                  </span>
                </div>

                {summary.exchangeCashIQD > 0 && (
                  <div className="ShiftCloseModal-ledgerRow">
                    <span className="ShiftCloseModal-ledgerLabel">مقبوضات الاستبدال النقدية</span>
                    <span className="ShiftCloseModal-ledgerValue" style={{ color: '#059669' }}>
                      +{summary.exchangeCashIQD.toLocaleString('en-IQ')} د.ع
                    </span>
                  </div>
                )}

                {summary.cashRefundsIQD > 0 && (
                  <div className="ShiftCloseModal-ledgerRow">
                    <span className="ShiftCloseModal-ledgerLabel">مستردات الإرجاع النقدية</span>
                    <span className="ShiftCloseModal-ledgerValue" style={{ color: '#dc2626' }}>
                      -{summary.cashRefundsIQD.toLocaleString('en-IQ')} د.ع
                    </span>
                  </div>
                )}

                {summary.expensesIQD > 0 && (
                  <div className="ShiftCloseModal-ledgerRow">
                    <span className="ShiftCloseModal-ledgerLabel">المصاريف النقدية المسحوبة</span>
                    <span className="ShiftCloseModal-ledgerValue" style={{ color: '#dc2626' }}>
                      -{summary.expensesIQD.toLocaleString('en-IQ')} د.ع
                    </span>
                  </div>
                )}

                {summary.cardSalesIQD > 0 && (
                  <div className="ShiftCloseModal-ledgerRow" style={{ opacity: 0.75 }}>
                    <span className="ShiftCloseModal-ledgerLabel">مبيعات البطاقة الإلكترونية (خارج الدرج)</span>
                    <span className="ShiftCloseModal-ledgerValue">
                      {summary.cardSalesIQD.toLocaleString('en-IQ')} د.ع
                    </span>
                  </div>
                )}
              </div>

              {/* Expected Total */}
              <div className="ShiftCloseModal-expectedRow">
                <span className="ShiftCloseModal-expectedLabel">الرصيد النقدي المتوقع بالدرج</span>
                <span className="ShiftCloseModal-expectedAmount">
                  {expectedCash.toLocaleString('en-IQ')} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>د.ع</span>
                </span>
              </div>

              {/* Actual Cash Count Input */}
              <div className="ShiftCloseModal-countBlock">
                <div className="ShiftCloseModal-countBlockTop">
                  <label htmlFor="actualCashInput">المبلغ الفعلي المحسوب في الدرج</label>
                  <span className="ShiftCloseModal-shortcutHint">F9 لفتح درج الكاش</span>
                </div>

                <div className="ShiftCloseModal-countInputWrapper">
                  <input
                    id="actualCashInput"
                    type="text"
                    className="ShiftCloseModal-countInput"
                    placeholder="0"
                    value={actualCashStr}
                    onChange={(e) => setActualCashStr(e.target.value)}
                    autoFocus
                  />
                  <span className="ShiftCloseModal-currencySuffix">د.ع</span>
                </div>

                <button
                  type="button"
                  className="ShiftCloseModal-denomToggle"
                  onClick={() => setShowDenomCalc(!showDenomCalc)}
                >
                  {showDenomCalc ? 'إخفاء حاسبة الفئات' : 'حاسبة فئات النقد (فئات الدنانير)'}
                </button>

                {showDenomCalc && (
                  <div className="ShiftCloseModal-denomGrid">
                    {IQD_DENOMINATIONS.map((d) => (
                      <div key={d} className="ShiftCloseModal-denomItem">
                        <label>{d.toLocaleString('en-IQ')}:</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={denoms[d] || ''}
                          onChange={(e) => handleDenomChange(d, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reconciliation Status */}
              {difference === 0 ? (
                <div className="ShiftCloseModal-varianceStatus balanced">
                  <span>الصندوق مطابق تماماً مع الحسابات الآلية</span>
                  <span>الفرق: 0 د.ع</span>
                </div>
              ) : difference > 0 ? (
                <div className="ShiftCloseModal-varianceStatus surplus">
                  <span>فائض وزيادة نقدية في الصندوق</span>
                  <span>+{difference.toLocaleString('en-IQ')} د.ع</span>
                </div>
              ) : (
                <div className="ShiftCloseModal-varianceStatus shortage">
                  <span>عجز ونقص نقدي في الصندوق</span>
                  <span>{difference.toLocaleString('en-IQ')} د.ع</span>
                </div>
              )}

              {/* Handover Notes */}
              <div className="ShiftCloseModal-notesField">
                <label>ملاحظات إغلاق الوردية (اختياري / سبب الفرق)</label>
                <textarea
                  className="ShiftCloseModal-textarea"
                  placeholder="أدخل أي ملاحظات تسليم أو توضيح سبب الفرق إن وجد..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="ShiftCloseModal-footer">
          <button type="button" className="ShiftCloseModal-btnCancel" onClick={onClose} disabled={submitting}>
            {t('cancel') || 'إلغاء'}
          </button>
          <button
            type="button"
            className="ShiftCloseModal-btnSubmit"
            onClick={handleSubmit}
            disabled={submitting || loading || !summary}
          >
            <Printer size={16} />
            <span>{submitting ? 'جاري الإغلاق...' : 'إغلاق الوردية وطباعة التقرير'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
