# USB Portable Build with Copy Protection

This guide explains how to create a USB-portable version of EVA POS with copy protection.

## 🔒 Protection Features

The app includes the following protection mechanisms:

1. **Hardware Binding**: The app binds to the computer's hardware fingerprint (CPU, RAM, hostname)
2. **USB Serial Binding**: If running from USB, the app binds to the USB drive's serial number
3. **License Validation**: On startup, the app validates that it's running on the authorized device/USB
4. **Copy Prevention**: If copied to a different computer or USB drive, the app will refuse to run

## 📦 Building the Portable Version

### Step 1: Build the Application
```bash
npm run build
```

### Step 2: Create Portable Build
```bash
npm run dist:portable
```

This creates a portable `.exe` file that can run directly from USB without installation.

## 📁 Output Location

After building, you'll find:
- **Portable Executable**: `dist-package/EVA POS-1.0.0-Portable.exe`

## 🚀 Using the Portable Version

### First Time Setup (USB Binding)

1. **Copy the portable .exe to your USB drive**
2. **Run it from the USB drive** (double-click `EVA POS-1.0.0-Portable.exe`)
3. **The app will automatically:**
   - Generate a license key based on the USB serial number
   - Bind to the USB drive
   - Store the license in the database

### Running from USB

- Simply double-click the `.exe` file from the USB drive
- The app will validate the license on startup
- If validation passes, the app runs normally
- If validation fails, you'll see an error message

## ⚠️ Important Notes

### What Happens if Copied?

1. **Copied to Different USB Drive**: The app will detect a different USB serial number and refuse to run
2. **Copied to Computer Hard Drive**: The app will detect it's not running from USB and may refuse to run (depending on configuration)
3. **Copied to Different Computer**: The app will detect different hardware and refuse to run

### License Storage

- The license is stored in the SQLite database (`eva_pos.db`)
- The database file is created in the app's user data directory
- On Windows: `%APPDATA%\EVA POS\`
- The license includes:
  - Machine fingerprint (hardware ID)
  - USB serial number (if applicable)
  - Generated license key

### Bypassing Protection (Development)

In development mode, license validation is automatically bypassed. The app will always allow running.

## 🔧 Technical Details

### Hardware Fingerprint Components

The app creates a unique machine ID from:
- Computer hostname
- Operating system platform
- CPU architecture
- CPU model
- Total RAM

### USB Detection

The app detects if it's running from USB by:
1. Checking the drive letter path
2. Getting the volume serial number using Windows `vol` command
3. Alternative: Using `wmic` to get logical disk serial number

### License Generation

The license key is generated using SHA-256 hash of:
- Machine fingerprint
- USB serial number (if applicable)

## 🛡️ Security Considerations

### Limitations

- **Not 100% Unbreakable**: Determined users with technical knowledge may be able to bypass protection
- **Database Access**: If someone has access to the database file, they could potentially modify the license
- **Code Obfuscation**: The code is not obfuscated, so advanced users could reverse-engineer it

### Recommendations

1. **Additional Protection**: Consider using professional code obfuscation tools
2. **Online Validation**: For stronger protection, implement online license validation
3. **Encryption**: Encrypt the database file to prevent license tampering
4. **Hardware Dongles**: For maximum security, consider using hardware dongles

## 📋 Distribution Checklist

- [ ] Build portable version: `npm run dist:portable`
- [ ] Test on USB drive
- [ ] Verify license binding works
- [ ] Test that copying to different USB fails
- [ ] Test that copying to different computer fails
- [ ] Document USB drive requirements for users
- [ ] Provide instructions for authorized transfers

## 🎯 Authorized Transfer Process

If you need to move the app to a different USB drive or computer:

1. **Contact Administrator**: The administrator needs to reset the license
2. **Reset License**: Delete the license from the database (requires database access)
3. **Re-run on New Device**: Run the app on the new device/USB - it will generate a new license

## 📝 Notes

- The portable version is larger than the installer (~150-200 MB) because it includes all dependencies
- The app can still be run from a hard drive, but it will bind to the computer instead of USB
- For best security, always run from the same USB drive on the same computer

---

**Your app is now protected against unauthorized copying!** 🔒

