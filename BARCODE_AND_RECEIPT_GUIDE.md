# Barcode Generation & Receipt Printing Guide

## 📊 How Barcode Generation Works

### Overview
The EVA POS system automatically generates **EAN-13 barcodes** (13-digit) for each product variant when a product is created. Barcodes are used for:
- Product identification
- Barcode scanning at POS
- Inventory tracking

### Barcode Generation Algorithm

**Location:** `electron/db/database.ts` - `generateBarcode()` function

```typescript
const generateBarcode = (): string => {
  // Step 1: Generate 12 random digits (0-9)
  let payload = '';
  for (let i = 0; i < 12; i += 1) {
    payload += Math.floor(Math.random() * 10).toString();
  }
  
  // Step 2: Calculate EAN-13 check digit
  const digits = payload.split('').map((d) => parseInt(d, 10));
  const sum = digits.reduce((acc, digit, index) => 
    acc + digit * (index % 2 === 0 ? 1 : 3), 0) % 10;
  const checkDigit = (10 - sum) % 10;
  
  // Step 3: Return 13-digit barcode (12 digits + check digit)
  return payload + checkDigit.toString();
};
```

### How It Works:

1. **Random 12 Digits**: Generates 12 random digits (0-9)
   - Example: `123456789012`

2. **EAN-13 Check Digit Calculation**:
   - Uses the standard EAN-13 checksum algorithm
   - Multiplies digits at even positions by 1, odd positions by 3
   - Sums all products
   - Takes modulo 10
   - Calculates check digit: `(10 - sum) % 10`
   - Example: If sum is 47, check digit = `(10 - 47 % 10) = (10 - 7) = 3`

3. **Final Barcode**: 12 digits + 1 check digit = **13-digit EAN-13 barcode**
   - Example: `1234567890123`

### When Barcodes Are Generated:

1. **Product Creation** (`createProduct()` function):
   ```typescript
   const barcode = product.barcode && product.barcode.trim().length > 0 
     ? product.barcode  // Use provided barcode
     : generateBarcode(); // Auto-generate if not provided
   ```

2. **Excel Import**: If barcode column is empty, one is auto-generated

### Barcode Storage:
- Stored in `product_variants` table, `barcode` column (TEXT, UNIQUE)
- Each variant has its own unique barcode
- Barcodes are unique across all products

### Barcode Usage at POS:

**Location:** `renderer/src/pages/PosPage.tsx` - `handleScan()` function

```typescript
const handleScan = (value: string) => {
  // Searches for product by barcode OR SKU
  const variant = products.find((p) => 
    p.barcode === value || p.sku === value
  );
  if (variant) {
    addToCart(variant); // Adds to cart automatically
  }
};
```

**How Scanning Works:**
1. Barcode scanner sends barcode as keyboard input (fast typing)
2. `useBarcodeScanner` hook detects fast input
3. Searches products by `barcode` or `sku`
4. Automatically adds matching product to cart

---

## 🧾 How Receipt Printing Works

### Overview
The system supports two print templates:
1. **80mm Thermal Receipt** - For thermal printers (default)
2. **A4 Invoice** - For standard printers

### Receipt Generation Flow

#### 1. **Trigger Point** (After Sale Completion)
**Location:** `renderer/src/pages/PosPage.tsx`

```typescript
const handleCompleteSale = async () => {
  // ... create sale ...
  const sale = await window.evaApi.sales.create(token, saleData);
  
  // Open printing modal
  setPrintingSale(sale);
  setShowPrintingModal(true);
};
```

#### 2. **Printing Modal** (`PrintingModal.tsx`)

**Components:**
- **Template Selection**: Receipt (80mm) or Invoice (A4)
- **Printer Selection**: Choose from available printers or system prompt
- **QR Code Generation**: Auto-generates QR code for receipt ID
- **Preview**: Shows receipt before printing

#### 3. **QR Code Generation**

**Location:** `renderer/src/components/PrintingModal.tsx`

```typescript
import QRCode from 'qrcode';

useEffect(() => {
  if (!payload || !visible) return;
  
  // Generate QR code as data URL (base64 image)
  QRCode.toDataURL(payload.qrValue).then(setQrDataUrl);
}, [payload, visible]);
```

**QR Code Content:**
- For Sales: `sale:123` (where 123 is sale ID)
- For Returns: `return:456` (where 456 is return ID)

**Library Used:** `qrcode` npm package

#### 4. **HTML Template Generation**

