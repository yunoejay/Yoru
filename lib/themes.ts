/**
 * Theme registry.
 *
 * Every colour the UI uses comes from one of these palettes: Tailwind's
 * `white`, `black`, `slate-*`, `brand` and `bg` utilities are mapped to CSS
 * custom properties in `tailwind.config.js`, and `scripts/build-themes.ts`
 * writes one `[data-theme="<id>"]` block per theme into
 * `app/themes.generated.css`.
 *
 * That indirection is why the 200+ existing `dark:` variants keep working
 * unchanged: a theme only swaps the palette values, while the `dark` class
 * still decides which side of each `light dark:...` pair applies.
 *
 * Keep this module dependency-free (no React, no Node): the server layout
 * imports it for the pre-paint bootstrap, and the build script imports it to
 * generate the CSS.
 */

export type ThemeMode = 'light' | 'dark';

export const SLATE_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type SlateShade = (typeof SLATE_SHADES)[number];

export interface ThemePalette {
  /** 50 (lightest) → 950 (darkest). Must keep that order in every theme. */
  slate: Record<SlateShade, string>;
  white: string;
  black: string;
  brand: string;
  brandAccent: string;
  /** Page canvas. */
  bg: string;
  /** Raised surface used by `.card-surface` in dark mode. */
  bgAlt: string;
  /** Full CSS box-shadow value for `.card-surface` / `.hero-panel`. */
  shadowCard: string;
  /** rgba() stops for the two body radial glows. */
  glowPrimary: string;
  glowSecondary: string;
  scrollbarTrack: string;
  scrollbarThumb: string;
  scrollbarThumbHover: string;
}

export interface Theme {
  id: string;
  name: string;
  mode: ThemeMode;
  palette: ThemePalette;
}

/** Stored instead of a theme id when the reader follows the OS colour scheme. */
export const SYSTEM_PREFERENCE = 'system';
/** A stored value is either a theme id or `SYSTEM_PREFERENCE`. */
export type ThemePreference = string;

export const DEFAULT_THEME_ID = 'yoru-dark';
export const SYSTEM_DARK_THEME_ID = 'yoru-dark';
export const SYSTEM_LIGHT_THEME_ID = 'yoru-light';

/** Non-httpOnly cookie mirroring the active theme for the pre-paint script. */
export const THEME_COOKIE_NAME = 'yoru_theme';

const slate = (values: readonly string[]): Record<SlateShade, string> =>
  Object.fromEntries(SLATE_SHADES.map((shade, index) => [shade, values[index]])) as Record<
    SlateShade,
    string
  >;

const tailwindSlate = slate([
  '#f8fafc',
  '#f1f5f9',
  '#e2e8f0',
  '#cbd5e1',
  '#94a3b8',
  '#64748b',
  '#475569',
  '#334155',
  '#1e293b',
  '#0f172a',
  '#020617',
]);

const midnightSlate = slate([
  '#f2f6ff',
  '#e3ebfb',
  '#c6d4ec',
  '#9fb2d2',
  '#7488ab',
  '#526383',
  '#394764',
  '#263149',
  '#131b2c',
  '#070c17',
  '#01030a',
]);

const nordSlate = slate([
  '#ECEFF4',
  '#E5E9F0',
  '#D8DEE9',
  '#B6C1D0',
  '#8C9AAF',
  '#74839A',
  '#4C566A',
  '#434C5E',
  '#3B4252',
  '#2E3440',
  '#232831',
]);

const draculaSlate = slate([
  '#F8F8F2',
  '#EDEDF5',
  '#D9DBE8',
  '#B8BDD4',
  '#8E97B8',
  '#6B7499',
  '#555E7D',
  '#44475A',
  '#353746',
  '#282A36',
  '#1B1C25',
]);

const solarizedDarkSlate = slate([
  '#FDF6E3',
  '#EEE8D5',
  '#D8D3C2',
  '#B5B7AC',
  '#93A1A1',
  '#839496',
  '#657B83',
  '#586E75',
  '#1F4B54',
  '#073642',
  '#002B36',
]);

const solarizedLightSlate = slate([
  '#FDF6E3',
  '#F7F0DD',
  '#E9E2CE',
  '#CFC8B4',
  '#8A9490',
  '#5F747C',
  '#52676E',
  '#405A61',
  '#0B4A57',
  '#073642',
  '#002B36',
]);

const tokyoNightSlate = slate([
  '#E3E7FA',
  '#C0CAF5',
  '#A9B4E0',
  '#8E9BCB',
  '#6E7BA8',
  '#5A6588',
  '#454E6E',
  '#343A54',
  '#24283B',
  '#1A1B26',
  '#12131C',
]);

