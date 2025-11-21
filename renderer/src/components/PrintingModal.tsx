import React, { useEffect, useMemo, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { useAuth } from '../contexts/AuthContext';
import './PrintingModal.css';

type Sale = import('../types/electron').Sale;
type SaleDetail = import('../types/electron').SaleDetail;
type SaleItem = import('../types/electron').SaleItem;

interface ReturnPrintItem {
  name: string;
  variant?: string;
  quantity: number;
  amountIQD: number;
}

export interface ReturnPrintData {
  id: number;
  totalIQD: number;
  customerName?: string;
  items: ReturnPrintItem[];
}

interface PrintingModalProps {
  visible: boolean;
  onClose: () => void;
  sale?: Sale;
  returnData?: ReturnPrintData;
  printerName?: string | null;
  onPrinterChange?: (printer: string | null) => void;
}

interface LineItem {
  name: string;
  variant?: string;
  quantity: number;
  priceIQD: number;
}

interface ReceiptPayload {
  title: string;
  subtitle: string;
  items: LineItem[];
  totals: Array<{ label: string; value: number }>;
  footer: string;
  barcodeValue: string;
  customer?: string;
  branchName?: string;
  branchAddress?: string;
  branchPhone?: string;
  cashierName?: string;
  paymentMethod?: string;
  saleDate: string;
}

const STORE_FOOTER = 'Thank you for shopping with EVA Clothing!';

const generateReceiptHtml = (payload: ReceiptPayload, barcodeDataUrl?: string): string => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
      body { 
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
        width: 58mm; 
        margin: 0 auto; 
        padding: 12px 10px; 
        font-size: 11px;
        line-height: 1.4;
        background: #ffffff;
        color: #1a1a1a;
      }
      .header { 
        text-align: center; 
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 2px solid #2c3e50;
      }
      .store-name { 
        font-size: 18px; 
        font-weight: 700; 
        margin-bottom: 4px;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: #2c3e50;
        text-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }
      .store-info { 
        font-size: 9px; 
        color: #555;
        margin-bottom: 3px;
        line-height: 1.5;
      }
      .divider { 
        border-top: 1px dashed #888; 
        margin: 8px 0; 
      }
      .sale-info { 
        font-size: 11px; 
        margin-bottom: 4px;
        text-align: center;
        color: #2c3e50;
        font-weight: 600;
      }
      .customer-info { 
        font-size: 10px; 
        margin-bottom: 4px;
        padding: 3px 0;
        color: #444;
      }
      .date-time {
        font-size: 9px;
        color: #666;
        margin-top: 2px;
        text-align: center;
      }
      table { 
        width: 100%; 
        font-size: 10px; 
        border-collapse: collapse; 
        margin-bottom: 6px;
      }
      tbody tr { 
        border-bottom: 1px dotted #ddd; 
      }
      tbody tr:last-child {
        border-bottom: none;
      }
      tbody td { 
        padding: 4px 2px; 
        vertical-align: top;
      }
      .item-name { 
        font-weight: 600; 
        width: 55%;
        color: #2c3e50;
      }
      .item-variant { 
        font-size: 8px; 
        color: #777;
        margin-top: 2px;
        font-style: italic;
      }
      .item-qty { 
        text-align: center; 
        width: 12%;
        font-size: 10px;
        color: #444;
      }
      .item-price { 
        text-align: right; 
        width: 18%;
        font-size: 9px;
        color: #555;
      }
      .item-total { 
        text-align: right; 
        font-weight: 600;
        font-size: 10px;
        color: #2c3e50;
      }
      tfoot { 
        border-top: 2px solid #2c3e50; 
        margin-top: 4px;
      }
      tfoot td { 
        padding: 5px 2px; 
        font-weight: 600;
        font-size: 11px;
      }
      .total-row { 
        border-top: 1px dashed #999; 
        padding-top: 3px;
      }
      .total-row td {
        color: #555;
      }
      .grand-total { 
        font-size: 13px; 
        font-weight: 700;
        border-top: 3px solid #2c3e50;
        padding-top: 6px;
        margin-top: 4px;
        color: #1a1a1a;
        background: #f8f9fa;
      }
      .grand-total td {
        color: #1a1a1a;
      }
      .payment-info { 
        font-size: 10px; 
        margin: 8px 0;
        text-align: center;
        padding: 6px 0;
        border-top: 1px dashed #888;
        border-bottom: 1px dashed #888;
        background: #f0f2f5;
        color: #2c3e50;
        font-weight: 600;
      }
      .cashier-info { 
        font-size: 9px; 
        text-align: center;
        margin: 4px 0;
        color: #666;
        font-style: italic;
      }
      .barcode { 
        text-align: center; 
        margin: 10px 0; 
        padding: 8px 0;
      }
      .barcode img { 
        max-width: 100%; 
        height: auto;
        display: block;
        margin: 0 auto;
      }
      .footer { 
        text-align: center; 
        font-size: 9px; 
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px dashed #888;
        color: #666;
        font-style: italic;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="store-name">EVA CLOTHING</div>
      ${payload.branchName ? `<div class="store-info"><strong>${payload.branchName}</strong></div>` : ''}
      ${payload.branchAddress ? `<div class="store-info">${payload.branchAddress}</div>` : ''}
      ${payload.branchPhone ? `<div class="store-info">📞 ${payload.branchPhone}</div>` : ''}
    </div>
    <div class="divider"></div>
    <div class="sale-info">
      Sale #${payload.subtitle.match(/#(\d+)/)?.[1] || 'N/A'}
    </div>
    <div class="date-time">${new Date(payload.saleDate).toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    })}</div>
    ${payload.customer ? `<div class="customer-info"><strong>Customer:</strong> ${payload.customer}</div>` : ''}
    <div class="divider"></div>
    <table>
      <tbody>
        ${payload.items
          .map(
            (item) => `
          <tr>
            <td class="item-name">
              ${item.name}
              ${item.variant ? `<div class="item-variant">${item.variant}</div>` : ''}
            </td>
            <td class="item-qty">${item.quantity}</td>
            <td class="item-price">${item.priceIQD.toLocaleString('en-IQ')}</td>
            <td class="item-total">${(item.priceIQD * item.quantity).toLocaleString('en-IQ')}</td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
      <tfoot>
        ${payload.totals
          .map(
            (total, idx) => `
          <tr class="${idx === payload.totals.length - 1 ? 'grand-total' : 'total-row'}">
            <td colspan="3" style="text-align: left;">${total.label}</td>
            <td class="item-total" style="text-align: right;">${total.value.toLocaleString('en-IQ')} IQD</td>
          </tr>
        `,
          )
          .join('')}
      </tfoot>
    </table>
    ${payload.paymentMethod ? `
      <div class="payment-info">
        💳 Payment: ${payload.paymentMethod.toUpperCase()}
      </div>
    ` : ''}
    ${payload.cashierName ? `
      <div class="cashier-info">
        👤 Cashier: ${payload.cashierName}
      </div>
    ` : ''}
    ${
      barcodeDataUrl
        ? `<div class="barcode" style="text-align: center; margin: 10px 0;"><img src="${barcodeDataUrl}" alt="Barcode" style="max-width: 100%; height: auto;" /></div>`
        : ''
    }
    <div class="footer">${payload.footer}</div>
  </body>
</html>
`;

const generateInvoiceHtml = (payload: ReceiptPayload, barcodeDataUrl?: string): string => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
      body { 
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
        margin: 30px 40px; 
        color: #1a1a1a; 
        background: #ffffff;
        line-height: 1.6;
      }
      .header { 
        display: flex; 
        justify-content: space-between; 
        align-items: flex-start;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 3px solid #2c3e50;
      }
      .header-left {
        flex: 1;
      }
      .store-name {
        font-size: 28px;
        font-weight: 700;
        margin-bottom: 10px;
        text-transform: uppercase;
        letter-spacing: 2px;
        color: #2c3e50;
      }
      .store-info {
        font-size: 13px;
        color: #555;
        line-height: 1.8;
        margin-bottom: 15px;
      }
      .sale-header {
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid #e0e0e0;
      }
      .sale-header h2 {
        font-size: 20px;
        margin-bottom: 6px;
        color: #2c3e50;
        font-weight: 600;
      }
      .sale-header p {
        font-size: 13px;
        color: #666;
        margin: 3px 0;
      }
      table { 
        width: 100%; 
        border-collapse: collapse; 
        margin-top: 25px; 
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      th, td { 
        border: 1px solid #e0e0e0; 
        padding: 12px; 
        font-size: 13px; 
        text-align: left;
      }
      th { 
        background: linear-gradient(to bottom, #2c3e50, #34495e);
        color: #ffffff;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 12px;
        letter-spacing: 0.5px;
      }
      tbody tr {
        transition: background 0.2s;
      }
      tbody tr:nth-child(even) {
        background: #f8f9fa;
      }
      tbody tr:hover {
        background: #e8f4f8;
      }
      tbody td {
        color: #333;
      }
      tbody td strong {
        color: #2c3e50;
      }
      .totals { 
        margin-top: 25px; 
        width: 320px; 
        margin-left: auto;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
      }
      .totals tr {
        background: #f8f9fa;
      }
      .totals td { 
        border: none; 
        padding: 8px 12px; 
        font-size: 13px;
      }
      .totals tr:last-child {
        background: #2c3e50;
        color: #ffffff;
      }
      .totals tr:last-child td {
        border-top: 2px solid #1a252f;
        font-weight: 700;
        font-size: 16px;
        padding-top: 12px;
        padding-bottom: 12px;
      }
      .payment-section {
        margin-top: 25px;
        padding: 15px 20px;
        background: linear-gradient(135deg, #f0f2f5 0%, #e8ecef 100%);
        border-radius: 6px;
        border-left: 4px solid #2c3e50;
      }
      .payment-section p {
        margin: 6px 0;
        font-size: 13px;
        color: #2c3e50;
      }
      .payment-section strong {
        color: #1a1a1a;
      }
      .qr { 
        margin-top: 20px; 
        text-align: right;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 6px;
        display: inline-block;
      }
      .qr img {
        border: 2px solid #e0e0e0;
        border-radius: 4px;
        padding: 5px;
        background: #ffffff;
      }
      .footer {
        margin-top: 30px;
        padding-top: 20px;
        border-top: 2px solid #e0e0e0;
        text-align: center;
        font-size: 13px;
        color: #666;
        font-style: italic;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="header-left">
        <div class="store-name">EVA CLOTHING</div>
        <div class="store-info">
          ${payload.branchName ? `<div><strong>📍 Branch:</strong> ${payload.branchName}</div>` : ''}
          ${payload.branchAddress ? `<div>${payload.branchAddress}</div>` : ''}
          ${payload.branchPhone ? `<div>📞 Tel: ${payload.branchPhone}</div>` : ''}
        </div>
        <div class="sale-header">
          <h2>${payload.title}</h2>
          <p><strong>${payload.subtitle}</strong></p>
          <p>📅 Date: ${new Date(payload.saleDate).toLocaleString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          })}</p>
          ${payload.customer ? `<p><strong>👤 Customer:</strong> ${payload.customer}</p>` : ''}
        </div>
      </div>
      ${barcodeDataUrl ? `<div class="barcode" style="text-align: center; margin: 20px 0;"><img src="${barcodeDataUrl}" alt="Barcode" style="max-width: 300px; height: auto;" /></div>` : ''}
    </div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Variant</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${payload.items
          .map(
            (item) => `
          <tr>
            <td><strong>${item.name}</strong></td>
            <td style="color: #666;">${item.variant ?? 'N/A'}</td>
            <td style="text-align: center;">${item.quantity}</td>
            <td style="text-align: right;">${item.priceIQD.toLocaleString('en-IQ')} IQD</td>
            <td style="text-align: right;"><strong>${(item.priceIQD * item.quantity).toLocaleString('en-IQ')} IQD</strong></td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
    <table class="totals">
      <tbody>
        ${payload.totals
          .map(
            (total) => `
          <tr>
            <td>${total.label}</td>
            <td style="text-align:right;">${total.value.toLocaleString('en-IQ')} IQD</td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
    ${payload.paymentMethod || payload.cashierName ? `
      <div class="payment-section">
        ${payload.paymentMethod ? `<p><strong>💳 Payment Method:</strong> ${payload.paymentMethod.toUpperCase()}</p>` : ''}
        ${payload.cashierName ? `<p><strong>👤 Cashier:</strong> ${payload.cashierName}</p>` : ''}
      </div>
    ` : ''}
    <div class="footer">${payload.footer}</div>
  </body>
</html>
`;

const PrintingModal = ({ visible, onClose, sale, returnData, printerName: propsPrinter, onPrinterChange }: PrintingModalProps): JSX.Element | null => {
  const { token, user } = useAuth();
  const [template, setTemplate] = useState<'receipt' | 'invoice'>('receipt');
  const [printers, setPrinters] = useState<Array<{ name: string; description: string; isDefault: boolean }>>([]);
  const [printerName, setPrinterName] = useState<string | null>(propsPrinter ?? null);
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string>('');
  const [saleDetail, setSaleDetail] = useState<SaleDetail | null>(null);
  const [branchInfo, setBranchInfo] = useState<{ name: string; address?: string | null; phone?: string | null } | null>(null);
  const [cashierInfo, setCashierInfo] = useState<{ username: string } | null>(null);

  // Fetch sale detail if sale doesn't have product names
  useEffect(() => {
    if (!visible || !sale || !token || !window.evaApi) {
      // Reset when modal closes
      setSaleDetail(null);
      setBranchInfo(null);
      setCashierInfo(null);
      return;
    }
    
    // Check if sale items have product names (SaleDetail) or just variantId (Sale)
    const hasProductNames = sale.items.some((item: any) => item.productName);
    
    if (!hasProductNames && sale.id) {
      // Fetch sale detail to get product names
      window.evaApi.sales.getDetail(token, sale.id)
        .then((detail) => {
          if (detail) {
            setSaleDetail(detail);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch sale detail:', err);
        });
    } else if (hasProductNames) {
      setSaleDetail(sale as SaleDetail);
    }
  }, [visible, sale, token]);

  // Fetch branch and cashier info
  useEffect(() => {
    if (!visible || !sale || !token || !window.evaApi) return;
    
    const fetchInfo = async () => {
      try {
        // Fetch branch info
        const branches = await window.evaApi.branches.list(token);
        const branch = branches.find((b) => b.id === sale.branchId);
        if (branch) {
          setBranchInfo({
            name: branch.name,
            address: branch.address,
            phone: branch.phone,
          });
        }

        // Fetch cashier info
        const users = await window.evaApi.users.list(token);
        const cashier = users.find((u) => u.id === sale.cashierId);
        if (cashier) {
          setCashierInfo({ username: cashier.username });
        }
      } catch (err) {
        console.error('Failed to fetch branch/cashier info:', err);
      }
    };

    fetchInfo();
  }, [visible, sale, token]);

  const payload = useMemo<ReceiptPayload | null>(() => {
    if (sale) {
      // Use saleDetail if available (has product names), otherwise use sale
      const saleData = saleDetail || sale;
      const items = saleData.items.map((item: any) => {
        // Check if item has productName (SaleDetail) or just variantId (Sale)
        if (item.productName) {
          return {
            name: item.productName,
            variant: [item.color, item.size].filter(Boolean).join(' / ') || undefined,
            quantity: item.quantity,
            priceIQD: item.unitPriceIQD,
          };
        } else {
          // Fallback: try to get from cart if available (for PosPage)
          return {
            name: `Item #${item.variantId}`,
            variant: undefined,
            quantity: item.quantity,
            priceIQD: item.unitPriceIQD,
          };
        }
      });

      return {
        title: 'EVA POS Receipt',
        subtitle: `Sale #${sale.id}`,
        items,
        totals: [
          { label: 'Subtotal', value: sale.subtotalIQD },
          ...(sale.discountIQD > 0 ? [{ label: 'Discount', value: sale.discountIQD }] : []),
          { label: 'Total', value: sale.totalIQD },
        ],
        footer: STORE_FOOTER,
        barcodeValue: `SALE${sale.id}`,
        customer: sale.customerId ? `Customer #${sale.customerId}` : undefined,
        branchName: branchInfo?.name,
        branchAddress: branchInfo?.address || undefined,
        branchPhone: branchInfo?.phone || undefined,
        cashierName: cashierInfo?.username || user?.username,
        paymentMethod: sale.paymentMethod || undefined,
        saleDate: sale.saleDate,
      };
    }
    if (returnData) {
      return {
        title: 'Return / Exchange',
        subtitle: `Return #${returnData.id}`,
        items: returnData.items.map((item) => ({
          name: item.name,
          variant: item.variant,
          quantity: item.quantity,
          priceIQD: item.amountIQD / Math.max(item.quantity, 1),
        })),
        totals: [{ label: 'Refund', value: returnData.totalIQD }],
        footer: 'Items returned/exchanged.',
        barcodeValue: `RETURN${returnData.id}`,
        customer: returnData.customerName,
        branchName: branchInfo?.name,
        branchAddress: branchInfo?.address || undefined,
        branchPhone: branchInfo?.phone || undefined,
        cashierName: user?.username,
        saleDate: new Date().toISOString(),
      };
    }
    return null;
  }, [sale, returnData, saleDetail, branchInfo, cashierInfo, user]);

  // Prevent body scroll and layout shift when modal is open
  useEffect(() => {
    if (visible) {
      const html = document.documentElement;
      const body = document.body;
      const root = document.getElementById('root');
      
      // Store original values
      const originalBodyOverflow = body.style.overflow;
      const originalBodyHeight = body.style.height;
      const originalBodyPosition = body.style.position;
      const originalHtmlOverflow = html.style.overflow;
      const originalRootOverflow = root?.style.overflow || '';
      
      // Lock everything
      body.style.overflow = 'hidden';
      body.style.height = '100vh';
      body.style.position = 'fixed';
      body.style.width = '100%';
      html.style.overflow = 'hidden';
      if (root) {
        root.style.overflow = 'hidden';
      }
      
      return () => {
        // Restore original values
        body.style.overflow = originalBodyOverflow;
        body.style.height = originalBodyHeight;
        body.style.position = originalBodyPosition;
        body.style.width = '';
        html.style.overflow = originalHtmlOverflow;
        if (root) {
          root.style.overflow = originalRootOverflow;
        }
      };
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    const loadPrinters = async () => {
      if (!window.evaApi) return;
      try {
        const list = await window.evaApi.printing.getPrinters();
        if (mounted) {
          setPrinters(list);
          if (!propsPrinter) {
            const def = list.find((printer) => printer.isDefault);
            setPrinterName(def?.name ?? null);
          }
        }
      } catch (err) {
        console.error('Failed to load printers', err);
      }
    };
    loadPrinters();
    return () => {
      mounted = false;
    };
  }, [visible]);

  // Generate barcode when payload changes
  useEffect(() => {
    if (!payload || !visible || !payload.barcodeValue) {
      setBarcodeDataUrl('');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, payload.barcodeValue, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 14,
        margin: 10,
      });
      setBarcodeDataUrl(canvas.toDataURL('image/png'));
    } catch (error) {
      console.error('Failed to generate barcode:', error);
      setBarcodeDataUrl('');
    }
  }, [payload, visible]);

  if (!visible || !payload) {
    return null;
  }

  const previewHtml =
    template === 'receipt'
      ? generateReceiptHtml(payload, barcodeDataUrl)
      : generateInvoiceHtml(payload, barcodeDataUrl);

  const handlePrint = async () => {
    if (!window.evaApi) return;
    const html =
      template === 'receipt'
        ? generateReceiptHtml(payload, barcodeDataUrl)
        : generateInvoiceHtml(payload, barcodeDataUrl);
    await window.evaApi.printing.print({ html, printerName });
    if (onPrinterChange) {
      onPrinterChange(printerName ?? null);
    }
    onClose();
  };

  return (
    <div className="PrintingModal-overlay">
      <div className="PrintingModal-card">
        <header>
          <h3>Print {sale ? 'Receipt' : 'Return'}</h3>
          <button onClick={onClose}>✕</button>
        </header>
        <div className="PrintingModal-controls">
          <label>
            Template
            <select value={template} onChange={(event) => setTemplate(event.target.value as 'receipt' | 'invoice')}>
              <option value="receipt">80mm Receipt</option>
              <option value="invoice">A4 Invoice</option>
            </select>
          </label>
          <label>
            Printer
            <select value={printerName ?? ''} onChange={(event) => setPrinterName(event.target.value || null)}>
              <option value="">System Prompt</option>
              {printers.map((printer) => (
                <option key={printer.name} value={printer.name}>
                  {printer.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="PrintingModal-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        <div className="PrintingModal-actions">
          <button className="ghost" onClick={onClose}>
            Close
          </button>
          <button onClick={handlePrint}>Print</button>
        </div>
      </div>
    </div>
  );
};

export default PrintingModal;

