# Quick USB Setup Guide - Step by Step

## 📋 What You Need
- USB drive plugged into your computer
- Terminal/PowerShell open in the project folder

## 🚀 Step-by-Step Instructions

### Step 1: Open Terminal/PowerShell
- Navigate to your project folder: `C:\Users\ali\Desktop\eva-pos-desktop`
- Or open PowerShell/Command Prompt in that folder

### Step 2: Build the Portable Version
Run this command:
```bash
npm run dist:portable
```

**What this does:**
- Builds the app
- Creates a portable `.exe` file that can run from USB
- Takes about 2-5 minutes

**Output location:**
- File will be created at: `dist-package\EVA POS-1.0.0-Portable.exe`

### Step 3: Find Your USB Drive Letter
1. Open File Explorer
2. Look for your USB drive (usually shows as `E:`, `F:`, `G:`, etc.)
3. Note the drive letter (e.g., `E:`)

### Step 4: Copy to USB Drive
**Option A: Using File Explorer (Easiest)**
1. Go to: `C:\Users\ali\Desktop\eva-pos-desktop\dist-package\`
2. Find the file: `EVA POS-1.0.0-Portable.exe`
3. Right-click → Copy
4. Open your USB drive in File Explorer
5. Right-click → Paste

**Option B: Using Command Line**
```bash
copy "dist-package\EVA POS-1.0.0-Portable.exe" "E:\"
```
(Replace `E:` with your USB drive letter)

### Step 5: Test It
1. Go to your USB drive in File Explorer
2. Double-click `EVA POS-1.0.0-Portable.exe`
3. The app should start
4. On first run, it will automatically bind to your USB drive

## ✅ That's It!

The app is now on your USB drive and protected:
- ✅ Can only run from that specific USB drive
- ✅ Cannot be copied to another USB drive
- ✅ Cannot be copied to another computer
- ✅ No installation needed - just run the `.exe` file

## 🔍 File Location Summary

**Source (after build):**
```
C:\Users\ali\Desktop\eva-pos-desktop\dist-package\EVA POS-1.0.0-Portable.exe
```

**Destination (your USB):**
```
E:\EVA POS-1.0.0-Portable.exe
```
(Your USB drive letter may be different)

## ⚠️ Important Notes

1. **First Run**: When you first run it from USB, it will:
   - Generate a license based on your USB serial number
   - Bind to that specific USB drive
   - Store the license in the database

2. **Always Run from USB**: The app must run from the USB drive it was first run on

3. **File Size**: The `.exe` file is about 150-200 MB (includes everything needed)

4. **Database Location**: The database will be stored on the computer (not USB) at:
   - `%APPDATA%\EVA POS\eva_pos.db`
   - This is normal - the app data stays on the computer, but the app itself must run from USB

## 🆘 Troubleshooting

**Build fails?**
- Make sure you're in the project folder
- Run `npm install` first if needed
- Check that Node.js is installed

**Can't find the file?**
- Check `dist-package` folder
- Look for files ending in `.exe`

**App won't run from USB?**
- Make sure you copied the entire `.exe` file
- Try running it directly from the USB (don't copy to desktop first)
- Check if Windows is blocking it (right-click → Properties → Unblock)

---

**Ready? Run this command:**
```bash
npm run dist:portable
```

Then copy the `.exe` file to your USB drive! 🎉

