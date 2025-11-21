# Excel Import Guide

## Overview

The Excel Import feature allows you to bulk import products and stock from an Excel file (.xlsx or .xls format).

## Access

1. Navigate to **Products** page
2. Click **"📥 Import Excel"** button
3. Select your Excel file
4. Review import results

## Excel File Format

Your Excel file must have a header row (first row) with the following column names:

### Required Columns

- **name** - Product name (required)
- **Sale Price (IQD)** - Selling price in Iraqi Dinar (required, must be a positive number)
- **Purchase Cost (USD)** - Purchase cost in US Dollars (required, must be a positive number)

### Optional Columns

- **code** - Product code
- **category** - Product category
- **description** - Product description
- **color** - Color variant (e.g., "Black", "Red", "Blue")
- **size** - Size variant (e.g., "S", "M", "L", "XL")
- **Stock** - Initial stock quantity (default: 0)
- **Barcode** - Product barcode (if not provided, one will be auto-generated)
- **Supplier** - Supplier name (future: will link to supplier)

## Example Excel File

| name | code | category | color | size | Sale Price (IQD) | Purchase Cost (USD) | Stock | Barcode |
|------|------|----------|-------|------|------------------|---------------------|-------|---------|
| Abaya Classic | ABY-001 | Abaya | Black | M | 50000 | 15.00 | 10 | 1234567890123 |
| Abaya Classic | ABY-001 | Abaya | Black | L | 50000 | 15.00 | 8 | 1234567890124 |
| Abaya Classic | ABY-001 | Abaya | Beige | M | 50000 | 15.00 | 5 | 1234567890125 |
| Dress Summer | DRS-001 | Dress | Pink | S | 35000 | 10.00 | 12 | 1234567890126 |

## Notes

1. **First row must be headers** - The first row should contain column names exactly as shown above
2. **Case-sensitive column names** - Column names must match exactly (e.g., "Sale Price (IQD)" not "sale price")
3. **Numeric values** - Prices and stock can include commas (e.g., "50,000" will be parsed as 50000)
4. **Variants** - Each row creates a separate product variant. Products with the same name but different color/size will be linked to the same product core
5. **SKU Generation** - If not provided, SKU will be auto-generated based on product name, color, and size
6. **Barcode Generation** - If not provided, a valid EAN-13 barcode will be auto-generated
7. **Stock** - If stock is provided, it will be set as the initial stock quantity for that variant

## Import Process

1. **Validation** - Each row is validated before import
2. **Creation** - Products are created one by one in a transaction
3. **Stock Update** - If stock is provided, it's set after product creation
4. **Results** - You'll see:
   - Number of successfully imported products
   - Number of failed imports
   - List of errors with row numbers

## Error Handling

If a row fails to import, you'll see:
- **Row number** - The Excel row number (accounting for header)
- **Error message** - What went wrong (e.g., "Name is required", "Sale Price (IQD) must be a valid positive number")

Common errors:
- Missing required fields (name, Sale Price, Purchase Cost)
- Invalid numeric values
- Empty rows (will be skipped)

## Tips

1. **Test with small file first** - Import a few products first to verify your format
2. **Check for duplicates** - The system will create new products even if similar ones exist
3. **Use consistent naming** - Products with the same name will share the same product core
4. **Stock is optional** - You can import products without stock and add stock later
5. **Color/Size variants** - Create multiple rows for the same product with different colors/sizes

## Limitations

- Maximum file size: Limited by system memory
- Maximum rows: No hard limit, but very large files may take time to process
- Supplier linking: Currently not implemented (will be added in future update)
- Updates: Import always creates new products. To update existing products, use the Products page

