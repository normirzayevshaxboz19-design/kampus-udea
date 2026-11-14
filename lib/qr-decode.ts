/**
 * Oddiy QR dekoder — 1–3 versiya, M darajadagi xatolik tuzatish bilan yaratilgan
 * kodlar uchun. Tashqi kutubxonasiz. Kamera kadridan finder patternlarni topib,
 * modullarni namunalab, ma'lumotni o'qiydi va ECC orqali tekshiradi.
 */

import { rsRemainder, SPECS, reservedLayout } from "./qr";

type Point = { x: number; y: number };

type Runs = { start: number; len: number; black: boolean }[];

function toBinary(image: ImageData): { bits: Uint8Array; width: number; height: number } {
  const { data, width, height } = image;
  const gray = new Uint8Array(width * height);
  let min = 255;
  let max = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const v = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    gray[p] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const threshold = (min + max) / 2;
  const bits = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i += 1) bits[i] = gray[i] < threshold ? 1 : 0;
  return { bits, width, height };
}

function runLengths(bits: Uint8Array, width: number, height: number, y: number): Runs {
  const runs: Runs = [];
  let start = 0;
  let color = bits[y * width];
  for (let x = 1; x <= width; x += 1) {
    const c = x < width ? bits[y * width + x] : -1;
    if (c !== color) {
      runs.push({ start, len: x - start, black: color === 1 });
      start = x;
      color = c;
    }
  }
  return runs;
}

function columnRuns(bits: Uint8Array, width: number, _height: number, x: number, y0: number, y1: number): Runs {
  const runs: Runs = [];
  let start = y0;
  let color = bits[y0 * width + x];
  for (let y = y0 + 1; y <= y1; y += 1) {
    const c = y < y1 ? bits[y * width + x] : -1;
    if (c !== color) {
      runs.push({ start, len: y - start, black: color === 1 });
      start = y;
      color = c;
    }
  }
  return runs;
}

function finderRatio(runs: Runs): number | null {
  if (runs.length < 5) return null;
  const [a, b, c, d, e] = runs;
  if (!a.black || b.black || !c.black || d.black || !e.black) return null;
  const total = a.len + b.len + c.len + d.len + e.len;
  const unit = total / 7;
  if (unit < 2) return null;
  const near = (value: number, target: number) => Math.abs(value - target) <= unit * 1.2;
  if (!near(a.len, unit) || !near(b.len, unit) || !near(c.len, unit * 3) || !near(d.len, unit) || !near(e.len, unit)) {
    return null;
  }
  return unit;
}

function findFinders(bits: Uint8Array, width: number, height: number): { point: Point; unit: number }[] {
  const found: { point: Point; unit: number }[] = [];
  for (let y = 0; y < height; y += 2) {
    const runs = runLengths(bits, width, height, y);
    for (let i = 0; i + 4 < runs.length; i += 1) {
      const slice = runs.slice(i, i + 5);
      const unit = finderRatio(slice);
      if (unit === null) continue;
      const centerX = Math.round(slice[2].start + slice[2].len / 2);
      const span = Math.round(unit * 8);
      const y0 = Math.max(0, y - span);
      const y1 = Math.min(height, y + span);
      const vertical = columnRuns(bits, width, height, centerX, y0, y1);
      for (let k = 0; k + 4 < vertical.length; k += 1) {
        const vslice = vertical.slice(k, k + 5);
        const vunit = finderRatio(vslice);
        if (vunit === null) continue;
        const centerY = Math.round(vslice[2].start + vslice[2].len / 2);
        if (Math.abs(centerY - y) > unit * 4) continue;
        found.push({ point: { x: centerX, y: centerY }, unit });
        break;
      }
    }
  }

  // Klasterlash
  const clusters: { point: Point; unit: number; count: number }[] = [];
  for (const hit of found) {
    const near = clusters.find(
      (c) => Math.hypot(c.point.x - hit.point.x, c.point.y - hit.point.y) < Math.max(6, hit.unit * 3)
    );
    if (near) {
      near.point.x = (near.point.x * near.count + hit.point.x) / (near.count + 1);
      near.point.y = (near.point.y * near.count + hit.point.y) / (near.count + 1);
      near.unit = (near.unit * near.count + hit.unit) / (near.count + 1);
      near.count += 1;
    } else {
      clusters.push({ point: { ...hit.point }, unit: hit.unit, count: 1 });
    }
  }
  return clusters.filter((c) => c.count >= 1).map((c) => ({ point: c.point, unit: c.unit }));
}

function bestTriple(finders: { point: Point; unit: number }[]) {
  let best: { tl: Point; tr: Point; bl: Point; unit: number } | null = null;
  let bestScore = -1;
  for (let i = 0; i < finders.length; i += 1) {
    for (let j = i + 1; j < finders.length; j += 1) {
      for (let k = j + 1; k < finders.length; k += 1) {
        const pts = [finders[i], finders[j], finders[k]];
        for (let vertex = 0; vertex < 3; vertex += 1) {
          const others = [0, 1, 2].filter((n) => n !== vertex);
          const a = pts[others[0]].point;
          const b = pts[others[1]].point;
          const c = pts[vertex].point;
          const v1 = { x: a.x - c.x, y: a.y - c.y };
          const v2 = { x: b.x - c.x, y: b.y - c.y };
          const dot = v1.x * v2.x + v1.y * v2.y;
          const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1;
          const score = -Math.abs(dot / mag);
          if (score > bestScore) {
            const cross = v1.x * v2.y - v1.y * v2.x;
            bestScore = score;
            best = {
              tl: c,
              tr: cross > 0 ? a : b,
              bl: cross > 0 ? b : a,
              unit: (pts[0].unit + pts[1].unit + pts[2].unit) / 3,
            };
          }
        }
      }
    }
  }
  return best;
}

