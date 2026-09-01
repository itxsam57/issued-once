import { inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_DECODED_RASTER_BYTES = 256 * 1024 * 1024;
const ADAM7_PASSES = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
] as const;

type PngHeader = {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlaceMethod: 0 | 1;
};

export type PngDimensions = Pick<PngHeader, 'width' | 'height'>;

function invalidPng(message: string): never {
  throw new Error(`Invalid PNG artwork: ${message}`);
}

function crc32(parts: readonly Buffer[]): number {
  let crc = 0xffff_ffff;
  for (const part of parts) {
    for (const byte of part) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (0xedb8_8320 & -(crc & 1));
      }
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

function bitsPerPixel(colorType: number, bitDepth: number): number {
  const allowedDepths: Record<number, readonly number[]> = {
    0: [1, 2, 4, 8, 16],
    2: [8, 16],
    3: [1, 2, 4, 8],
    4: [8, 16],
    6: [8, 16],
  };
  if (!allowedDepths[colorType]?.includes(bitDepth)) {
    return invalidPng('IHDR color type and bit depth are not supported by the PNG specification');
  }
  const channels = colorType === 0 || colorType === 3 ? 1 : colorType === 2 ? 3 : colorType === 4 ? 2 : 4;
  return channels * bitDepth;
}

function passDimension(size: number, start: number, step: number): number {
  return size <= start ? 0 : Math.ceil((size - start) / step);
}

function scanlineBytes(width: number, height: number, bitsPerPixelValue: number, interlaceMethod: 0 | 1): number {
  const passes = interlaceMethod === 0 ? [[0, 0, 1, 1] as const] : ADAM7_PASSES;
  let total = 0;
  for (const [startX, startY, stepX, stepY] of passes) {
    const passWidth = passDimension(width, startX, stepX);
    const passHeight = passDimension(height, startY, stepY);
    if (!passWidth || !passHeight) continue;
    const rowBytes = Math.ceil((passWidth * bitsPerPixelValue) / 8);
    total += (rowBytes + 1) * passHeight;
    if (!Number.isSafeInteger(total) || total > MAX_DECODED_RASTER_BYTES) {
      return invalidPng('decoded raster is too large to validate safely');
    }
  }
  return total;
}

function validateFilterBytes(
  decoded: Buffer,
  width: number,
  height: number,
  bitsPerPixelValue: number,
  interlaceMethod: 0 | 1,
) {
  const passes = interlaceMethod === 0 ? [[0, 0, 1, 1] as const] : ADAM7_PASSES;
  let offset = 0;
  for (const [startX, startY, stepX, stepY] of passes) {
    const passWidth = passDimension(width, startX, stepX);
    const passHeight = passDimension(height, startY, stepY);
    if (!passWidth || !passHeight) continue;
    const rowBytes = Math.ceil((passWidth * bitsPerPixelValue) / 8);
    for (let row = 0; row < passHeight; row += 1) {
      const filterType = decoded[offset];
      if (filterType === undefined || filterType > 4) invalidPng('scanline filter data is invalid');
      offset += rowBytes + 1;
    }
  }
  if (offset !== decoded.length) invalidPng('decoded raster length does not match IHDR dimensions');
}

function parseHeader(data: Buffer): PngHeader {
  if (data.length !== 13) return invalidPng('IHDR must contain exactly 13 bytes');
  const width = data.readUInt32BE(0);
  const height = data.readUInt32BE(4);
  const bitDepth = data[8];
  const colorType = data[9];
  const compressionMethod = data[10];
  const filterMethod = data[11];
  const interlaceMethod = data[12];
  if (!width || !height) return invalidPng('IHDR dimensions must be positive');
  bitsPerPixel(colorType, bitDepth);
  if (compressionMethod !== 0) return invalidPng('IHDR compression method is invalid');
  if (filterMethod !== 0) return invalidPng('IHDR filter method is invalid');
  if (interlaceMethod !== 0 && interlaceMethod !== 1) return invalidPng('IHDR interlace method is invalid');
  return { width, height, bitDepth, colorType, interlaceMethod };
}

function isCriticalChunk(type: string): boolean {
  const first = type.charCodeAt(0);
  return first >= 0x41 && first <= 0x5a;
}

export function readValidatedPngDimensions(bytes: Buffer): PngDimensions {
  if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return invalidPng('signature is missing or corrupt');
  }

  let offset = PNG_SIGNATURE.length;
  let header: PngHeader | undefined;
  let paletteSeen = false;
  let idatSeen = false;
  let idatClosed = false;
  let iendSeen = false;
  const idatChunks: Buffer[] = [];

  while (offset < bytes.length) {
    if (bytes.length - offset < 12) return invalidPng('chunk header is truncated');
    const length = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = typeStart + 4;
    const dataEnd = dataStart + length;
    const crcOffset = dataEnd;
    const nextOffset = crcOffset + 4;
    if (!Number.isSafeInteger(nextOffset) || nextOffset > bytes.length) return invalidPng('chunk data is truncated');

    const typeBytes = bytes.subarray(typeStart, dataStart);
    const type = typeBytes.toString('ascii');
    if (!/^[A-Za-z]{4}$/.test(type)) return invalidPng('chunk type is invalid');
    const data = bytes.subarray(dataStart, dataEnd);
    const expectedCrc = bytes.readUInt32BE(crcOffset);
    if (crc32([typeBytes, data]) !== expectedCrc) return invalidPng(`${type} chunk checksum is corrupt`);

    if (!header && type !== 'IHDR') return invalidPng('IHDR must be the first chunk');
    if (iendSeen) return invalidPng('data appears after IEND');

    if (type === 'IHDR') {
      if (header) return invalidPng('IHDR appears more than once');
      header = parseHeader(data);
    } else if (type === 'PLTE') {
      if (!header) return invalidPng('PLTE appears before IHDR');
      if (paletteSeen) return invalidPng('PLTE appears more than once');
      if (idatSeen) return invalidPng('PLTE appears after IDAT');
      if (header.colorType === 0 || header.colorType === 4) return invalidPng('PLTE is not allowed for this color type');
      if (!length || length % 3 !== 0 || length > 768) return invalidPng('PLTE length is invalid');
      if (header.colorType === 3 && length / 3 > 2 ** header.bitDepth) return invalidPng('PLTE has too many entries for the bit depth');
      paletteSeen = true;
    } else if (type === 'IDAT') {
      if (idatClosed) return invalidPng('IDAT chunks must be consecutive');
      idatSeen = true;
      idatChunks.push(data);
    } else {
      if (idatSeen && type !== 'IEND') idatClosed = true;
      if (type === 'IEND') {
        if (length !== 0) return invalidPng('IEND must be empty');
        iendSeen = true;
      } else if (isCriticalChunk(type)) {
        return invalidPng(`unknown critical chunk ${type}`);
      }
    }

    offset = nextOffset;
    if (iendSeen) {
      if (offset !== bytes.length) return invalidPng('data appears after IEND');
      break;
    }
  }

  if (!header) return invalidPng('IHDR is missing');
  if (!idatSeen) return invalidPng('IDAT image data is missing');
  if (!iendSeen) return invalidPng('IEND is missing');
  if (header.colorType === 3 && !paletteSeen) return invalidPng('indexed-color PNG is missing PLTE');

  const bits = bitsPerPixel(header.colorType, header.bitDepth);
  const expectedDecodedBytes = scanlineBytes(header.width, header.height, bits, header.interlaceMethod);
  let decoded: Buffer;
  try {
    decoded = inflateSync(Buffer.concat(idatChunks), { maxOutputLength: expectedDecodedBytes + 1 });
  } catch {
    return invalidPng('IDAT image data is corrupt or not decodable');
  }
  if (decoded.length !== expectedDecodedBytes) return invalidPng('decoded raster length does not match IHDR dimensions');
  validateFilterBytes(decoded, header.width, header.height, bits, header.interlaceMethod);

  return { width: header.width, height: header.height };
}