const catppuccinMochaSlate = slate([
  '#CDD6F4',
  '#BAC2DE',
  '#A6ADC8',
  '#7F849C',
  '#6C7086',
  '#585B70',
  '#45475A',
  '#313244',
  '#1E1E2E',
  '#11111B',
  '#0B0B14',
]);

const gruvboxDarkSlate = slate([
  '#FBF1C7',
  '#EBDBB2',
  '#D5C4A1',
  '#BDAE93',
  '#928374',
  '#7C6F64',
  '#665C54',
  '#504945',
  '#3C3836',
  '#282828',
  '#1D2021',
]);

const catppuccinLatteSlate = slate([
  '#F7F8FA',
  '#EFF1F5',
  '#E6E9EF',
  '#CCD0DA',
  '#9CA0B0',
  '#7C7F96',
  '#6C6F85',
  '#5C5F77',
  '#4C4F69',
  '#3B3E56',
  '#2A2C3D',
]);

const oneLightSlate = slate([
  '#F5F5F6',
  '#EDEDEE',
  '#DEDEE0',
  '#C2C3C6',
  '#A0A1A7',
  '#696C77',
  '#5A5D68',
  '#4B4D57',
  '#383A42',
  '#2B2D35',
  '#1F2027',
]);

const rosePineDawnSlate = slate([
  '#FFFCF9',
  '#F2E9E1',
  '#E5DED6',
  '#CFC7BF',
  '#9893A5',
  '#797593',
  '#6A6588',
  '#575279',
  '#4A456B',
  '#3B3759',
  '#2B2845',
]);

/**
 * The shipped palettes. Dark themes first, then light ones; the picker groups
 * by `mode`, so the order inside each group is the display order.
 */