function sample(
  bits: Uint8Array,
  width: number,
  height: number,
  tl: Point,
  tr: Point,
  bl: Point,
  size: number
): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const denom = size - 7;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const u = (col - 3) / denom;
      const v = (row - 3) / denom;
      const x = tl.x + (tr.x - tl.x) * u + (bl.x - tl.x) * v;
      const y = tl.y + (tr.y - tl.y) * u + (bl.y - tl.y) * v;
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || py < 0 || px >= width || py >= height) return matrix;
      matrix[row][col] = bits[py * width + px] === 1;
    }
  }
  return matrix;
}

function rotate(matrix: boolean[][]): boolean[][] {
  const size = matrix.length;
  const out: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) out[c][size - 1 - r] = matrix[r][c];
  }
  return out;
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function readFormat(matrix: boolean[][]): number {
  const size = matrix.length;
  let bits = 0;
  for (let i = 0; i < 15; i += 1) {
    let bit = false;
    if (i < 6) bit = matrix[i][8];
    else if (i < 8) bit = matrix[i + 1][8];
    else bit = matrix[size - 15 + i][8];
    if (bit) bits |= 1 << i;
  }
  const unmasked = bits ^ 0x5412;
  const data = unmasked >>> 10;
  return data & 0b111; // mask
}

function readCodewords(matrix: boolean[][], version: number): number[] {
  const size = matrix.length;
  const reserved = reservedLayout(version, size);
  const bits: number[] = [];
  let row = size - 1;
  let dir = -1;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (;;) {
      for (let k = 0; k < 2; k += 1) {
        const cc = col - k;
        if (!reserved[row][cc]) bits.push(matrix[row][cc] ? 1 : 0);
      }
      row += dir;
      if (row < 0 || row >= size) {
        row -= dir;
        dir = -dir;
        break;
      }
    }
  }
  const codewords: number[] = [];
  for (let i = 0; i + 7 < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  return codewords;
}

function decodeMatrix(matrix: boolean[][], version: number): string | null {
  const spec = SPECS.find((s) => s.version === version);
  if (!spec || matrix.length !== spec.size) return null;

  const mask = readFormat(matrix);
  if (!Number.isInteger(mask) || mask < 0 || mask > 7) return null;
  const size = matrix.length;
  const reserved = reservedLayout(version, size);
  const unmasked: boolean[][] = matrix.map((row, r) =>
    row.map((cell, c) => (!reserved[r][c] && MASKS[mask](r, c) ? !cell : cell))
  );

  const words = readCodewords(unmasked, version);
  if (words.length < spec.dataCodewords + spec.eccCodewords) return null;
  const data = words.slice(0, spec.dataCodewords);
  const ecc = words.slice(spec.dataCodewords, spec.dataCodewords + spec.eccCodewords);
  const expected = rsRemainder(data, spec.eccCodewords);
  if (expected.some((value, i) => value !== ecc[i])) return null;

  const stream: number[] = [];
  for (const byte of data) for (let i = 7; i >= 0; i -= 1) stream.push((byte >>> i) & 1);
  let index = 0;
  const take = (len: number) => {
    let value = 0;
    for (let i = 0; i < len; i += 1) value = (value << 1) | (stream[index++] ?? 0);
    return value;
  };
  if (take(4) !== 0b0100) return null;
  const length = take(8);
  if (length < 1 || length > 48) return null;
  const bytes: number[] = [];
  for (let i = 0; i < length; i += 1) bytes.push(take(8));
  if (bytes.some((b) => b < 32 || b > 126)) return null;
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/** Rasm ichidagi QR kod matnini qaytaradi (topilmasa null). */
export function decodeQrImage(image: ImageData): string | null {
  const { bits, width, height } = toBinary(image);
  const finders = findFinders(bits, width, height);
  if (finders.length < 3) return null;

  const triple = bestTriple(finders);
  if (!triple) return null;

  const span = Math.hypot(triple.tr.x - triple.tl.x, triple.tr.y - triple.tl.y);
  const rawSize = Math.round(span / Math.max(1, triple.unit)) + 7;
  const candidates = [rawSize, ...SPECS.map((s) => s.size)].filter(
    (size, i, list) => list.indexOf(size) === i && size >= 21 && size <= 33 && (size - 21) % 4 === 0
  );

  for (const size of candidates) {
    const version = (size - 17) / 4;
    let matrix = sample(bits, width, height, triple.tl, triple.tr, triple.bl, size);
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const text = decodeMatrix(matrix, version);
      if (text) return text;
      matrix = rotate(matrix);
    }
  }
  return null;
}
