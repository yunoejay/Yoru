/**
 * WCAG contrast audit for the shipped palettes.
 *
 * Run `npm run check:themes`. It checks the pairs the UI actually renders:
 * body text and muted text on the page canvas and on raised surfaces, plus the
 * `text-white` that sits on the brand gradient.
 *
 * Thresholds: 4.5:1 for body copy, 3:1 for muted/secondary copy and for the
 * semibold label on brand-coloured buttons (WCAG's large-text / UI-component
 * threshold). Anything below fails the command, so a new palette cannot ship
 * unreadable.
 */
import { THEMES, type Theme } from '../lib/themes';

type RGB = [number, number, number];

interface ContrastCheck {
  label: string;
  foreground: string;
  background: string;
  minimum: number;
}

function toRgb(hex: string): RGB {
  const raw = hex.trim().replace(/^#/, '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((char) => char + char)
          .join('')
      : raw;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Invalid hex colour: ${hex}`);

  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** sRGB channel → linear light, per WCAG 2.1. */
function linear(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function ratio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const [lighter, darker] = a >= b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

function checksFor(theme: Theme): ContrastCheck[] {
  const { palette } = theme;
  const dark = theme.mode === 'dark';

  const canvas = dark ? palette.bg : palette.white;
  const surface = dark ? palette.bgAlt : palette.slate[50];
  const body = dark ? palette.slate[100] : palette.slate[900];
  const muted = dark ? palette.slate[400] : palette.slate[500];

  return [
    { label: 'body text on canvas', foreground: body, background: canvas, minimum: 4.5 },
    { label: 'body text on surface', foreground: body, background: surface, minimum: 4.5 },
    { label: 'muted text on canvas', foreground: muted, background: canvas, minimum: 3 },
    { label: 'muted text on surface', foreground: muted, background: surface, minimum: 3 },
    { label: 'button label on brand', foreground: palette.white, background: palette.brand, minimum: 3 },
    {
      label: 'button label on brand accent',
      foreground: palette.white,
      background: palette.brandAccent,
      minimum: 3,
    },
  ];
}

let failed = false;

for (const theme of THEMES) {
  console.log(`\n${theme.name} (${theme.mode})`);

  for (const check of checksFor(theme)) {
    const value = ratio(check.foreground, check.background);
    const ok = value >= check.minimum;
    if (!ok) failed = true;

    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'} ${value.toFixed(2).padStart(5)}:1 (min ${check.minimum}) — ${check.label}`,
    );
  }
}

if (failed) {
  console.error('\nThemes: contrast check failed.');
  process.exit(1);
}

console.log(`\nThemes: ${THEMES.length} palettes pass the contrast audit.`);
