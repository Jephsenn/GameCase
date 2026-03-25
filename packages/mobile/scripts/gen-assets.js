/**
 * Generates placeholder icon.png (1024×1024) and splash.png (2048×2048)
 * with a solid #0f172a (dark navy) background.
 * Run once with: node scripts/gen-assets.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function makePng(width, height, r, g, b) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = (() => {
    const data = Buffer.alloc(13);
    data.writeUInt32BE(width, 0);
    data.writeUInt32BE(height, 4);
    data[8] = 8;  // bit depth
    data[9] = 2;  // color type: RGB
    data[10] = 0; // compression
    data[11] = 0; // filter
    data[12] = 0; // interlace
    return makeChunk('IHDR', data);
  })();

  // Raw scanlines: each row is [filter_byte=0, r, g, b, r, g, b, ...]
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    const off = y * rowSize;
    raw[off] = 0; // filter none
    for (let x = 0; x < width; x++) {
      raw[off + 1 + x * 3] = r;
      raw[off + 1 + x * 3 + 1] = g;
      raw[off + 1 + x * 3 + 2] = b;
    }
  }

  // IDAT (zlib compressed)
  const compressed = zlib.deflateSync(raw);
  const idat = makeChunk('IDAT', compressed);

  // IEND
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBytes = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, typeBytes, data, crc]);
}

const assetsDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

// Background color: #0f172a = rgb(15, 23, 42)
const [r, g, b] = [15, 23, 42];

console.log('Generating icon.png (1024×1024)…');
fs.writeFileSync(path.join(assetsDir, 'icon.png'), makePng(1024, 1024, r, g, b));

console.log('Generating splash.png (2048×2048)…');
fs.writeFileSync(path.join(assetsDir, 'splash.png'), makePng(2048, 2048, r, g, b));

console.log('Done! Assets written to packages/mobile/assets/');
