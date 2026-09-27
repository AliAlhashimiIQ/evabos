import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function makeIco() {
  const src = path.resolve('build/icon.png');
  const dest = path.resolve('build/icon.ico');

  const sizes = [256, 128, 64, 48, 32, 16];
  const pngBuffers = [];

  for (const size of sizes) {
    const buf = await sharp(src)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    pngBuffers.push({ size, buf });
  }

  // Calculate ICO header & directory
  const count = pngBuffers.length;
  const headerSize = 6;
  const entrySize = 16;
  const dirSize = headerSize + count * entrySize;

  let currentOffset = dirSize;
  const entries = [];

  for (const { size, buf } of pngBuffers) {
    entries.push({
      width: size === 256 ? 0 : size,
      height: size === 256 ? 0 : size,
      colorCount: 0,
      reserved: 0,
      planes: 1,
      bpp: 32,
      size: buf.length,
      offset: currentOffset,
    });
    currentOffset += buf.length;
  }

  const totalSize = currentOffset;
  const icoBuffer = Buffer.alloc(totalSize);

  // Write ICONDIR
  icoBuffer.writeUInt16LE(0, 0); // reserved
  icoBuffer.writeUInt16LE(1, 2); // type: 1 = ICO
  icoBuffer.writeUInt16LE(count, 4); // count

  // Write ICONDIRENTRY
  let pos = 6;
  for (const entry of entries) {
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

  // Write Image Data
  for (const { buf } of pngBuffers) {
    buf.copy(icoBuffer, pos);
    pos += buf.length;
  }

  fs.writeFileSync(dest, icoBuffer);
  console.log('Successfully created multi-res build/icon.ico (' + icoBuffer.length + ' bytes)');
}

makeIco().catch((err) => {
  console.error('Failed to create icon.ico:', err);
  process.exit(1);
});
