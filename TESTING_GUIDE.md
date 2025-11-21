# EVA POS - Testing Guide

## Quick Start

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```
   This will:
   - Start Vite dev server on port 5174
   - Launch Electron window
   - Open DevTools automatically

3. **Login Credentials**:
   - Username: `admin`
   - Password: `admin123`

## Testing Checklist

### ✅ Authentication & Login
- [ ] Login with admin/admin123
- [ ] Verify redirect to POS page after login
- [ ] Check that logout works
- [ ] Verify session persists on page refresh

### ✅ POS (Point of Sale)
- [ ] Add products to cart
- [ ] Search for products
- [ ] Adjust quantities
- [ ] Apply discounts (amount/percentage)
- [ ] Select payment method
- [ ] Complete a sale
- [ ] Verify receipt printing modal appears
- [ ] Test barcode scanning (type fast to simulate scanner)

### ✅ Products Management
- [ ] View products list
- [ ] Add new product with variants
- [ ] Adjust stock quantities
- [ ] View product variants table

### ✅ Suppliers
- [ ] List suppliers
- [ ] Create new supplier
- [ ] Link supplier to products

### ✅ Purchase Orders
- [ ] Create purchase order
- [ ] Add items to PO
- [ ] Mark PO as received (updates stock)

### ✅ Customers
- [ ] List customers
- [ ] Create new customer
- [ ] View customer purchase history
- [ ] Attach sale to customer from POS

### ✅ Returns & Exchanges
- [ ] Lookup sale by ID
- [ ] Process return with receipt
- [ ] Process return without receipt
- [ ] Process exchange
- [ ] Verify stock adjustments

### ✅ Expenses
- [ ] List expenses
- [ ] Create new expense
- [ ] Filter by category
- [ ] View expense summary

### ✅ Reports
- [ ] View daily sales summary
- [ ] Check best selling items
- [ ] View sales by size/color
- [ ] Check top customers
- [ ] View profit analysis
- [ ] Export reports to Excel

### ✅ Settings
- [ ] View current exchange rate
- [ ] Update exchange rate
- [ ] Use pricing helper calculator

### ✅ Backup & Restore
- [ ] Create manual backup
- [ ] List all backups
- [ ] Restore from backup (admin only)
- [ ] Delete backup
- [ ] Verify daily auto-backup runs

### ✅ User Management & Security
- [ ] Lock POS (admin/manager only)
- [ ] Unlock POS
- [ ] View activity logs (admin/manager only)
- [ ] Verify role-based access (cashier cannot access settings)

### ✅ Printing
- [ ] Print receipt (80mm thermal)
- [ ] Print invoice (A4)
- [ ] Select printer
- [ ] Verify QR code on receipt

## Common Issues & Solutions

### Database Not Initialized
- **Solution**: The admin user is automatically created on first login attempt
- If issues persist, delete the database file and restart the app

### Port Already in Use
- **Solution**: Kill the process using port 5174 or change the port in `renderer/vite.config.ts`

### Module Not Found Errors
- **Solution**: Run `npm install` to ensure all dependencies are installed

### Login Fails
- **Solution**: The admin user is auto-created/reset on login attempt
- Check Electron console for error messages

## Database Location

- **Development**: `%APPDATA%/eva-pos-desktop/eva-pos.db` (Windows)
- **Backups**: `Documents/EVA_POS/Backup/`

## Building for Production

```bash
npm run build
```

This creates:
- `renderer/dist/` - Built React app
- `dist-electron/` - Compiled Electron main process

## Next Steps for Production

1. Install `electron-builder` for packaging
2. Configure app icons and metadata
3. Set up code signing (optional)
4. Test on target Windows machines

