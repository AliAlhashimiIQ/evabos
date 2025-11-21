# 🚀 How to Run EVA POS

## ⚠️ IMPORTANT: This is an Electron Desktop App

**This app CANNOT run in a web browser!** It must run in Electron (a desktop application framework).

## ✅ Correct Way to Run

### Step 1: Open Terminal/PowerShell
Open PowerShell or Command Prompt in the project folder:
```
C:\Users\ali\Desktop\eva-pos-desktop
```

### Step 2: Run the Development Command
```bash
npm run dev
```

### Step 3: Wait for Electron Window
- The command will start TWO processes:
  1. **Vite dev server** (runs on http://localhost:5174)
  2. **Electron window** (the actual app you see)

- **Wait 10-20 seconds** for the Electron window to appear
- **DO NOT** open http://localhost:5174 in your browser - it won't work!

### Step 4: Use the Electron Window
- The Electron window will open automatically
- This is your POS app - use this window, not the browser

## 🔍 How to Know It's Working

✅ **Correct**: You see an Electron window with "EVA POS" login screen  
❌ **Wrong**: You see a browser tab with "Desktop bridge unavailable" error

## 🐛 Troubleshooting

### "Desktop bridge unavailable" Error
- **Cause**: You're trying to open it in a browser
- **Solution**: Close the browser, use the Electron window that opens automatically

### Electron Window Doesn't Open
1. Check the terminal for errors
2. Make sure port 5174 is not in use
3. Try closing all Electron processes and restart:
   ```bash
   # In PowerShell:
   Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
   npm run dev
   ```

### Port Already in Use
```bash
# Find what's using port 5174
netstat -ano | findstr :5174

# Kill the process (replace PID with the number from above)
taskkill /PID <PID> /F
```

## 📝 Login Credentials

- **Username**: `admin`
- **Password**: `admin123`

## 🎯 What You Should See

1. **Electron window opens** (not browser)
2. **Login screen appears**
3. **After login**: POS dashboard with sidebar navigation
4. **No errors** in the Electron window

## 💡 Remember

- ✅ Run `npm run dev` → Electron window opens
- ❌ Don't open http://localhost:5174 in browser
- ✅ Use the Electron window that opens automatically
- ✅ The app works 100% offline (no internet needed)