**Receipt Template (80mm):**
```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      body { 
        font-family: 'Courier New', monospace; 
        width: 58mm;  /* 80mm thermal printer width */
        margin: 0 auto; 
        padding: 8px; 
      }
      /* ... receipt styling ... */
    </style>
  </head>
  <body>
    <h1>EVA POS Receipt</h1>
    <h2>Sale #123 • 2024-01-15 10:30 AM</h2>
    <table>
      <!-- Items list -->
    </table>
    <div class="qr">
      <img src="data:image/png;base64,..." alt="QR" />
    </div>
    <div class="footer">Thank you for shopping with EVA Clothing!</div>
  </body>
</html>
```

**Invoice Template (A4):**
- Full A4 page layout
- Professional table format
- Header with store info
- QR code in header
- Detailed item breakdown

#### 5. **Print Execution** (Electron Main Process)

**Location:** `electron/ipc/printing.ts`

```typescript
const createPrintWindow = async (html: string, options?: { printerName?: string | null }) => {
  // Create hidden BrowserWindow
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true },
  });

  // Load HTML as data URL
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Wait for content to load, then print
  win.webContents.once('did-finish-load', () => {
    win.webContents.print({
      silent: !!options?.printerName,  // Silent if printer specified
      deviceName: options?.printerName ?? undefined,
      landscape: false,
    }, (success, failureReason) => {
      win.close();
      if (!success) {
        reject(new Error(failureReason ?? 'Print failed'));
      } else {
        resolve();
      }
    });
  });
};
```

### Print Process Steps:

1. **User Completes Sale** → Sale saved to database
2. **Printing Modal Opens** → Shows preview
3. **User Selects Template** → Receipt or Invoice
4. **User Selects Printer** → From list or system prompt
5. **QR Code Generated** → Using `qrcode` library
6. **HTML Generated** → Template with data filled in
7. **IPC Call** → `window.evaApi.printing.print({ html, printerName })`
8. **Main Process** → Creates hidden BrowserWindow
9. **Load HTML** → As data URL
10. **Print** → Using Electron's `webContents.print()`
11. **Close Window** → Cleanup

### Receipt Content:

**Header:**
- Store name: "EVA POS Receipt"
- Sale/Return number
- Date and time

**Items:**
- Product name
- Variant (size/color)
- Quantity × Unit Price
- Line total

**Totals:**
- Subtotal
- Discount (if any)
- **Total** (bold)

**Footer:**
- QR code (120×120px)
- Thank you message
- Store info

### Printer Selection:

**Location:** `electron/ipc/printing.ts`

```typescript
ipcMain.handle('printing:get-printers', async (event) => {
  return event.sender.getPrintersAsync();
});
```

**Available Options:**
1. **System Default** - Uses Windows default printer
2. **Specific Printer** - Select from list
3. **System Prompt** - Windows print dialog

### Print Settings:

- **Width**: 58mm (for 80mm thermal printers)
- **Font**: Courier New (monospace for receipts)
- **Silent Mode**: If printer specified, prints silently
- **Landscape**: Always false (portrait mode)

### Error Handling:

- If printer not found → Shows error
- If print fails → Error message displayed
- QR code generation failure → Receipt still prints (without QR)

---

## 🔧 Technical Details

### Dependencies:

1. **Barcode Generation**: Pure JavaScript (no external library)
2. **QR Code**: `qrcode` npm package (`^1.5.3`)
3. **Printing**: Electron's built-in `webContents.print()`

### Database Schema:

```sql
CREATE TABLE product_variants (
  ...
  barcode TEXT UNIQUE,  -- EAN-13 barcode
  ...
);
```

### File Locations:

- **Barcode Generation**: `electron/db/database.ts` (lines 153-163)
- **SKU Generation**: `electron/db/database.ts` (lines 143-151)
- **Printing IPC**: `electron/ipc/printing.ts`
- **Printing UI**: `renderer/src/components/PrintingModal.tsx`
- **QR Code**: Generated in `PrintingModal.tsx` using `qrcode` library

### Barcode Format:

- **Type**: EAN-13 (European Article Number, 13 digits)
- **Structure**: 12 random digits + 1 check digit
- **Validation**: Uses standard EAN-13 checksum algorithm
- **Uniqueness**: Enforced by database UNIQUE constraint

### Receipt Format:

- **Thermal Receipt**: 80mm width, monospace font
- **A4 Invoice**: Full page, professional layout
- **QR Code**: 120×120 pixels, base64 encoded PNG
- **Encoding**: UTF-8, supports Arabic/English text

---

## 📝 Summary

### Barcode Generation:
✅ Automatic EAN-13 generation  
✅ Valid checksum calculation  
✅ Unique per variant  
✅ Can be manually provided  
✅ Used for POS scanning  

### Receipt Printing:
✅ Two templates (Receipt/Invoice)  
✅ QR code for receipt tracking  
✅ Printer selection  
✅ Preview before printing  
✅ Silent printing support  
✅ Works with thermal printers  

Both systems are fully integrated and work offline without internet connection!

