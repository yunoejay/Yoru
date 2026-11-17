/**
 * ESLint flat config.
 *
 * Why this file exists: the project has eslint@9 + eslint-config-next as dev
 * dependencies but had no config at all, which makes ESLint 9 exit with a fatal
 * "couldn't find an eslint.config.(js|mjs|cjs) file" error. The VS Code ESLint
 * extension surfaces that as an error on every .ts/.tsx file.
 *
 * eslint-config-next@16 already exports real flat-config arrays, so the
 * FlatCompat shim that create-next-app still scaffolds is not needed here.
 *
 * Lint runs are explicit (`npm run lint`): Next.js removed the `next lint`
 * command in v16, so it no longer happens as part of `next build`.
 */

import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: [
      '.next/**',
      'next-env.d.ts',
      'node_modules/**',
      'prisma/migrations/**',
      'tsconfig.tsbuildinfo',
    ],
  },

  ...coreWebVitals,
  ...typescript,

  {
    rules: {
      /**
       * `next/image` is deliberately NOT used for chapter pages.
       *
       * Reader/cover images are same-origin `/api/image?src=<base64url>` URLs
       * whose payload is a different short-lived upstream byte-stream roughly
       * every 10 minutes (see CACHE_TTL_MS in
       * app/api/chapter/[chapterId]/pages/route.ts, and lib/image-proxy.ts for
       * why hotlinking is impossible: MangaDex blocks foreign origins outright).
       *
       * Routing that through the image optimizer would key its cache on a
       * query-string URL and can serve a previous chapter's pixels, and
       * `next.config.js` only allowlists placehold.co in `remotePatterns`, so
       * every real page would need `unoptimized` anyway. No benefit, new bugs.
       *
       * Every remaining <img> carries real alt text.
       */
      '@next/next/no-img-element': 'off',

      /**
       * BASELINED PRE-EXISTING DEBT, not a suppression of new work.
       *
       * components/ThemeToggle.tsx sets `mounted`/`dark` synchronously inside a
       * useEffect as a hydration guard. The rule is right that this is an anti
       * pattern, but fixing it properly means collapsing the duplicate theme
       * source of truth shared with components/ThemeProvider.tsx, which is a
       * behaviour change outside the scope of adding a linter.
       *
       * Kept as a warning so it stays visible in the editor and in `npm run
       * lint` output rather than being silently switched off. Recommended fix:
       * drive both `mounted` and `dark` from useSyncExternalStore over
       * document.documentElement's class attribute.
       */
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default config;
