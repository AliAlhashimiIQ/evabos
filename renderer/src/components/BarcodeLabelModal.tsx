import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { useLanguage } from '../contexts/LanguageContext';
import './BarcodeLabelModal.css';

type Product = import('../types/electron').Product;

interface BarcodeLabelModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

interface LabelSettings {
  // labelSize removed, fixed to 50x25mm
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
  // labelSize fixed to 50x25mm
  showProductName: true,
  showVariant: true,
  showSku: true,
  showPrice: true,
  fontSize: 6,
  barcodeHeight: 25,
  barcodeWidth: 2,
  textAlign: 'center',
  labelPadding: 1,
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
    // Always return 50x25mm (using 48x23mm for safety margins)
    return { width: '48mm', height: '23mm' };
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
        padding: 0;
        width: ${dimensions.width};
        height: ${dimensions.height};
        box-sizing: border-box;
        font-family: Arial, sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        /* border: 1px solid #ddd; */ /* Removed border for print */
      }
      .label-name {
        font-size: ${settings.fontSize}px;
        font-weight: bold;
        color: #000;
        margin-bottom: 2px;
        line-height: 1.2;
        width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .label-price {
        font-size: ${settings.fontSize * 1.2}px;
        font-weight: 900;
        color: #000;
        margin-bottom: 2px;
        line-height: 1.2;
      }
      .label-store {
        font-size: ${settings.fontSize * 0.9}px;
        font-weight: bold;
        text-transform: uppercase;
        margin-bottom: 2px;
        width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .label-barcode {
        margin-top: 2px;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        flex: 1;
        min-height: 0;
      }
      .label-barcode img {
        max-width: 100%;
        height: 100%;
        max-height: ${settings.barcodeHeight}px;
        object-fit: contain;
      }
    </style>
  </head>
  <body>
    ${settings.showProductName && product.productName ? `<div class="label-name">${product.productName}</div>` : ''}
    ${settings.showPrice && product.salePriceIQD ? `<div class="label-price">${product.salePriceIQD.toLocaleString('en-IQ')} د.ع</div>` : ''}
    ${settings.showSku && product.sku ? `<div class="label-store">SKU: ${product.sku}</div>` : ''}
    ${settings.customText3 ? `<div class="label-store">${settings.customText3}</div>` : ''}
    <div class="label-barcode">
      <img src="${barcodeDataUrl}" alt="Barcode" />
    </div>
  </body>
</html>
    `;
  };

  const handlePrint = async () => {
    if (!window.evaApi) {
      alert(t('desktopBridgeUnavailable'));
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
        console.log(t('generatingPDF'));
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
            console.log(t('pdfGenerated'));
          }

          // Small delay between prints
          if (i < quantity - 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`Failed to print label ${i + 1}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          alert(t('failedToPrintLabel', { index: (i + 1).toString(), error: errorMessage }));
          return; // Stop printing on error
        }
      }

      // Only close if all prints succeeded
      onClose();
    } catch (error) {
      console.error('Failed to generate label HTML:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(t('failedToGenerateLabel', { error: errorMessage }));
    }
  };

  const dimensions = getLabelDimensions();

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
                    minHeight: '96px',
                    padding: `${settings.labelPadding}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    overflow: 'hidden',
                    textAlign: 'center',
                    border: '1px solid #ddd',
                    backgroundColor: '#fff'
                  }}
                >
                  {settings.showProductName && product.productName && (
                    <div
                      style={{
                        fontSize: `${settings.fontSize}px`,
                        fontWeight: 'bold',
                        color: '#000',
                        lineHeight: '1.2',
                        marginBottom: '2px',
                        width: '100%',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {product.productName}
                    </div>
                  )}
                  {settings.showPrice && product.salePriceIQD && (
                    <div style={{
                      fontSize: `${settings.fontSize * 1.2}px`,
                      fontWeight: '900',
                      color: '#000',
                      lineHeight: '1.2',
                      marginBottom: '2px',
                    }}>
                      {product.salePriceIQD.toLocaleString('en-IQ')} د.ع
                    </div>
                  )}
                  {settings.showSku && product.sku && (
                    <div style={{
                      fontSize: `${settings.fontSize * 0.9}px`,
                      fontWeight: 'bold',
                      color: '#000',
                      lineHeight: '1.2',
                      marginBottom: '2px',
                      width: '100%',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      SKU: {product.sku}
                    </div>
                  )}
                  {settings.customText3 && (
                    <div style={{
                      fontSize: `${settings.fontSize * 0.9}px`,
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      color: '#000',
                      lineHeight: '1.2',
                      width: '100%',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: '2px',
                    }}>
                      {settings.customText3}
                    </div>
                  )}
                  <div style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    minHeight: 0,
                    marginTop: '2px'
                  }}>
                    <canvas
                      ref={barcodeCanvasRef}
                      style={{
                        display: barcodeReady ? 'block' : 'none',
                        maxWidth: '100%',
                        maxHeight: settings.barcodeHeight,
                        height: '100%',
                        objectFit: 'contain',
                      }}
                    />
                    {!barcodeReady && (
                      <div style={{ padding: '10px', textAlign: 'center', color: '#999', fontSize: '10px' }}>
                        Generating...
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
    </div >
  );
};

export default BarcodeLabelModal;
