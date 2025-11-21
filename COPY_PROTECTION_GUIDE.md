# Copy Protection & USB Portable Build Guide

## ✅ What's Been Implemented

Your EVA POS app now has **copy protection** and can be built as a **USB-portable version** that prevents unauthorized copying.

## 🔒 Protection Features

### 1. **Hardware Binding**
- The app creates a unique "fingerprint" from your computer's hardware:
  - Computer hostname
  - CPU model and architecture
  - Total RAM
  - Operating system platform
- This fingerprint is used to bind the app to a specific computer

### 2. **USB Serial Number Binding**
- When running from USB, the app detects and binds to the USB drive's serial number
- If you copy the app to a different USB drive, it will refuse to run

### 3. **License Validation**
- On every startup, the app validates:
  - The license matches the current hardware/USB
  - The app hasn't been moved to a different device
- If validation fails, the app shows an error and won't start

### 4. **Automatic License Generation**
- On first run, the app automatically generates and stores a license
- No manual activation needed
- License is stored in the database

## 📦 How to Build USB Portable Version

### Step 1: Build the Application
```bash
npm run build
```

### Step 2: Create Portable Build
```bash
npm run dist:portable
```

This creates: `dist-package/EVA POS-1.0.0-Portable.exe`

## 🚀 Using the Portable Version

### First Time Setup

1. **Copy the portable .exe to your USB drive**
   - Just copy `EVA POS-1.0.0-Portable.exe` to the USB
   - No installation needed!

2. **Run it from the USB drive**
   - Double-click the `.exe` file
   - The app will automatically:
     - Generate a license based on the USB serial number
     - Bind to that specific USB drive
     - Store the license in the database

3. **Use the app normally**
   - All features work the same
   - Database is stored in `%APPDATA%\EVA POS\`

### Running After First Setup

- Simply double-click the `.exe` from the USB drive
- The app validates the license automatically
- If everything matches, it runs normally

## ⚠️ What Happens if Someone Tries to Copy It?

### Scenario 1: Copied to Different USB Drive
- ❌ **Result**: App refuses to run
- **Error**: "Application has been moved to a different USB drive"

### Scenario 2: Copied to Different Computer
- ❌ **Result**: App refuses to run
- **Error**: "Application has been moved to a different computer"

### Scenario 3: Copied to Hard Drive (Same Computer)
- ⚠️ **Result**: May work or may fail, depending on detection
- The app prefers running from USB

## 🛡️ Security Level

### What This Protects Against:
- ✅ Casual copying to different USB drives
- ✅ Copying to different computers
- ✅ Simple file duplication attempts

### Limitations:
- ⚠️ **Not 100% Unbreakable**: Advanced users with technical knowledge could potentially bypass it
- ⚠️ **Database Access**: If someone has access to the database file, they could modify the license
- ⚠️ **Code Not Obfuscated**: The source code is readable, so reverse engineering is possible

### For Stronger Protection, Consider:
1. **Code Obfuscation**: Use tools like `javascript-obfuscator` or `webpack-obfuscator`
2. **Online License Validation**: Check license against a server
3. **Database Encryption**: Encrypt the SQLite database file
4. **Hardware Dongles**: Use physical USB security keys

## 📋 Building Checklist

- [ ] Run `npm run build` successfully
- [ ] Run `npm run dist:portable` to create portable version
- [ ] Test on USB drive - verify it runs
- [ ] Test license binding - verify it binds to USB
- [ ] Test copy protection - try copying to different USB (should fail)
- [ ] Test copy protection - try copying to different computer (should fail)

## 🔧 Technical Details

### License Storage
- Location: SQLite database (`eva_pos.db`)
- Path: `%APPDATA%\EVA POS\eva_pos.db` (Windows)
- Tables: `settings` table with keys:
  - `app_license_key`: The generated license
  - `app_machine_id`: Hardware fingerprint
  - `app_usb_serial`: USB drive serial number

### License Generation
- Uses SHA-256 hash of: `machine_id + usb_serial`
- Creates a 32-character uppercase hex string
- Unique per USB drive + computer combination

### USB Detection
- Windows: Uses `vol` command to get volume serial number
- Fallback: Uses `wmic` command if `vol` fails
- Checks if app path contains "removable" keyword

## 🎯 Distribution Instructions

### For End Users:

1. **Give them the portable .exe file**
   - File: `EVA POS-1.0.0-Portable.exe`
   - Size: ~150-200 MB

2. **Instructions:**
   - Copy the `.exe` file to your USB drive
   - Run it from the USB drive (double-click)
   - On first run, it will bind to your USB drive
   - Always run from the same USB drive

3. **Important Notes:**
   - Don't copy the app to a different USB drive
   - Don't copy the app to a different computer
   - The app must run from the USB drive it was first run on

## 🆘 Troubleshooting

### "License validation failed" Error

**Possible causes:**
1. App was copied to different USB drive
2. App was copied to different computer
3. USB drive serial number changed (rare)

**Solution:**
- Contact administrator to reset license
- Or delete the database and re-run (will generate new license)

### App Won't Start

**Check:**
1. Is it the first run? (License generation might take a moment)
2. Is the USB drive properly connected?
3. Are there any error messages?

### Development Mode

- In development (`npm run dev`), license validation is **automatically bypassed**
- This allows developers to test without license issues

## 📝 Files Changed

1. **`electron/ipc/licensing.ts`** - License validation logic
2. **`renderer/src/components/LicenseValidator.tsx`** - UI component for license check
3. **`renderer/src/components/LicenseValidator.css`** - Styling for license validator
4. **`renderer/src/App.tsx`** - Added license validator wrapper
5. **`electron/main.ts`** - Registered licensing IPC handlers
6. **`electron/preload.ts`** - Exposed licensing API to renderer
7. **`renderer/src/types/electron.d.ts`** - Added licensing type definitions
8. **`package.json`** - Added portable build script and configuration

## 🎉 Ready to Use!

Your app is now protected against unauthorized copying. To create the portable version:

```bash
npm run dist:portable
```

The portable `.exe` file will be in `dist-package/` directory.

---

**Note**: This protection is designed to prevent casual copying. For maximum security, consider additional measures like code obfuscation or online license validation.

