import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function renderIconPng(size: number): Buffer {
  const raw = Buffer.alloc((size * 4 + 1) * size, 0);
  const r = size * 0.22;

  const isInsideRoundedRect = (x: number, y: number): boolean => {
    const cx = Math.min(Math.max(x, r), size - 1 - r);
    const cy = Math.min(Math.max(y, r), size - 1 - r);
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  };

  // Equalizer / waveform bars normalized [xCenter, halfWidth, halfHeight]
  const bars: Array<[number, number, number]> = [
    [0.28, 0.065, 0.16],
    [0.425, 0.065, 0.30],
    [0.575, 0.065, 0.23],
    [0.72, 0.065, 0.14],
  ];

  for (let y = 0; y < size; y++) {
    const rowOff = y * (size * 4 + 1);
    raw[rowOff] = 0; // PNG filter 0
    for (let x = 0; x < size; x++) {
      const px = rowOff + 1 + x * 4;
      if (!isInsideRoundedRect(x + 0.5, y + 0.5)) {
        raw[px] = 0;
        raw[px + 1] = 0;
        raw[px + 2] = 0;
        raw[px + 3] = 0;
        continue;
      }

      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;

      // Subtle dark slate gradient background
      let red = Math.round(16 + nx * 12);
      let green = Math.round(18 + ny * 10);
      let blue = Math.round(25 + (1 - ny) * 14);

      // Crisp emerald -> cyan waveform bars
      for (const [bx, bw, bh] of bars) {
        if (Math.abs(nx - bx) <= bw && Math.abs(ny - 0.5) <= bh) {
          red = Math.round(16 + nx * 40);
          green = Math.round(185 + (1 - nx) * 30);
          blue = Math.round(129 + nx * 115);
          break;
        }
      }

      raw[px] = red;
      raw[px + 1] = green;
      raw[px + 2] = blue;
      raw[px + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function buildIco(sizes: number[]): Buffer {
  const pngs = sizes.map((s) => ({ size: s, data: renderIconPng(s) }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(pngs.length, 4);

  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;

  pngs.forEach((p, i) => {
    const entryOff = i * 16;
    dir[entryOff] = p.size >= 256 ? 0 : p.size;
    dir[entryOff + 1] = p.size >= 256 ? 0 : p.size;
    dir[entryOff + 2] = 0;
    dir[entryOff + 3] = 0;
    dir.writeUInt16LE(1, entryOff + 4);
    dir.writeUInt16LE(32, entryOff + 6);
    dir.writeUInt32LE(p.data.length, entryOff + 8);
    dir.writeUInt32LE(offset, entryOff + 12);
    offset += p.data.length;
  });

  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

const outPath = path.resolve("desktop", "vaultstream.ico");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buildIco([16, 32, 48, 256]));
console.log("Generated", outPath);
