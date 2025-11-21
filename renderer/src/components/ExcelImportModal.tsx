import React, { useRef, useState } from 'react';
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
      setError(err instanceof Error ? err.message : 'Failed to import Excel file');
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
      <div className="ExcelImportModal-content" onClick={(e) => e.stopPropagation()}>
        <div className="ExcelImportModal-header">
          <h2>Import Products from Excel</h2>
          <button className="ExcelImportModal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="ExcelImportModal-body">
          {!result ? (
            <>
              <div className="ExcelImportModal-instructions">
                <h3>Excel File Format</h3>
                <p>Your Excel file should have the following columns (first row is header):</p>
                <ul>
                  <li>
                    <strong>name</strong> (required) - Product name
                  </li>
                  <li>
                    <strong>code</strong> (optional) - Product code
                  </li>
                  <li>
                    <strong>category</strong> (optional) - Product category
                  </li>
                  <li>
                    <strong>description</strong> (optional) - Product description
                  </li>
                  <li>
                    <strong>color</strong> (optional) - Color variant
                  </li>
                  <li>
                    <strong>size</strong> (optional) - Size variant
                  </li>
                  <li>
                    <strong>Sale Price (IQD)</strong> (required) - Selling price in IQD
                  </li>
                  <li>
                    <strong>Purchase Cost (USD)</strong> (required) - Purchase cost in USD
                  </li>
                  <li>
                    <strong>Stock</strong> (optional) - Initial stock quantity
                  </li>
                  <li>
                    <strong>Barcode</strong> (optional) - Product barcode
                  </li>
                </ul>
              </div>

              <div className="ExcelImportModal-fileInput">
                <label>
                  <span>Select Excel File</span>
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
              {importing && <div className="ExcelImportModal-loading">Importing products... Please wait.</div>}
            </>
          ) : (
            <div className="ExcelImportModal-result">
              <h3>Import Complete</h3>
              <div className="ExcelImportModal-stats">
                <div className="ExcelImportModal-stat ExcelImportModal-stat--success">
                  <span>Successfully Imported</span>
                  <strong>{result.success}</strong>
                </div>
                <div className="ExcelImportModal-stat ExcelImportModal-stat--failed">
                  <span>Failed</span>
                  <strong>{result.failed}</strong>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="ExcelImportModal-errors">
                  <h4>Errors ({result.errors.length}):</h4>
                  <div className="ExcelImportModal-errorsList">
                    {result.errors.slice(0, 10).map((err, idx) => (
                      <div key={idx} className="ExcelImportModal-errorItem">
                        <strong>Row {err.row}:</strong> {err.error}
                      </div>
                    ))}
                    {result.errors.length > 10 && (
                      <div className="ExcelImportModal-errorItem">
                        ... and {result.errors.length - 10} more errors
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="ExcelImportModal-actions">
                <button onClick={handleReset}>Import Another File</button>
                <button onClick={onClose}>Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExcelImportModal;

