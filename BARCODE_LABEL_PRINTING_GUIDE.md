# Barcode Label Printing Guide

## Overview

The EVA POS system now supports printing barcode labels that you can attach to your products (like coats, dresses, etc.). When customers bring items to the cashier, you can scan the barcode label to quickly add the product to the cart.

## How to Print Barcode Labels

### Method 1: From Products Table
1. Go to **Products** page
2. Find the product you want to print a label for
3. Click the **🏷️** (label icon) button in the Actions column
4. The label printing modal will open

### Method 2: From Product Details
1. Go to **Products** page
2. Click the **👁️** (eye icon) to view product details
3. Click **🏷️ Print Label** button at the bottom
4. The label printing modal will open

## Label Printing Modal Features

### Label Size Options
- **2" × 1" (Small)** - Standard small label, perfect for most items
- **4" × 2" (Large)** - Larger label with more space for text

### Quantity
- Select how many labels to print (1-100)
- Useful when you need multiple labels for the same product

### Printer Selection
- **System Default** - Uses your Windows default printer
- **Specific Printer** - Choose from available printers
- Works with:
  - Regular printers (print on label sheets)
  - Thermal label printers
  - Any Windows-compatible printer

## Label Content

Each printed label includes:
- **Product Name** - The name of the product
- **Variant Info** - Color and/or Size (if applicable)
- **Barcode** - EAN-13 scannable barcode image
- **SKU** - Stock Keeping Unit code
- **Price** - Selling price in IQD

## How to Use Printed Labels

1. **Print the Label**
   - Select size, quantity, and printer
   - Click "Print Label"
   - Labels will be printed

2. **Attach to Product**
   - Peel the label from the sheet
   - Stick it on the product tag or packaging
   - Make sure the barcode is visible and flat

3. **At the Cashier**
   - When customer brings the item
   - Use barcode scanner to scan the label
   - Product automatically adds to cart
   - Complete the sale

## Requirements

- **Product must have a barcode** - If a product doesn't have a barcode, the system will show an error. You can add a barcode when creating/editing the product.
- **Barcode scanner** - You need a USB barcode scanner connected to your computer
- **Label sheets or thermal printer** - For physical labels

## Label Printer Setup

### Using Regular Printer with Label Sheets
1. Buy label sheets (2"×1" or 4"×2" size)
2. Load into your printer
3. Select the label size in the modal
4. Print

### Using Thermal Label Printer
1. Connect thermal printer to your computer
2. Install printer drivers
3. Select the thermal printer in the modal
4. Print directly

## Tips

1. **Test Print First** - Print one label first to check alignment
2. **Use Quality Labels** - Good quality labels stick better and last longer
3. **Placement** - Attach labels where they're easy to scan
4. **Keep Barcode Clean** - Don't cover the barcode with tape or stickers
5. **Batch Printing** - Use quantity feature to print multiple labels at once

## Troubleshooting

### "This product does not have a barcode"
- **Solution**: Edit the product and add a barcode, or the system will auto-generate one

### Barcode doesn't scan
- **Solution**: 
  - Make sure barcode is printed clearly
  - Check barcode scanner is working
  - Verify barcode format is EAN-13

### Labels print but don't align correctly
- **Solution**: 
  - Adjust printer settings
  - Try different label size
  - Check label sheet size matches selection

### Printer not found
- **Solution**: 
  - Make sure printer is connected and powered on
  - Check Windows printer settings
  - Try "System Default" option

## Technical Details

- **Barcode Format**: EAN-13 (13 digits)
- **Barcode Library**: jsbarcode
- **Print Method**: Electron webContents.print()
- **Label Sizes**: 2"×1" and 4"×2" (customizable in code)

## Example Workflow

1. **Add Product** → Create "Coat - Black - Size 48"
2. **System Auto-Generates** → Barcode: `1234567890123`
3. **Print Label** → Click 🏷️ button, print 5 labels
4. **Attach Labels** → Stick one label on each coat
5. **Customer Comes** → Cashier scans label
6. **Product Added** → Automatically appears in cart
7. **Complete Sale** → Fast and accurate!

---

**Note**: Make sure your barcode scanner is set to "Keyboard Mode" so it types the barcode when scanned. Most USB barcode scanners work this way automatically.

