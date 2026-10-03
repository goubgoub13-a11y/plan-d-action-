// Génère les icônes PNG de la PWA (aucune dépendance : rasterisation + encodage PNG maison).
// Usage : npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

// Monogramme (identique à public/icon.svg) dans un repère 512 × 512.
const C1 = [0x1a, 0x4a, 0x3e];
const C2 = [0x0c, 0x2c, 0x24];
const INK = [0xf3, 0xf7, 0xf5];
const MINT = [0x8f, 0xdc, 0xc0];
const ROOF = [[120, 262], [256, 146], [392, 262]];
const ROOF_HALF_WIDTH = 19;
const BARS = [
  { x: 170, y: 300, w: 44, h: 82, color: INK, alpha: 0.5 },
  { x: 234, y: 262, w: 44, h: 120, color: INK, alpha: 0.78 },
  { x: 298, y: 222, w: 44, h: 160, color: MINT, alpha: 1 },
];

function distToSegment(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function inRoundRect(x, y, rx, ry, w, h, r) {
  if (x < rx || x > rx + w || y < ry || y > ry + h) return false;
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const cy = Math.min(Math.max(y, ry + r), ry + h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** Couleur RGBA d'un point (coordonnées 0–512). */
function sample(x, y, { rounded, scale }) {
  if (rounded && !inRoundRect(x, y, 0, 0, 512, 512, 116)) return [0, 0, 0, 0];
  // Contenu éventuellement réduit autour du centre (zone sûre des icônes « maskable »).
  const hx = 256 + (x - 256) / scale;
  const hy = 256 + (y - 256) / scale;
  let c = mix(C1, C2, (x + y) / 1024);
  for (const b of BARS) if (inRoundRect(hx, hy, b.x, b.y, b.w, b.h, 12)) c = mix(c, b.color, b.alpha);
  if (distToSegment(hx, hy, ROOF[0], ROOF[1]) <= ROOF_HALF_WIDTH || distToSegment(hx, hy, ROOF[1], ROOF[2]) <= ROOF_HALF_WIDTH) c = INK;
  return [...c.map(Math.round), 255];
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
