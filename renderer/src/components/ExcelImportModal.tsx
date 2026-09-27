import React, { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './ExcelImportModal.css';

type ExcelImportResult = import('../types/electron').ExcelImportResult;

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ExcelImportModal = ({ isOpen, onClose, onSuccess }: ExcelImportModalProps): JSX.Element | null => {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ExcelImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError('Please select a valid Excel file (.xlsx or .xls)');
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      // Read file as ArrayBuffer and convert to number array
      // Electron IPC will convert this to Buffer on the main process side
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const bufferArray = Array.from(uint8Array);

      if (!window.evaApi || !token) {
        throw new Error('Desktop bridge unavailable');
      }

      const importResult = await window.evaApi.products.importExcel(token, {
        fileBuffer: bufferArray,
      });

      setResult(importResult);

      if (importResult.success > 0) {
        // Refresh product list after successful import
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل في استيراد ملف Excel');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="ExcelImportModal-overlay" onClick={onClose}>
      <div className="ExcelImportModal-content" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="ExcelImportModal-header">
          <h2>استيراد المنتجات من ملف Excel</h2>
          <button className="ExcelImportModal-close" onClick={onClose} aria-label="إغلاق" title="إغلاق">
            <X size={18} />
          </button>
        </div>

        <div className="ExcelImportModal-body">
          {!result ? (
            <>
              <div className="ExcelImportModal-instructions">
                <h3>تنسيق ملف Excel المطلوب</h3>
                <p>يجب أن يحتوي ملف Excel على الأعمدة التالية في الصف الأول (عناوين الأعمدة بالإنجليزية أو العربية):</p>
                <ul>
                  <li>
                    <strong>name</strong> (مطلوب) - اسم المنتج
                  </li>
                  <li>
                    <strong>code</strong> (اختياري) - كود المنتج / الرمز
                  </li>
                  <li>
                    <strong>category</strong> (اختياري) - قسم / تصنيف المنتج
                  </li>
                  <li>
                    <strong>description</strong> (اختياري) - وصف المنتج
                  </li>
                  <li>
                    <strong>color</strong> (اختياري) - اللون (المتغير)
                  </li>
                  <li>
                    <strong>size</strong> (اختياري) - القياس / المقاس
                  </li>
                  <li>
                    <strong>Sale Price (IQD)</strong> (مطلوب) - سعر البيع بالدينار العراقي
                  </li>
                  <li>
                    <strong>Purchase Cost (USD)</strong> (مطلوب) - تكلفة الشراء بالدولار
                  </li>
                  <li>
                    <strong>Stock</strong> (اختياري) - الكمية الأولية في المخزون
                  </li>
                  <li>
                    <strong>Barcode</strong> (اختياري) - الباركود
                  </li>
                </ul>
              </div>

              <div className="ExcelImportModal-fileInput">
                <label>
                  <span>اختر ملف Excel (.xlsx, .xls)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    disabled={importing}
                  />
                </label>
              </div>

              {error && <div className="ExcelImportModal-error">{error}</div>}
              {importing && <div className="ExcelImportModal-loading">جاري استيراد المنتجات... يرجى الانتظار.</div>}
            </>
          ) : (
            <div className="ExcelImportModal-result">
              <h3>اكتمل الاستيراد</h3>
              <div className="ExcelImportModal-stats">
                <div className="ExcelImportModal-stat ExcelImportModal-stat--success">
                  <span>تم استيرادها بنجاح</span>
                  <strong>{result.success}</strong>
                </div>
                <div className="ExcelImportModal-stat ExcelImportModal-stat--failed">
                  <span>فشل الاستيراد</span>
                  <strong>{result.failed}</strong>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="ExcelImportModal-errors">
                  <h4>الأخطاء ({result.errors.length}):</h4>
                  <div className="ExcelImportModal-errorsList">
                    {result.errors.slice(0, 10).map((err, idx) => (
                      <div key={idx} className="ExcelImportModal-errorItem">
                        <strong>السطر {err.row}:</strong> {err.error}
                      </div>
                    ))}
                    {result.errors.length > 10 && (
                      <div className="ExcelImportModal-errorItem">
                        ... و {result.errors.length - 10} أخطاء أخرى
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="ExcelImportModal-actions">
                <button onClick={handleReset}>استيراد ملف آخر</button>
                <button onClick={onClose}>إغلاق</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExcelImportModal;

