/**
 * Kichik QR kod generatori — faqat bayt rejimi, M darajadagi xatolik tuzatish,
 * 1–3 versiya (48 baytgacha). Tashqi kutubxonalarsiz ishlaydi.
 * Chipta kodi kabi qisqa matnlar uchun yetarli.
 */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
}

function mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function polyMul(a: number[], b: number[]): number[] {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) out[i + j] ^= mul(a[i], b[j]);
  }
  return out;
}

export function rsRemainder(data: number[], eccLen: number): number[] {
  let gen = [1];
  for (let i = 0; i < eccLen; i += 1) gen = polyMul(gen, [1, EXP[i]]);
  const res = [...data, ...new Array<number>(eccLen).fill(0)];
  for (let i = 0; i < data.length; i += 1) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j += 1) res[i + j] ^= mul(gen[j], coef);
    }
  }
  return res.slice(data.length);
}

export type Spec = { version: number; size: number; dataCodewords: number; eccCodewords: number; align: number[] };

export const SPECS: Spec[] = [
  { version: 1, size: 21, dataCodewords: 16, eccCodewords: 10, align: [] },
  { version: 2, size: 25, dataCodewords: 28, eccCodewords: 16, align: [6, 18] },
  { version: 3, size: 29, dataCodewords: 44, eccCodewords: 26, align: [6, 22] },
];

function pickSpec(bytes: number): Spec {
  for (const spec of SPECS) {
    if (bytes * 8 + 12 <= spec.dataCodewords * 8) return spec;
  }
  throw new Error("QR uchun matn juda uzun");
}

export function qrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  const spec = pickSpec(bytes.length);
  const { size } = spec;

  const modules: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));

  const set = (r: number, c: number, dark: boolean) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    modules[r][c] = dark;
    reserved[r][c] = true;
  };

  const finder = (r0: number, c0: number) => {
    for (let dr = -1; dr <= 7; dr += 1) {
      for (let dc = -1; dc <= 7; dc += 1) {
        const inRing = dr >= 0 && dr <= 6 && (dc === 0 || dc === 6);
        const inRow = dc >= 0 && dc <= 6 && (dr === 0 || dr === 6);
        const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        set(r0 + dr, c0 + dc, inRing || inRow || inCore);
      }
    }
  };

  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  for (let i = 8; i < size - 8; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  for (const r of spec.align) {
    for (const c of spec.align) {
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          const ring = Math.max(Math.abs(dr), Math.abs(dc));
          set(r + dr, c + dc, ring !== 1);
        }
      }
    }
  }

  set(size - 8, 8, true); // qorong'i modul
  // Format ma'lumoti uchun joy
  for (let i = 0; i < 9; i += 1) {
    if (!reserved[8][i]) set(8, i, false);
    if (!reserved[i][8]) set(i, 8, false);
  }
  for (let i = size - 8; i < size; i += 1) {
    if (!reserved[8][i]) set(8, i, false);
    if (!reserved[i][8]) set(i, 8, false);
  }

  // Bit oqimi
  const bits: number[] = [];
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const byte of bytes) push(byte, 8);

  const capacity = spec.dataCodewords * 8;
  for (let i = 0; i < 4 && bits.length < capacity; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    data.push(byte);
  }
  const pad = [0xec, 0x11];
  let padIndex = 0;
  while (data.length < spec.dataCodewords) {
    data.push(pad[padIndex % 2]);
    padIndex += 1;
  }

  const all = [...data, ...rsRemainder(data, spec.eccCodewords)];
  const stream: number[] = [];
  for (const byte of all) for (let i = 7; i >= 0; i -= 1) stream.push((byte >>> i) & 1);

  // Ma'lumot modullarini joylash
  let index = 0;
  let row = size - 1;
  let dir = -1;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (;;) {
      for (let k = 0; k < 2; k += 1) {
        const cc = col - k;
        if (!reserved[row][cc]) {
          modules[row][cc] = index < stream.length ? stream[index] === 1 : false;
          index += 1;
        }
      }
      row += dir;
      if (row < 0 || row >= size) {
        row -= dir;
        dir = -dir;
        break;
      }
    }
  }

  // Mask 0
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (!reserved[r][c] && (r + c) % 2 === 0) modules[r][c] = !modules[r][c];
    }
  }

  // Format ma'lumoti (M darajasi = 00, mask 0)
  const formatData = (0b00 << 3) | 0;
  let rem = formatData;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const formatBits = ((formatData << 10) | rem) ^ 0x5412;

  for (let i = 0; i < 15; i += 1) {
    const dark = ((formatBits >>> i) & 1) === 1;
    if (i < 6) modules[i][8] = dark;
    else if (i < 8) modules[i + 1][8] = dark;
    else modules[size - 15 + i][8] = dark;

    if (i < 8) modules[8][size - i - 1] = dark;
    else if (i < 9) modules[8][15 - i] = dark;
    else modules[8][15 - i - 1] = dark;
  }
  modules[size - 8][8] = true;

  return modules;
}

/** Versiya bo'yicha «band» (funksional) modullar xaritasi — dekoder ham shundan foydalanadi. */
export function reservedLayout(version: number, size: number): boolean[][] {
  const spec = SPECS.find((s) => s.version === version) ?? SPECS[0];
  const reserved: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const mark = (r: number, c: number) => {
    if (r >= 0 && c >= 0 && r < size && c < size) reserved[r][c] = true;
  };
  const finder = (r0: number, c0: number) => {
    for (let dr = -1; dr <= 7; dr += 1) for (let dc = -1; dc <= 7; dc += 1) mark(r0 + dr, c0 + dc);
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);
  for (let i = 8; i < size - 8; i += 1) {
    mark(6, i);
    mark(i, 6);
  }
  for (const r of spec.align) {
    for (const c of spec.align) {
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr += 1) for (let dc = -2; dc <= 2; dc += 1) mark(r + dr, c + dc);
    }
  }
  for (let i = 0; i < 9; i += 1) {
    mark(8, i);
    mark(i, 8);
  }
  for (let i = size - 8; i < size; i += 1) {
    mark(8, i);
    mark(i, 8);
  }
  return reserved;
}
