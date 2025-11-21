# How to Add Your App Icon

## Quick Option: Use a Free Icon Generator

1. **Go to:** https://icon.kitchen/ (free online icon generator)
2. **Choose a simple design** (e.g., "Shopping bag" or "POS" text)
3. **Pick your brand colors**
4. **Download as PNG (512x512)**
5. **Save as:** `icon.png` in this folder
6. **Convert to ICO:** https://www.icoconverter.com/
7. **Save as:** `icon.ico` in this folder

## Alternative: Use Your Own Logo

If you have a logo:

1. Open it in an image editor (Photoshop, GIMP, Canva, etc.)
2. Resize to **512x512 pixels**
3. Export as PNG with transparency
4. Save as `icon.png` in this folder
5. Convert to .ico format and save as `icon.ico`

## Files Needed

```
build/
  icon.png  (512x512, for macOS/Linux)
  icon.ico  (256x256, for Windows)
```

## Then Rebuild

After adding icons:
```bash
npm run dist:win
```

The new installer will use your custom icon!

---

**Note:** The app will work with or without custom icons. The default Electron icon is just less professional-looking.

