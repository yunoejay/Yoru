/**
 * Raster favicon set generated from the single source of truth, public/icon.svg
 * (the book + crescent moon mark used everywhere else in the UI).
 *
 * Run with:  npm run icons:build
 *
 * Why this exists: browsers cache favicons per-origin and only replace them when
 * the SAME URL returns new bytes. Safari and older engines ignore SVG favicons
 * (the `<link rel="icon" type="image/svg+xml">` in app/layout.tsx) and fall back
 * to requesting /favicon.ico — which used to 404, so the stale favicon from the
 * app's previous name kept showing in the tab forever. Writing a real multi-size
 * /favicon.ico at that exact URL is what overwrites it.
 *
 * Outputs (all committed):
 *   public/favicon.ico          16/32/48 in one container (PNG-encoded entries)
 *   public/apple-touch-icon.png 180x180 (iOS home screen)
 *   public/icon-192.png         PWA manifest
 *   public/icon-512.png         PWA manifest
 *
 * Rasteriser: `sharp` (librsvg), which renders the SVG at the exact target size
 * on a fully transparent background. Quick Look was tried first and rejected:
 * `qlmanage -t` bakes an opaque white background into the thumbnail (the script's
 * self-check caught the corner pixel at alpha=255).
 *
 * The ICO container is written by hand (no dependency): ICONDIR + one 16-byte
 * ICONDIRENTRY per image + the raw PNG payloads. PNG-in-ICO is understood by
 * every browser that matters and Windows Vista+; BMP entries are only needed
 * for Windows XP.
 *
 * The script self-checks: after rendering it inflates the first scanline of one
 * PNG and asserts the top-left pixel is fully transparent, so a rasteriser
 * background change fails loudly instead of shipping a broken favicon.
 *
 * When the mark itself changes (e.g. the Rogue -> Yoru rebrand), also bump the
 * `?v=` suffix on the icon URLs in app/layout.tsx — browsers key their favicon
 * cache by exact URL, so a version bump is what forces a re-fetch.
 */
import { inflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// tsx may run this file through its CJS loader, where `import.meta.dirname` is
// absent, so derive the directory from the (shimmed) module URL instead.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SVG = path.join(ROOT, 'public', 'icon.svg');
const OUT = path.join(ROOT, 'public');

/** Favicon raster sizes to produce. */
const SIZES = [16, 32, 48, 180, 192, 512];
/** Sizes packed into the multi-image favicon.ico. */
const ICO_SIZES = [16, 32, 48];

function fail(message: string): never {
  console.error(`generate-icons: ${message}`);
  process.exit(1);
}

/** Renders the SVG at `size`px, natively (not upscaled), on transparency. */
async function renderPng(size: number): Promise<Buffer> {
  // The SVG's viewBox is 64x64 at an implicit 72dpi, so raise the render
  // density proportionally instead of letting sharp upscale a 64px raster.
  const png = await sharp(SVG, { density: (72 * size) / 64 })
    .resize(size, size)
    .png()
    .toBuffer();
  const meta = await sharp(png).metadata();
  if (meta.width !== size || meta.height !== size) {
    fail(`render ${size}: got ${meta.width}x${meta.height}`);
  }
  return png;
}

/**
 * Asserts the PNG is a non-interlaced 8-bit RGBA image of the expected size
 * whose top-left pixel is fully transparent. Row 0 needs no unfiltering: with
 * an all-zero previous row every PNG filter predicts 0, so the inflated bytes
 * of the first scanline are the pixel values directly.
 */
function assertTransparentPng(png: Buffer, size: number, label: string): void {
  if (png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size) {
    fail(`${label}: expected ${size}x${size}, got ${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`);
  }
  const colorType = png.readUInt8(25);
  const interlace = png.readUInt8(28);
  if (colorType !== 6 || interlace !== 0) {
    fail(`${label}: expected non-interlaced RGBA PNG, got colorType=${colorType} interlace=${interlace}`);
  }
  const idat = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') idat.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  if (idat.length === 0) fail(`${label}: no IDAT chunk found`);
  const row = inflateSync(Buffer.concat(idat));
  const alpha = row[1 + 3]; // filter byte, then R G B A of the first pixel
  if (alpha !== 0) {
    fail(`${label}: top-left pixel alpha=${alpha}, expected 0 (Quick Look drew a background?)`);
  }
}

/** Packs PNG payloads into a multi-size .ico container. */
function buildIco(pngs: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  const entries = Buffer.alloc(16 * pngs.length);
  const payloads: Buffer[] = [];
  let offset = header.length + entries.length;
  pngs.forEach(({ size, png }, index) => {
    const entry = entries.subarray(index * 16, index * 16 + 16);
    entry.writeUInt8(size, 0); // width  (<=255, so no 0-means-256 case here)
    entry.writeUInt8(size, 1); // height
    entry.writeUInt8(0, 2); // palette size
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    payloads.push(png);
  });
  return Buffer.concat([header, entries, ...payloads]);
}

async function main() {
  const rendered = new Map();
  for (const size of SIZES) {
    const png = await renderPng(size);
    assertTransparentPng(png, size, `icon-${size}.png`);
    rendered.set(size, png);
    console.log(`generate-icons: rendered ${size}x${size} OK`);
  }

  writeFileSync(path.join(OUT, 'favicon.ico'), buildIco(ICO_SIZES.map((size) => ({ size, png: rendered.get(size) }))));
  writeFileSync(path.join(OUT, 'apple-touch-icon.png'), rendered.get(180));
  writeFileSync(path.join(OUT, 'icon-192.png'), rendered.get(192));
  writeFileSync(path.join(OUT, 'icon-512.png'), rendered.get(512));
  console.log('generate-icons: wrote public/favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png');
}

main().catch((error) => fail(error?.stack || String(error)));
