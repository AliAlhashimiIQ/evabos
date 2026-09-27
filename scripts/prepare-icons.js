import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/**
 * Encodes an image into a fully Windows-compliant multi-resolution ICO file.
 * Windows Explorer and rcedit require standard DIB (BITMAPINFOHEADER + BGRA pixels + AND mask)
 * for sizes <= 64x64, and PNG for 256x256.
 */
async function createWindowsIco(pngSizesMap, destIcoPath) {
  const iconEntries = [];
  const imageBuffers = [];

  // Sizes to include in ICO: 256, 64, 48, 32, 16
  const targetSizes = [256, 64, 48, 32, 16];

  for (const size of targetSizes) {
    if (size === 256) {
      // 256x256 stored as standard compressed PNG
      const pngBuf = pngSizesMap[256];
      imageBuffers.push(pngBuf);
      iconEntries.push({
        width: 0, // 0 means 256 in ICO spec
        height: 0,
        colorCount: 0,
        reserved: 0,
        planes: 1,
        bpp: 32,
        size: pngBuf.length,
      });
    } else {
      // DIB format for 16, 32, 48, 64
      const { data, info } = await sharp(pngSizesMap[size])
        .raw()
        .ensureAlpha()
        .toBuffer({ resolveWithObject: true });

      const w = info.width;
      const h = info.height;

      // BITMAPINFOHEADER (40 bytes)
      const header = Buffer.alloc(40);
      header.writeUInt32LE(40, 0);       // biSize
      header.writeInt32LE(w, 4);         // biWidth
      header.writeInt32LE(h * 2, 8);     // biHeight (doubled for XOR + AND mask)
      header.writeUInt16LE(1, 12);       // biPlanes
      header.writeUInt16LE(32, 14);      // biBitCount (32-bit BGRA)
      header.writeUInt32LE(0, 16);       // biCompression (BI_RGB)
      header.writeUInt32LE(w * h * 4, 20);// biSizeImage
      header.writeInt32LE(0, 24);        // biXPelsPerMeter
      header.writeInt32LE(0, 28);        // biYPelsPerMeter
      header.writeUInt32LE(0, 32);       // biClrUsed
      header.writeUInt32LE(0, 36);       // biClrImportant

      // Pixel data: bottom-to-top, BGRA
      const pixelData = Buffer.alloc(w * h * 4);
      for (let y = 0; y < h; y++) {
        const srcRow = y;
        const dstRow = (h - 1) - y; // flip vertically
        for (let x = 0; x < w; x++) {
          const srcIdx = (srcRow * w + x) * 4;
          const dstIdx = (dstRow * w + x) * 4;
          const r = data[srcIdx];
          const g = data[srcIdx + 1];
          const b = data[srcIdx + 2];
          const a = data[srcIdx + 3];

          pixelData[dstIdx] = b;     // Blue
          pixelData[dstIdx + 1] = g; // Green
          pixelData[dstIdx + 2] = r; // Red
          pixelData[dstIdx + 3] = a; // Alpha
        }
      }

      // 1-bit AND mask: all zeros for 32-bit alpha icons
      const andRowBytes = Math.ceil(w / 32) * 4;
      const andMask = Buffer.alloc(andRowBytes * h, 0);

      const dibBuffer = Buffer.concat([header, pixelData, andMask]);
      imageBuffers.push(dibBuffer);

      iconEntries.push({
        width: size,
        height: size,
        colorCount: 0,
        reserved: 0,
        planes: 1,
        bpp: 32,
        size: dibBuffer.length,
      });
    }
  }

  // Calculate file offsets
  const count = iconEntries.length;
  const headerSize = 6;
  const entrySize = 16;
  let currentOffset = headerSize + count * entrySize;

  for (let i = 0; i < count; i++) {
    iconEntries[i].offset = currentOffset;
    currentOffset += imageBuffers[i].length;
  }

  // Build final ICO Buffer
  const icoBuffer = Buffer.alloc(currentOffset);

  // ICONDIR Header
  icoBuffer.writeUInt16LE(0, 0); // reserved
  icoBuffer.writeUInt16LE(1, 2); // type: 1 = ICO
  icoBuffer.writeUInt16LE(count, 4); // count

  // ICONDIRENTRY entries
  let pos = 6;
  for (const entry of iconEntries) {
    icoBuffer.writeUInt8(entry.width, pos);
    icoBuffer.writeUInt8(entry.height, pos + 1);
    icoBuffer.writeUInt8(entry.colorCount, pos + 2);
    icoBuffer.writeUInt8(entry.reserved, pos + 3);
    icoBuffer.writeUInt16LE(entry.planes, pos + 4);
    icoBuffer.writeUInt16LE(entry.bpp, pos + 6);
    icoBuffer.writeUInt32LE(entry.size, pos + 8);
    icoBuffer.writeUInt32LE(entry.offset, pos + 12);
    pos += entrySize;
  }

  // Write image bodies
  for (const imgBuf of imageBuffers) {
    imgBuf.copy(icoBuffer, pos);
    pos += imgBuf.length;
  }

  fs.writeFileSync(destIcoPath, icoBuffer);
  console.log(`Successfully created standard Windows ICO: ${destIcoPath} (${icoBuffer.length} bytes)`);
}

