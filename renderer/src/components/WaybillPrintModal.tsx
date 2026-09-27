import React, { useEffect, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer, X, Loader2, FileText, Smartphone, MapPin, User, Package } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import './WaybillPrintModal.css';

type OnlineOrder = import('../types/electron').OnlineOrder;

interface WaybillPrintModalProps {
  visible: boolean;
  onClose: () => void;
  order: OnlineOrder | null;
  printerName?: string | null;
  onPrinterChange?: (printer: string | null) => void;
}

export const generateWaybillHtml = (
  order: OnlineOrder,
  storeSettings: {
    storeName: string;
    phone: string;
    address: string;
    logoBase64: string;
    showLogo: boolean;
  },
  barcodeDataUrl?: string
): string => {
  const dateFormatted = new Date(order.createdAt).toLocaleString('ar-IQ', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const sourceName =
    order.source === 'instagram'
      ? 'Instagram'
      : order.source === 'whatsapp'
      ? 'WhatsApp'
      : order.source === 'tiktok'
      ? 'TikTok'
      : order.source === 'phone'
      ? 'هاتف'
      : 'أخرى';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <title>فاتورة شحن #${order.id}</title>
  <style>
    @page {
      size: 72mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif, 'Courier New';
      width: 100%;
      max-width: 70mm;
      margin: 0 auto;
      padding: 3mm 3mm 15mm;
      font-size: 13px;
      line-height: 1.35;
      color: #000;
      background: #fff;
    }
    @media print {
      body {
        margin: 0 auto;
        padding: 2mm 3mm 25mm !important;
        box-shadow: none;
      }
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .bold { font-weight: 800; }
    
    .divider-solid {
      border-bottom: 2px solid #000;
      margin: 6px 0;
    }
    .divider-dashed {
      border-bottom: 1.5px dashed #000;
      margin: 6px 0;
    }
    .divider-double {
      border-bottom: 3px double #000;
      margin: 8px 0;
    }

    /* Store Header */
    .store-header {
      text-align: center;
      margin-bottom: 6px;
    }
    .store-logo {
      max-width: 130px;
      max-height: 50px;
      object-fit: contain;
      margin-bottom: 4px;
    }
    .store-name {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .store-sub {
      font-size: 11px;
      color: #222;
    }

    /* Waybill Badge */
    .waybill-badge {
      text-align: center;
      border: 2px solid #000;
      padding: 4px;
      margin: 6px 0;
      font-weight: 900;
      font-size: 14px;
      background: #000;
      color: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      letter-spacing: 0.5px;
    }

    .order-meta-grid {
      font-size: 11px;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #ccc;
      padding-bottom: 4px;
    }

    /* Barcode Section */
    .barcode-section {
      text-align: center;
      margin: 6px 0 8px;
    }
    .barcode-img {
      max-width: 95%;
      height: 42px;
      display: block;
      margin: 0 auto;
    }
    .order-num-text {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 2px;
      margin-top: 2px;
    }

    /* Customer Info Box */
    .customer-box {
      border: 2px solid #000;
      border-radius: 4px;
      padding: 6px;
      margin: 8px 0;
      background: #fff;
    }
    .customer-title {
      font-size: 12px;
      font-weight: 900;
      border-bottom: 1px solid #000;
      padding-bottom: 3px;
      margin-bottom: 4px;
      display: flex;
      justify-content: space-between;
    }
    .cust-row {
      margin: 3px 0;
      font-size: 12px;
      display: flex;
      align-items: flex-start;
      gap: 4px;
    }
    .cust-phone {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 1px;
      direction: ltr;
      display: inline-block;
    }
    .cust-note {
      font-size: 12px;
      font-weight: 700;
      background: #eee;
      padding: 3px 5px;
      border-radius: 3px;
      margin-top: 4px;
      border: 1px dashed #777;
    }

    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin: 8px 0;
    }
    .items-table th {
      border-bottom: 2px solid #000;
      padding: 4px 1px;
      font-weight: 900;
      font-size: 11px;
    }
    .items-table td {
      border-bottom: 1px dashed #777;
      padding: 4px 1px;
      vertical-align: top;
    }
    .check-box {
      display: inline-block;
      width: 13px;
      height: 13px;
      border: 1.5px solid #000;
      margin-left: 3px;
      vertical-align: middle;
    }
    .item-desc {
      font-weight: 800;
      font-size: 12px;
    }
    .item-variant {
      font-size: 10px;
      color: #333;
    }

    /* Totals / COD Box */
    .cod-box {
      border: 2.5px solid #000;
      padding: 8px 6px;
      margin: 10px 0 6px;
      text-align: center;
      background: #fdfdfd;
    }
    .cod-label {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .cod-amount {
      font-size: 21px;
      font-weight: 900;
      margin: 4px 0;
      letter-spacing: 0.5px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      margin: 2px 0;
    }

    /* Footer & Signatures */
    .waybill-footer {
      margin-top: 10px;
      font-size: 10px;
      text-align: center;
      color: #333;
    }
    .signature-row {
      display: flex;
      justify-content: space-between;
      margin-top: 18px;
      padding-top: 6px;
      font-size: 10.5px;
      font-weight: 700;
    }
    .sign-line {
      border-top: 1px dotted #000;
      width: 45%;
      text-align: center;
      padding-top: 2px;
    }
  </style>
</head>
<body>

  <!-- Store Header -->
  <div class="store-header">
    ${storeSettings.showLogo && storeSettings.logoBase64 ? `<img src="${storeSettings.logoBase64}" class="store-logo" alt="Logo" />` : ''}
    <div class="store-name">${storeSettings.storeName || 'Madar POS'}</div>
    ${storeSettings.phone ? `<div class="store-sub">هاتف المتجر: ${storeSettings.phone}</div>` : ''}
    ${storeSettings.address ? `<div class="store-sub">${storeSettings.address}</div>` : ''}
  </div>

  <div class="waybill-badge">
    فاتورة شحن وتوصيل • SHIPPING INVOICE
  </div>

  <div class="order-meta-grid">
    <div><strong>التاريخ:</strong> ${dateFormatted}</div>
    <div><strong>المصدر:</strong> ${sourceName}</div>
  </div>

  <!-- Barcode -->
  <div class="barcode-section">
    ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" class="barcode-img" alt="Barcode" />` : ''}
    <div class="order-num-text">#${order.id}</div>
  </div>

  <!-- Customer Box -->
  <div class="customer-box">
    <div class="customer-title">
      <span>بيانات الزبون والمستلم</span>
    </div>
    <div class="cust-row">
      <strong>الاسم:</strong>
      <span class="bold">${order.customerName || 'زبون عام (أونلاين)'}</span>
    </div>
    <div class="cust-row">
      <strong>الهاتف:</strong>
      <span class="cust-phone">${order.customerPhone || '— لا يوجد رقم —'}</span>
    </div>
    ${order.note ? `
    <div class="cust-note">
      <strong>العنوان / ملاحظة التوصيل:</strong><br />
      ${order.note}
    </div>` : ''}
  </div>

  <div class="divider-dashed"></div>

  <!-- Items Checklist -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 15%;">فحص</th>
        <th style="width: 50%;">المنتج</th>
        <th style="width: 15%; text-align: center;">العدد</th>
        <th style="width: 20%; text-align: left;">السعر</th>
      </tr>
    </thead>
    <tbody>
      ${order.items.map(item => `
        <tr>
          <td style="text-align: center;"><span class="check-box"></span></td>
          <td>
            <div class="item-desc">${item.productName}</div>
            ${item.color || item.size ? `<div class="item-variant">${[item.color, item.size].filter(Boolean).join(' • ')}</div>` : ''}
          </td>
          <td style="text-align: center;" class="bold">${item.quantity}</td>
          <td style="text-align: left;">${item.lineTotalIQD.toLocaleString('en-IQ')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- Subtotal & Discount if applicable -->
  ${order.discountIQD > 0 ? `
    <div class="summary-row">
      <span>المجموع الفرعي:</span>
      <span>${order.subtotalIQD.toLocaleString('en-IQ')} د.ع</span>
    </div>
    <div class="summary-row">
      <span>الخصم الممنوح:</span>
      <span>-${order.discountIQD.toLocaleString('en-IQ')} د.ع</span>
    </div>
  ` : ''}

  <!-- COD Total Box -->
  <div class="cod-box">
    <div class="cod-label">المبلغ المطلوب تحصيله عند التسليم (COD)</div>
    <div class="cod-amount">${order.totalIQD.toLocaleString('en-IQ')} د.ع</div>
    <div style="font-size: 10.5px; color: #333;">(شامل المواد المذكورة أعلاه)</div>
  </div>

  <div class="signature-row">
    <div class="sign-line">توقيع المجهز / الكاشير</div>
    <div class="sign-line">توقيع المستلم / المندوب</div>
  </div>

  <div class="waybill-footer">
    <div>يرجى معاينة الطلب والتأكد من سلامة الشحنة عند الاستلام</div>
    <div style="margin-top: 3px; font-weight: 700;">طُبع بواسطة نظام كاشير Madar POS</div>
  </div>

  <!-- Thermal Paper Feed Spacer (advances paper cleanly past cutter/tear bar and exit mouth) -->
  <div style="height: 60mm; width: 100%; clear: both;"></div>
  <div style="text-align: center; font-size: 10px; color: #000000; font-weight: bold; line-height: 1; clear: both;">.</div>
  <div style="height: 15mm; width: 100%; clear: both;"></div>

</body>
</html>`;
};

const WaybillPrintModal: React.FC<WaybillPrintModalProps> = ({
  visible,
  onClose,
  order,
  printerName: propPrinterName,
  onPrinterChange,
}) => {
  const toast = useToast();
  const [printers, setPrinters] = useState<Array<{ name: string; description: string; isDefault: boolean }>>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(propPrinterName || null);
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [storeSettings, setStoreSettings] = useState({
    storeName: 'Madar POS',
    phone: '',
    address: '',
    logoBase64: '',
    showLogo: true,
  });

  // Load available printers
  useEffect(() => {
    if (!visible) return;
    const fetchPrinters = async () => {
      try {
        if (window.evaApi?.printing?.getPrinters) {
          const list = await window.evaApi.printing.getPrinters();
          setPrinters(list || []);
          if (!selectedPrinter && list && list.length > 0) {
            const def = list.find((p: { isDefault?: boolean; name: string }) => p.isDefault) || list[0];
            setSelectedPrinter(def.name);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch printers:', err);
      }
    };
    fetchPrinters();
  }, [visible]);

  // Load store details from settings
  useEffect(() => {
    if (!visible) return;
    const loadSettings = async () => {
      try {
        const storeName = (await window.electronAPI?.getSetting('receipt_store_name')) || 'Madar POS';
        const phone = (await window.electronAPI?.getSetting('receipt_store_phone')) || '';
        const address = (await window.electronAPI?.getSetting('receipt_store_address')) || '';
        const logoBase64 = (await window.electronAPI?.getSetting('receipt_logo_base64')) || '';
        const showLogo = (await window.electronAPI?.getSetting('receipt_show_logo')) !== 'false';

        setStoreSettings({
          storeName,
          phone,
          address,
          logoBase64,
          showLogo,
        });
      } catch (err) {
        console.warn('Failed to load store settings:', err);
      }
    };
    loadSettings();
  }, [visible]);

  // Generate Barcode Data URL
  useEffect(() => {
    if (!visible || !order) {
      setBarcodeDataUrl('');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, `ORD-${order.id}`, {
        format: 'CODE128',
        displayValue: false,
        height: 40,
        margin: 0,
      });
      setBarcodeDataUrl(canvas.toDataURL('image/png'));
    } catch {
      setBarcodeDataUrl('');
    }
  }, [visible, order]);

  if (!visible || !order) return null;

  const handlePrint = async () => {
    if (!window.evaApi?.printing?.print) {
      toast.error('أداة الطباعة غير متوفرة');
      return;
    }

    setIsPrinting(true);
    try {
      const html = generateWaybillHtml(order, storeSettings, barcodeDataUrl);
      const res = await window.evaApi.printing.print({
        html,
        printerName: selectedPrinter || null,
        silent: !!selectedPrinter,
        isLabel: false,
      });

      if (res && res.success === false) {
        throw new Error(res.error || 'فشلت الطباعة');
      }

      toast.success(`تم إرسال فاتورة الشحن #${order.id} للطباعة بنجاح`);
      onClose();
    } catch (err: any) {
      console.error('Waybill print error:', err);
      toast.error(err?.message || 'حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
    }
  };

  const previewHtml = generateWaybillHtml(order, storeSettings, barcodeDataUrl);

  return (
    <div className="WB-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="WB-modal">
        {/* Header */}
        <div className="WB-header">
          <div className="WB-header-title">
            <FileText size={22} className="WB-icon" />
            <div>
              <h3>فاتورة شحن</h3>
              <p>طلب أونلاين #{order.id} • {order.customerName || 'عميل عام'}</p>
            </div>
          </div>
          <button className="WB-closeBtn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Body Split: Left Settings & Controls, Right Live Thermal Preview */}
        <div className="WB-body">
          {/* Controls Column */}
          <div className="WB-controls">
            <div className="WB-section">
              <label className="WB-label">
                <Printer size={16} /> الطابعة المحددة:
              </label>
              <select
                className="WB-select"
                value={selectedPrinter || ''}
                onChange={(e) => {
                  const val = e.target.value || null;
                  setSelectedPrinter(val);
                  onPrinterChange?.(val);
                }}
              >
                <option value="">الطابعة الافتراضية للنظام (أو نافذة الحوار)</option>
                {printers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} {p.isDefault ? '(الافتراضية)' : ''}
                  </option>
                ))}
              </select>
              <span className="WB-hint">
                يوصى باستخدام طابعة إيصالات حرارية بعرض 80mm أو 72mm
              </span>
            </div>

            <div className="WB-detailsCard">
              <div className="WB-detailRow">
                <span className="WB-detailKey"><User size={14} /> المستلم:</span>
                <span className="WB-detailVal bold">{order.customerName || '—'}</span>
              </div>
              <div className="WB-detailRow">
                <span className="WB-detailKey"><Smartphone size={14} /> الهاتف:</span>
                <span className="WB-detailVal bold" dir="ltr">{order.customerPhone || '—'}</span>
              </div>
              {order.note && (
                <div className="WB-detailRow">
                  <span className="WB-detailKey"><MapPin size={14} /> العنوان / الملاحظة:</span>
                  <span className="WB-detailVal">{order.note}</span>
                </div>
              )}
              <div className="WB-detailRow">
                <span className="WB-detailKey"><Package size={14} /> عدد المواد:</span>
                <span className="WB-detailVal">{order.items.reduce((s, i) => s + i.quantity, 0)} قطعة</span>
              </div>
              <div className="WB-totalRow">
                <span>المبلغ الكلي للتحصيل:</span>
                <strong>{order.totalIQD.toLocaleString('en-IQ')} د.ع</strong>
              </div>
            </div>

            <div className="WB-actions">
              <button className="WB-btn WB-btn--ghost" onClick={onClose} disabled={isPrinting}>
                إلغاء
              </button>
              <button className="WB-btn WB-btn--primary" onClick={handlePrint} disabled={isPrinting}>
                {isPrinting ? (
                  <>
                    <Loader2 size={16} className="WB-spin" /> جاري الطباعة...
                  </>
                ) : (
                  <>
                    <Printer size={16} /> طباعة الفاتورة الآن
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Live Preview Paper */}
          <div className="WB-previewContainer">
            <div className="WB-previewHeader">
              <span>معاينة فاتورة الشحن (72mm)</span>
            </div>
            <div className="WB-thermalPaperWrap">
              <iframe
                title="معاينة بوليصة الشحن"
                className="WB-thermalFrame"
                srcDoc={previewHtml}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaybillPrintModal;
