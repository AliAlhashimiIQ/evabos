import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { useLanguage } from '../contexts/LanguageContext';
import './BarcodeLabelModal.css';

interface BarcodeLabelModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

interface LabelSettings {
  labelSize: '2x1' | '4x2';
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
}

const defaultSettings: LabelSettings = {
  labelSize: '2x1',
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
};

const BarcodeLabelModal = ({ product, isOpen, onClose }: BarcodeLabelModalProps): JSX.Element | null => {
  const { t } = useLanguage();
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [printers, setPrinters] = useState<Array<{ name: string; description: string; isDefault: boolean }>>([]);
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [barcodeReady, setBarcodeReady] = useState<boolean>(false);
  const [settings, setSettings] = useState<LabelSettings>(defaultSettings);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Load settings from database
  useEffect(() => {
    if (!isOpen) return;
    const loadSettings = async () => {
      try {
        setLoadingSettings(true);
        const saved = await window.electronAPI.getSetting('label_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          setSettings({ ...defaultSettings, ...parsed });
        }
      } catch (err) {
        console.error('Failed to load label settings:', err);
      } finally {
        setLoadingSettings(false);
      }
    };
    loadSettings();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !barcodeCanvasRef.current || !product.barcode || loadingSettings) {
      setBarcodeReady(false);
      return;
    }

    // Generate barcode image
    try {
      const canvas = barcodeCanvasRef.current;
      // Set canvas size explicitly
      canvas.width = 300;
      canvas.height = 100;
      
      JsBarcode(canvas, product.barcode, {
        format: 'EAN13',
        width: settings.barcodeWidth,
        height: settings.barcodeHeight,
        displayValue: true,
        fontSize: 14,
        margin: 5,
        background: '#ffffff',
        lineColor: '#000000',
      });
      
      setBarcodeReady(true);
    } catch (error) {
      console.error('Failed to generate barcode:', error);
      setBarcodeReady(false);
    }
  }, [isOpen, product.barcode, settings.barcodeHeight, settings.barcodeWidth, loadingSettings]);

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    const loadPrinters = async () => {
      if (!window.evaApi) return;
      try {
        const list = await window.evaApi.printing.getPrinters();
        if (mounted) {
          setPrinters(list);
          const def = list.find((printer) => printer.isDefault);
          setPrinterName(def?.name ?? null);
        }
      } catch (err) {
        console.error('Failed to load printers', err);
      }
    };
    loadPrinters();
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  if (!product.barcode) {
    return (
      <div className="BarcodeLabelModal-overlay" onClick={onClose}>
        <div className="BarcodeLabelModal-content" onClick={(e) => e.stopPropagation()}>
          <div className="BarcodeLabelModal-header">
            <h2>{t('printBarcodeLabel')}</h2>
            <button className="BarcodeLabelModal-close" onClick={onClose}>
              ✕
            </button>
          </div>
          <div className="BarcodeLabelModal-body">
            <div className="BarcodeLabelModal-error">
              {t('thisProductNoBarcode')}
            </div>
            <div className="BarcodeLabelModal-footer">
              <button onClick={onClose}>{t('close')}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getLabelDimensions = () => {
    switch (settings.labelSize) {
      case '2x1':
        return { width: '2in', height: '1in' };
      case '4x2':
        return { width: '4in', height: '2in' };
      default:
        return { width: '2in', height: '1in' };
    }
  };

  const generateLabelHtml = (): string => {
    const dimensions = getLabelDimensions();
    
    // Ensure barcode is ready
    if (!barcodeCanvasRef.current || !barcodeReady) {
      throw new Error('Barcode not ready for printing');
    }
    
    const barcodeDataUrl = barcodeCanvasRef.current.toDataURL('image/png');

    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      @page {
        size: ${dimensions.width} ${dimensions.height};
        margin: 0;
      }
      body {
        margin: 0;
        padding: ${settings.labelPadding}px;
        width: ${dimensions.width};
        height: ${dimensions.height};
        box-sizing: border-box;
        font-family: Arial, sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: ${settings.labelSize === '2x1' ? 'space-evenly' : 'space-between'};
        align-items: ${settings.textAlign === 'left' ? 'flex-start' : settings.textAlign === 'right' ? 'flex-end' : 'center'};
        overflow: hidden;
      }
      .label-header {
        text-align: ${settings.textAlign};
        width: 100%;
        flex-shrink: 0;
        max-height: ${settings.labelSize === '2x1' ? '20%' : '30%'};
        overflow: hidden;
      }
      .label-name {
        font-size: ${settings.fontSize}px;
        font-weight: bold;
        margin-bottom: ${settings.labelSize === '2x1' ? '2px' : '4px'};
        word-wrap: break-word;
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: ${settings.labelSize === '2x1' ? '1' : '2'};
        -webkit-box-orient: vertical;
        text-align: ${settings.textAlign};
      }
      .label-price {
        font-size: ${settings.fontSize * 0.9}px;
        font-weight: bold;
        color: #000;
        margin-bottom: ${settings.labelSize === '2x1' ? '2px' : '4px'};
        line-height: 1.2;
        text-align: ${settings.textAlign};
      }
      .label-custom {
        font-size: ${settings.fontSize * 0.8}px;
        color: #333;
        margin-bottom: ${settings.labelSize === '2x1' ? '2px' : '4px'};
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: ${settings.textAlign};
      }
      .label-barcode {
        text-align: ${settings.textAlign};
        margin: ${settings.labelSize === '2x1' ? '1px 0' : '4px 0'};
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 0;
      }
      .label-barcode img {
        max-width: 95%;
        height: auto;
        max-height: ${settings.labelSize === '2x1' ? '30px' : '60px'};
        object-fit: contain;
      }
      .label-footer {
        text-align: ${settings.textAlign};
        width: 100%;
        font-size: ${settings.fontSize * 0.75}px;
        line-height: 1.1;
        flex-shrink: 0;
        max-height: ${settings.labelSize === '2x1' ? '15%' : '20%'};
      }
      .label-sku {
        font-family: 'Courier New', monospace;
        color: #333;
        margin-top: ${settings.labelSize === '2x1' ? '0px' : '4px'};
        font-size: ${settings.fontSize * 0.7}px;
        line-height: 1;
      }
    </style>
  </head>
  <body>
    <div class="label-header">
      ${product.productName ? `<div class="label-name">${product.productName}</div>` : ''}
      ${product.salePriceIQD ? `<div class="label-price">${product.salePriceIQD.toLocaleString('en-IQ')} د.ع</div>` : ''}
      ${settings.customText3 ? `<div class="label-custom">${settings.customText3}</div>` : ''}
    </div>
    <div class="label-barcode">
      <img src="${barcodeDataUrl}" alt="Barcode" />
    </div>
    <div class="label-footer">
      ${settings.showSku ? `<div class="label-sku">SKU: ${product.sku}</div>` : ''}
    </div>
  </body>
</html>
    `;
  };

  const handlePrint = async () => {
    if (!window.evaApi) {
      alert('Desktop bridge unavailable');
      return;
    }

    if (!barcodeReady || !barcodeCanvasRef.current) {
      alert(t('barcodeNotReady'));
      return;
    }

    try {
      // Generate HTML for each label
      const labelHtml = generateLabelHtml();

      // For PDF printing, show a message
      const isPdfPrinter = printerName?.toLowerCase().includes('pdf') ?? false;
      if (isPdfPrinter) {
        // Show info message for PDF
        console.log('Generating PDF - save dialog will appear');
      }

      // Print multiple labels
      for (let i = 0; i < quantity; i++) {
        try {
          console.log(`Printing label ${i + 1} of ${quantity}...`);
          console.log('HTML length:', labelHtml.length);
          console.log('Printer:', printerName);
          
          await window.evaApi.printing.print({ html: labelHtml, printerName });
          console.log(`Label ${i + 1} printed successfully`);
          
          // For PDF, show message after first print
          if (isPdfPrinter && i === 0) {
            // Message is handled by the save dialog in the main process
            console.log('PDF generated successfully');
          }
          
          // Small delay between prints
          if (i < quantity - 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`Failed to print label ${i + 1}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          alert(`Failed to print label ${i + 1}: ${errorMessage}\n\nCheck the browser console (F12) for more details.`);
          return; // Stop printing on error
        }
      }

      // Only close if all prints succeeded
      onClose();
    } catch (error) {
      console.error('Failed to generate label HTML:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to generate label: ${errorMessage}\n\nCheck the browser console (F12) for more details.`);
    }
  };

  const dimensions = getLabelDimensions();

  return (
    <div className="BarcodeLabelModal-overlay" onClick={onClose}>
      <div className="BarcodeLabelModal-content" onClick={(e) => e.stopPropagation()}>
        <div className="BarcodeLabelModal-header">
          <h2>Print Barcode Label</h2>
          <button className="BarcodeLabelModal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="BarcodeLabelModal-body">
          {loadingSettings ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
              {t('loadingLabelSettings')}
            </div>
          ) : (
            <>
              <div className="BarcodeLabelModal-controls">
            <div className="BarcodeLabelModal-controlGroup">
              <label>
                    {t('quantity')}
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                />
              </label>
            </div>

            <div className="BarcodeLabelModal-controlGroup">
              <label>
                    {t('printer')}
                <select value={printerName ?? ''} onChange={(e) => setPrinterName(e.target.value || null)}>
                      <option value="">{t('systemDefault')}</option>
                  {printers.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.name} {printer.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="BarcodeLabelModal-preview">
            <h3>{t('preview')}</h3>
            <div
              className="BarcodeLabelModal-previewLabel"
              style={{
                width: dimensions.width,
                height: dimensions.height,
                minHeight: settings.labelSize === '2x1' ? '96px' : '192px',
                padding: `${settings.labelPadding}px`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: settings.labelSize === '2x1' ? 'space-evenly' : 'space-between',
                alignItems: settings.textAlign === 'left' ? 'flex-start' : settings.textAlign === 'right' ? 'flex-end' : 'center',
                overflow: 'hidden',
              }}
            >
              <div className="BarcodeLabelModal-previewHeader" style={{ textAlign: settings.textAlign, width: '100%', flexShrink: 0, maxHeight: settings.labelSize === '2x1' ? '20px' : 'auto' }}>
                {settings.customText1 && (
                  <div style={{ fontSize: `${settings.fontSize * 0.8}px`, color: '#333', lineHeight: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>
                    {settings.customText1}
                  </div>
                )}
                {product.productName && (
                  <div 
                    className="BarcodeLabelModal-previewName" 
                    style={{ 
                      fontSize: `${settings.fontSize}px`, 
                      fontWeight: 'bold',
                      lineHeight: '1.2',
                      marginBottom: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: settings.labelSize === '2x1' ? 1 : 2,
                      WebkitBoxOrient: 'vertical',
                      textAlign: settings.textAlign,
                    }}
                  >
                    {product.productName}
                  </div>
                )}
                {product.salePriceIQD && (
                  <div style={{ 
                    fontSize: `${settings.fontSize * 0.9}px`, 
                    fontWeight: 'bold',
                    color: '#000', 
                    lineHeight: '1.2', 
                    marginBottom: '4px',
                    textAlign: settings.textAlign,
                  }}>
                    {product.salePriceIQD.toLocaleString('en-IQ')} د.ع
                  </div>
                )}
                {settings.customText3 && (
                  <div style={{ 
                    fontSize: `${settings.fontSize * 0.8}px`, 
                    color: '#333', 
                    lineHeight: '1.2', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap', 
                    marginBottom: '2px',
                    textAlign: settings.textAlign,
                  }}>
                    {settings.customText3}
                  </div>
                )}
              </div>
              <div className="BarcodeLabelModal-previewBarcode" style={{ textAlign: settings.textAlign, flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                <canvas 
                  ref={barcodeCanvasRef} 
                  style={{ 
                    display: barcodeReady ? 'block' : 'none', 
                    maxWidth: '95%', 
                    maxHeight: settings.labelSize === '2x1' ? '30px' : '60px',
                    height: 'auto',
                    objectFit: 'contain',
                  }} 
                />
                {!barcodeReady && (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                    Generating barcode...
                  </div>
                )}
              </div>
              <div className="BarcodeLabelModal-previewFooter" style={{ textAlign: settings.textAlign, fontSize: `${settings.fontSize * 0.75}px`, width: '100%', flexShrink: 0, lineHeight: '1.1' }}>
                {settings.showSku && (
                  <div className="BarcodeLabelModal-previewSku" style={{ fontSize: `${settings.fontSize * 0.7}px`, lineHeight: '1' }}>
                    SKU: {product.sku}
                  </div>
                )}
                {settings.showPrice && (
                  <div className="BarcodeLabelModal-previewPrice" style={{ fontSize: `${settings.fontSize * 0.85}px`, lineHeight: '1' }}>
                    {product.salePriceIQD.toLocaleString('en-IQ')} IQD
                  </div>
                )}
              </div>
            </div>
            <p className="BarcodeLabelModal-previewNote">
              {t('size')}: {dimensions.width} × {dimensions.height} | {t('quantity')}: {quantity}
              <br />
              <small style={{ color: '#999', fontSize: '0.85rem' }}>
                {t('customizeInSettings')}
              </small>
            </p>
          </div>
            </>
          )}
        </div>

        <div className="BarcodeLabelModal-footer">
          <button className="BarcodeLabelModal-cancelButton" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="BarcodeLabelModal-printButton" 
            onClick={handlePrint}
            disabled={!barcodeReady}
          >
            Print {quantity > 1 ? `${quantity} Labels` : 'Label'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarcodeLabelModal;