export const THEMES: readonly Theme[] = [
  {
    id: 'yoru-dark',
    name: 'Yoru Dark',
    mode: 'dark',
    palette: {
      slate: tailwindSlate,
      white: '#ffffff',
      black: '#000000',
      brand: '#6366f1',
      brandAccent: '#8b5cf6',
      bg: '#0f1115',
      bgAlt: '#181c22',
      shadowCard: '0 4px 24px -4px rgba(0, 0, 0, 0.4)',
      glowPrimary: 'rgba(99, 102, 241, 0.14)',
      glowSecondary: 'rgba(139, 92, 246, 0.12)',
      scrollbarTrack: '#101317',
      scrollbarThumb: '#2a313b',
      scrollbarThumbHover: '#3b4654',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    mode: 'dark',
    palette: {
      slate: midnightSlate,
      white: '#f2f6ff',
      black: '#000000',
      brand: '#5b7cfa',
      brandAccent: '#8b7cf6',
      bg: '#000000',
      bgAlt: '#0a0f1a',
      shadowCard: '0 4px 24px -4px rgba(0, 0, 0, 0.6)',
      glowPrimary: 'rgba(91, 124, 250, 0.16)',
      glowSecondary: 'rgba(139, 124, 246, 0.1)',
      scrollbarTrack: '#05070c',
      scrollbarThumb: '#202a3a',
      scrollbarThumbHover: '#2f3c52',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    mode: 'dark',
    palette: {
      slate: nordSlate,
      white: '#ECEFF4',
      black: '#000000',
      brand: '#46618C',
      brandAccent: '#5E81AC',
      bg: '#2E3440',
      bgAlt: '#3B4252',
      shadowCard: '0 4px 24px -4px rgba(0, 0, 0, 0.45)',
      glowPrimary: 'rgba(136, 192, 208, 0.12)',
      glowSecondary: 'rgba(94, 129, 172, 0.1)',
      scrollbarTrack: '#232831',
      scrollbarThumb: '#4C566A',
      scrollbarThumbHover: '#5E6A80',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    mode: 'dark',
    palette: {
      slate: draculaSlate,
      white: '#F8F8F2',
      black: '#000000',
      brand: '#7A57D1',
      brandAccent: '#8B6BE0',
      bg: '#282A36',
      bgAlt: '#343746',
      shadowCard: '0 4px 24px -4px rgba(0, 0, 0, 0.45)',
      glowPrimary: 'rgba(122, 87, 209, 0.16)',
      glowSecondary: 'rgba(255, 121, 198, 0.08)',
      scrollbarTrack: '#1B1C25',
      scrollbarThumb: '#44475A',
      scrollbarThumbHover: '#555E7D',
    },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    mode: 'dark',
    palette: {
      slate: solarizedDarkSlate,
      white: '#FDF6E3',
      black: '#000000',
      brand: '#1A6FAF',
      brandAccent: '#268BD2',
      bg: '#002B36',
      bgAlt: '#073642',
      shadowCard: '0 4px 24px -4px rgba(0, 0, 0, 0.35)',
      glowPrimary: 'rgba(38, 139, 210, 0.12)',
      glowSecondary: 'rgba(42, 161, 152, 0.08)',
      scrollbarTrack: '#001F27',
      scrollbarThumb: '#3A555D',
      scrollbarThumbHover: '#4A6971',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    mode: 'dark',
    palette: {
      slate: tokyoNightSlate,
      white: '#C0CAF5',
      black: '#000000',
      brand: '#4463B0',
      brandAccent: '#4A6BB8',
      bg: '#1A1B26',
      bgAlt: '#24283B',
      shadowCard: '0 4px 24px -4px rgba(0, 0, 0, 0.45)',
      glowPrimary: 'rgba(122, 162, 247, 0.16)',
      glowSecondary: 'rgba(187, 154, 247, 0.1)',
      scrollbarTrack: '#12131C',
      scrollbarThumb: '#3B4261',
      scrollbarThumbHover: '#4A527A',
    },
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    mode: 'dark',
    palette: {
      slate: catppuccinMochaSlate,
      white: '#CDD6F4',
      black: '#000000',
      brand: '#6F4FB0',
      brandAccent: '#7C5CBF',
      bg: '#1E1E2E',
      bgAlt: '#181825',
      shadowCard: '0 4px 24px -4px rgba(0, 0, 0, 0.45)',
      glowPrimary: 'rgba(203, 166, 247, 0.14)',
      glowSecondary: 'rgba(137, 220, 235, 0.08)',
      scrollbarTrack: '#11111B',
      scrollbarThumb: '#45475A',
      scrollbarThumbHover: '#585B70',
    },
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    mode: 'dark',
    palette: {
      slate: gruvboxDarkSlate,
      white: '#FBF1C7',
      black: '#000000',
      brand: '#C2570E',
      brandAccent: '#D65D0E',
      bg: '#282828',
      bgAlt: '#32302F',
      shadowCard: '0 4px 24px -4px rgba(0, 0, 0, 0.5)',
      glowPrimary: 'rgba(214, 93, 14, 0.12)',
      glowSecondary: 'rgba(215, 153, 33, 0.08)',
      scrollbarTrack: '#1D2021',
      scrollbarThumb: '#504945',
      scrollbarThumbHover: '#665C54',
    },
  },
  {
    id: 'yoru-light',
    name: 'Yoru Light',
    mode: 'light',
    palette: {
      slate: tailwindSlate,
      white: '#ffffff',
      black: '#000000',
      brand: '#6366f1',
      brandAccent: '#8b5cf6',
      bg: '#f8fafc',
      bgAlt: '#f1f5f9',
      shadowCard: '0 4px 24px -4px rgba(15, 23, 42, 0.12)',
      glowPrimary: 'rgba(99, 102, 241, 0.08)',
      glowSecondary: 'rgba(139, 92, 246, 0.06)',
      scrollbarTrack: '#f5f5f5',
      scrollbarThumb: '#d0d0d0',
      scrollbarThumbHover: '#b0b0b0',
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    mode: 'light',
    palette: {
      slate: solarizedLightSlate,
      white: '#FDF6E3',
      black: '#000000',
      brand: '#1A6FAF',
      brandAccent: '#268BD2',
      bg: '#FDF6E3',
      bgAlt: '#EEE8D5',
      shadowCard: '0 4px 24px -4px rgba(0, 43, 54, 0.12)',
      glowPrimary: 'rgba(38, 139, 210, 0.08)',
      glowSecondary: 'rgba(42, 161, 152, 0.06)',
      scrollbarTrack: '#EEE8D5',
      scrollbarThumb: '#CFC8B4',
      scrollbarThumbHover: '#B3AC98',
    },
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    mode: 'light',
    palette: {
      slate: catppuccinLatteSlate,
      white: '#EFF1F5',
      black: '#000000',
      brand: '#8839EF',
      brandAccent: '#9A4FF2',
      bg: '#EFF1F5',
      bgAlt: '#E6E9EF',
      shadowCard: '0 4px 24px -4px rgba(76, 79, 105, 0.14)',
      glowPrimary: 'rgba(136, 57, 239, 0.08)',
      glowSecondary: 'rgba(30, 102, 245, 0.06)',
      scrollbarTrack: '#E6E9EF',
      scrollbarThumb: '#CCD0DA',
      scrollbarThumbHover: '#BCC0CC',
    },
  },
  {
    id: 'one-light',
    name: 'One Light',
    mode: 'light',
    palette: {
      slate: oneLightSlate,
      white: '#FAFAFA',
      black: '#000000',
      brand: '#4078F2',
      brandAccent: '#5285F3',
      bg: '#FAFAFA',
      bgAlt: '#F0F0F1',
      shadowCard: '0 4px 24px -4px rgba(56, 58, 66, 0.12)',
      glowPrimary: 'rgba(64, 120, 242, 0.08)',
      glowSecondary: 'rgba(166, 38, 164, 0.05)',
      scrollbarTrack: '#EDEDEE',
      scrollbarThumb: '#DEDEE0',
      scrollbarThumbHover: '#C2C3C6',
    },
  },
  {
    id: 'rose-pine-dawn',
    name: 'Rosé Pine Dawn',
    mode: 'light',
    palette: {
      slate: rosePineDawnSlate,
      white: '#FAF4ED',
      black: '#000000',
      brand: '#907AA9',
      brandAccent: '#9A82B0',
      bg: '#FAF4ED',
      bgAlt: '#F2E9E1',
      shadowCard: '0 4px 24px -4px rgba(87, 82, 121, 0.14)',
      glowPrimary: 'rgba(144, 122, 169, 0.1)',
      glowSecondary: 'rgba(235, 155, 196, 0.06)',
      scrollbarTrack: '#F2E9E1',
      scrollbarThumb: '#CFC7BF',
      scrollbarThumbHover: '#B8B0A8',
    },
  },
];

const themeIndex = new Map(THEMES.map((theme) => [theme.id, theme]));

export const THEME_IDS: readonly string[] = THEMES.map((theme) => theme.id);

export const DEFAULT_THEME: Theme = themeIndex.get(DEFAULT_THEME_ID) ?? THEMES[0];

export function getTheme(id: string): Theme | undefined {
  return themeIndex.get(id);
}

export function isThemeId(value: string): boolean {
  return themeIndex.has(value);
}

export function isThemePreference(value: string): boolean {
  return value === SYSTEM_PREFERENCE || isThemeId(value);
}

/** Turn a stored preference (theme id or `system`) into the palette to apply. */
export function resolveThemePreference(preference: string, prefersDark: boolean): Theme {
  if (preference === SYSTEM_PREFERENCE) {
    const id = prefersDark ? SYSTEM_DARK_THEME_ID : SYSTEM_LIGHT_THEME_ID;
    return themeIndex.get(id) ?? DEFAULT_THEME;
  }
  return themeIndex.get(preference) ?? DEFAULT_THEME;
}

/** Three colours used by the picker's preview swatches. */
export function themeSwatches(theme: Theme): [string, string, string] {
  return [theme.palette.bg, theme.palette.bgAlt, theme.palette.brand];
}

const MODE_BY_ID = Object.fromEntries(THEMES.map((theme) => [theme.id, theme.mode]));
const CANVAS_BY_ID = Object.fromEntries(THEMES.map((theme) => [theme.id, theme.palette.bg]));

/**
 * Blocking script inlined into `<head>` by `app/layout.tsx`.
 *
 * It runs before the first paint, so a reader whose saved theme is, say,
 * Solarized Light never sees Yoru Dark flash first. It reads the non-httpOnly
 * theme cookie (the only signal available before `/api/auth/me` resolves) and
 * falls back to the default theme for guests or stale cookies.
 *
 * It lives here so the theme ids, modes and canvases stay in one place.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{
var modes=${JSON.stringify(MODE_BY_ID)};
var canvases=${JSON.stringify(CANVAS_BY_ID)};
var ids=Object.keys(modes);
var cookieName=${JSON.stringify(THEME_COOKIE_NAME)};
var match=document.cookie.match(new RegExp('(?:^|; )'+cookieName+'=([^;]*)'));
var stored=match?decodeURIComponent(match[1]):null;
var id=stored===${JSON.stringify(SYSTEM_PREFERENCE)}
  ?(window.matchMedia('(prefers-color-scheme: dark)').matches
    ?${JSON.stringify(SYSTEM_DARK_THEME_ID)}
    :${JSON.stringify(SYSTEM_LIGHT_THEME_ID)})
  :stored;
if(id===null||ids.indexOf(id)<0)id=${JSON.stringify(DEFAULT_THEME_ID)};
var root=document.documentElement;
root.setAttribute('data-theme',id);
root.classList.toggle('dark',modes[id]==='dark');
root.style.colorScheme=modes[id];
var meta=document.querySelector('meta[name="theme-color"]');
if(meta&&canvases[id])meta.setAttribute('content',canvases[id]);
}catch(e){}})();`;
