# How to Package EVA POS for Windows

## ✅ Ready to Package!

The app is fully configured and ready to create a Windows installer.

## 📦 Step-by-Step Instructions

### Step 1: Build the Application
```bash
npm run build
```
This compiles TypeScript and builds the React frontend.

### Step 2: Create Windows Installer
```bash
npm run dist:win
```

**OR** to create unpacked directory (for testing):
```bash
npm run pack
```

## 📁 Output Location

After packaging, you'll find:

**Installer:**
- `dist-package/EVA POS-1.0.0-Setup.exe` (Windows installer)

**Unpacked App (for testing):**
- `dist-package/win-unpacked/EVA POS.exe` (run directly)

## ⚠️ Important Notes

### Code Signing
- Code signing is **disabled** (no certificate needed)
- Windows may show "Unknown publisher" warning - this is normal
- Users can click "More info" → "Run anyway"

### First Time Packaging
- First run may take **5-10 minutes** (downloading Electron binaries)
- Subsequent builds are much faster (~1-2 minutes)

### If You Get Errors

**Error: Permission denied / Symbolic link errors**
- **Solution**: Run PowerShell/Command Prompt **as Administrator**
- Or ignore the code signing cache errors (they don't affect packaging)

**Error: SQLite3 rebuild failed**
- **Solution**: This is handled automatically - the app will use prebuilt binaries

## 🚀 Quick Test

1. **Test unpacked version first:**
   ```bash
   npm run pack
   ```
   
2. **Navigate to:** `dist-package/win-unpacked/`
   
3. **Run:** `EVA POS.exe`
   
4. **Test the app** - login, create a sale, etc.

5. **If everything works**, create the installer:
   ```bash
   npm run dist:win
   ```

## 📋 Distribution Checklist

- [ ] Run `npm run build` successfully
- [ ] Run `npm run pack` and test the unpacked app
- [ ] Verify all features work (login, POS, printing, etc.)
- [ ] Create installer with `npm run dist:win`
- [ ] Test installer on a clean machine
- [ ] Verify installation works
- [ ] Test app after installation

## 🎯 What Users Need

Users only need:
1. The installer file (`EVA POS-1.0.0-Setup.exe`)
2. Run the installer
3. Launch from Start Menu or Desktop
4. Login: `admin` / `admin123` (change immediately!)

**That's it!** No additional setup required.

## 📝 Installer Features

✅ Custom installation directory  
✅ Desktop shortcut  
✅ Start Menu shortcut  
✅ Uninstaller included  
✅ Run after installation  
✅ Maximum compression (smaller file size)

---

## 🎉 Ready to Package!

Run this command to create the installer:

```bash
npm run dist:win
```

The installer will be in: `dist-package/EVA POS-1.0.0-Setup.exe`

**Your app is production-ready!** 🚀

