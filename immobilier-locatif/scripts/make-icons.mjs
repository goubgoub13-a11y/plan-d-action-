// Génère les icônes PNG de la PWA (aucune dépendance : rasterisation + encodage PNG maison).
// Usage : npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const C1 = [0x14, 0xb8, 0xa6];
const C2 = [0x0f, 0x76, 0x6e];
// Maison dans un repère 512 × 512 (identique à public/icon.svg)
const HOUSE = [[256, 110], [106, 238], [146, 238], [146, 388], [366, 388], [366, 238], [406, 238]];
const DOOR = [226, 290, 286, 388];

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inRoundRect(x, y, s, r) {
  const cx = Math.min(Math.max(x, r), s - r);
  const cy = Math.min(Math.max(y, r), s - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** Couleur RGBA d'un point (coordonnées 0–512). */
function sample(x, y, { rounded, scale }) {
  if (rounded && !inRoundRect(x, y, 512, 112)) return [0, 0, 0, 0];
  // Repère de la maison, éventuellement réduit autour du centre (zone sûre des icônes « maskable »).
  const hx = 256 + (x - 256) / scale;
  const hy = 256 + (y - 256) / scale;
  if (hx >= DOOR[0] && hx <= DOOR[2] && hy >= DOOR[1] && hy <= DOOR[3]) return [...C2, 255];
  if (inPoly(hx, hy, HOUSE)) return [255, 255, 255, 255];
  const t = (x + y) / 1024;
  return [0, 1, 2].map((i) => Math.round(C1[i] + (C2[i] - C1[i]) * t)).concat(255);
}

function render(size, opts) {
  const SS = 4;
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sample(((x + (sx + 0.5) / SS) / size) * 512, ((y + (sy + 0.5) / SS) / size) * 512, opts);
          const a = c[3] / 255;
          acc[0] += c[0] * a;
          acc[1] += c[1] * a;
          acc[2] += c[2] * a;
          acc[3] += c[3];
        }
      }
      const n = SS * SS;
      const alpha = acc[3] / n;
      const o = (y * size + x) * 4;
      const k = alpha > 0 ? 255 / alpha / n : 0;
      px[o] = Math.round(acc[0] * k);
      px[o + 1] = Math.round(acc[1] * k);
      px[o + 2] = Math.round(acc[2] * k);
      px[o + 3] = Math.round(alpha);
    }
  }
  return px;
}

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const targets = [
  ['icon-192.png', 192, { rounded: true, scale: 1 }],
  ['icon-512.png', 512, { rounded: true, scale: 1 }],
  ['icon-maskable-512.png', 512, { rounded: false, scale: 0.78 }],
  ['apple-touch-icon.png', 180, { rounded: false, scale: 0.9 }],
];
for (const [name, size, opts] of targets) {
  writeFileSync(join(OUT, name), png(size, render(size, opts)));
  console.log('✓', name);
}