export async function processBrandIcon(sourceJpgPath) {
  console.log('Processing brand icon from:', sourceJpgPath);

  // 1. Process source image
  const meta = await sharp(sourceJpgPath).metadata();
  let masked;

  if (meta.format === 'png' && meta.hasAlpha && meta.width === 896 && meta.height === 896) {
    masked = await sharp(sourceJpgPath).toBuffer();
  } else {
    const cropSize = 896;
    const cropped = await sharp(sourceJpgPath)
      .extract({ left: 64, top: 64, width: cropSize, height: cropSize })
      .toBuffer();

    const rx = Math.round(cropSize * 0.225);
    const maskSvg = Buffer.from(
      `<svg width="${cropSize}" height="${cropSize}" viewBox="0 0 ${cropSize} ${cropSize}">
        <rect x="0" y="0" width="${cropSize}" height="${cropSize}" rx="${rx}" ry="${rx}" fill="#ffffff" />
      </svg>`
    );

    masked = await sharp(cropped)
      .ensureAlpha()
      .composite([{ input: maskSvg, blend: 'dest-in' }])
      .png()
      .toBuffer();
  }

  // 3. Generate PNGs
  const master512 = await sharp(masked).resize(512, 512).png().toBuffer();
  const master256 = await sharp(masked).resize(256, 256).png().toBuffer();
  const master192 = await sharp(masked).resize(192, 192).png().toBuffer();
  const master128 = await sharp(masked).resize(128, 128).png().toBuffer();
  const master64  = await sharp(masked).resize(64, 64).png().toBuffer();
  const master48  = await sharp(masked).resize(48, 48).png().toBuffer();
  const master32  = await sharp(masked).resize(32, 32).png().toBuffer();
  const master16  = await sharp(masked).resize(16, 16).png().toBuffer();

  // Save targets
  fs.writeFileSync('build/icon.png', master512);
  fs.writeFileSync('build/icon_512.png', master512);
  fs.writeFileSync('build/icon_256.png', master256);
  fs.writeFileSync('build/icon-192.png', master192);
  fs.writeFileSync('renderer/src/assets/logo.png', master512);

  // 4. Build Windows multi-res ICO
  const sizesMap = {
    256: master256,
    128: master128,
    64: master64,
    48: master48,
    32: master32,
    16: master16,
  };

  await createWindowsIco(sizesMap, path.resolve('build/icon.ico'));
  console.log('All icons successfully updated in build/ and renderer/src/assets/');
}

// Allow CLI execution: node scripts/prepare-icons.js <path-to-image>
if (process.argv[2]) {
  processBrandIcon(process.argv[2]).catch(console.error);
}
