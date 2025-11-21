# EVA POS - Deployment Guide

## 📦 Packaging the Application

### Prerequisites
- Node.js installed
- All dependencies installed (`npm install`)
- Application tested and working

### Build Steps

1. **Build the application:**
   ```bash
   npm run build
   ```
   This compiles TypeScript and builds the React app.

2. **Package for Windows:**
   ```bash
   npm run dist:win
   ```
   This creates a Windows installer in `dist-package/` folder.

3. **Or package for all platforms:**
   ```bash
   npm run dist
   ```

4. **Or create unpacked directory (for testing):**
   ```bash
   npm run pack
   ```

### Output

After packaging, you'll find:
- **Windows Installer**: `dist-package/EVA POS-1.0.0-Setup.exe`
- **Unpacked App**: `dist-package/win-unpacked/EVA POS.exe`

### Installation

1. Run the installer (`EVA POS-1.0.0-Setup.exe`)
2. Follow the installation wizard
3. Choose installation directory (default: `C:\Program Files\EVA POS`)
4. Launch from Start Menu or Desktop shortcut

### First Run

1. Launch "EVA POS" from Start Menu
2. Login with default credentials:
   - Username: `admin`
   - Password: `admin123`
3. **IMPORTANT**: Change the admin password immediately
4. Configure exchange rate in Settings
5. Add your products, suppliers, and customers
6. Start using the POS!

### Database Location

The SQLite database is stored at:
```
C:\Users\[Username]\AppData\Roaming\eva-pos-desktop\eva-pos.db
```

### Backup Location

Auto-backups are stored at:
```
C:\Users\[Username]\Documents\EVA_POS\Backup\
```

### Troubleshooting

**App won't start:**
- Check Windows Event Viewer for errors
- Ensure all dependencies are installed
- Try running from command line to see errors

**Database errors:**
- Check file permissions in AppData folder
- Verify database file exists
- Try restoring from backup

**Printing issues:**
- Ensure printer drivers are installed
- Check printer is set as default
- Test with "Microsoft Print to PDF" first

### Distribution

To distribute the app:
1. Share the installer file (`EVA POS-1.0.0-Setup.exe`)
2. Users run the installer
3. No additional setup required - fully offline

### Updates

For future updates:
1. Increment version in `package.json`
2. Rebuild and repackage
3. Distribute new installer
4. Users install over existing installation (data preserved)

---

## 🔒 Security Notes

- Default admin password should be changed immediately
- Database is stored locally (not encrypted by default)
- Backups contain sensitive data - store securely
- Consider encrypting database for production use

---

## 📋 Pre-Deployment Checklist

- [ ] Test all features end-to-end
- [ ] Verify backup/restore works
- [ ] Test printing functionality
- [ ] Test barcode scanning
- [ ] Verify all reports work
- [ ] Test Excel import/export
- [ ] Verify multi-user scenarios
- [ ] Test role-based access
- [ ] Create user documentation
- [ ] Train staff on using the system

---

## 🎯 Post-Deployment

1. Install on store computer
2. Login with admin credentials
3. Change admin password
4. Configure exchange rate
5. Import products (Excel or manual)
6. Set up suppliers
7. Add customers (optional)
8. Test complete sale workflow
9. Verify receipt printing
10. Train cashiers

---

**The application is ready for production use!**

