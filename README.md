# Yoru

A manhwa/manhua/manga/light-novel style reader. Visual inspiration only - no code or
assets copied from atsu.moe.

Real content is pulled through a pluggable **source adapter layer**. **Atsumaru**
(`lib/sources/atsumaru.ts`) is the active source: atsu.moe is a reader built on
the public MangaBaka JSON API, and its pages are served from `cdn.atsu.moe`
rather than the slow, rate-limited MangaDex@Home nodes - so it gives the library
both speed and catalog breadth, including every scanlation group that uploaded a
title. It ships enabled by default (`ATSUMARU_ENABLED=true`). The **MangaDex**
API adapter ships disabled by default (`MANGADEX_ENABLED=false`) because its
pages are proxied through rate-limited MangaDex@Home nodes and load slower; set
`MANGADEX_ENABLED=true` to re-enable it.

## Features
- Next.js 16 App Router
- **Thirteen VS Code–style themes**: Yoru Dark (default), Midnight, Nord,
  Dracula, Solarized Dark, Tokyo Night, Catppuccin Mocha and Gruvbox Dark, plus
  Yoru Light, Solarized Light, Catppuccin Latte, One Light and Rosé Pine Dawn.
  The picker sits in the avatar menu — hover/focus/click opens a flyout on
  desktop and expands inline on phones — and the choice is saved per reader and
  applied before first paint, so there is no flash. Guests always get Yoru Dark.
- Multi-source content layer (`lib/sources/`) behind one `ScanlationSource` interface
- **Correct format labels**: manhwa (Korean), manhua (Chinese) and manga
  (Japanese) are tagged from the source's own `type` instead of folding every
  title into "manga"; the series page shows the format and its origin
- Per-chapter **scanlator attribution**, so the same title can carry chapters from
  several different groups and the UI can credit who made which one
- **Automatic scanlator reading order**: the linear order behind "Continue
  reading", the reader's Prev/Next and read progress follows the group that
  covers the most chapters and switches to whichever group is ahead when that one
  runs out, so the reader never visits the same chapter number twice.
- Official/licensed chapters surfaced correctly (MangaDex marks publisher groups
  `official: true`, and link-only chapters deep-link to the publisher)
- **Per-scanlation browsing**: Atsumaru is an aggregator, so one listing carries
  every group that uploaded a title (Tower of God: Webtoon + Alpha, 652 chapter
  rows each). The series page has a tab per group (`?scanlator=<group>`), so the
  scanlations stay distinct instead of one silently hiding the rest.
- **Grouped chapter cards**: the series page lists one card per chapter number
  (`CH. 218`) with a row for every scanlator that uploaded it — `Chapter 218 |
  Alpha`, `Chapter 218 | Lagoon`, … — each with its own relative upload date and
  read checkbox (the tick is shared by all uploads of that number). The list opens
  as two blocks: the newest 10 chapter numbers at the top (latest release first)
  and the oldest 10 at the bottom (so chapter 1 is always one scroll away), with a
  full-width **Show all chapters** bar between them that fills in the middle.
- **Live search suggestions**: typing in the navbar search box asks
  `/api/search` after a short debounce and lists matching series with cover,
  author and chapter count. Enter opens the highlighted title; plain Enter still
  submits to `/library?q=`, where the full filters and sort live. Exact and
  prefix title matches rank above author/genre matches, and a database outage
  falls back to the bundled demo catalog like the rest of the content layer.
- **Read tracking** (`ChapterRead`): a checkbox on every chapter, a progress bar
  and a "Continue Ch. N" hero button. Progress is keyed on the chapter *number*,
  so it survives switching scanlators; signed-in readers sync through their
  account, guests are saved in this browser's localStorage. The reader's
  floating settings panel has the same "mark read" checkbox.
- **Personal bookmarks**: every series carries a reading status — Reading,
  Rereading, Plan to read, Completed, On hold or Dropped — picked from the menu
  on its series page. Opening **any** chapter files the series as Reading on its
  own (a deliberate Rereading stays put), so a title you already read on another
  site shelves itself the moment you open chapter 1 or a random chapter. The
  navbar's **Bookmarks** link (next to the avatar)
  filters by status with per-status counts and has its own search box (title,
  author, genre, synopsis or scanlator) plus a sort control — Recently changed,
  Recently added, Oldest added or Title A–Z — so a large shelf stays navigable.
  Each cover keeps the same menu
  so a title can be re-filed or removed without leaving the page. Entries reuse
  the `bookmarks` table (with a `status` column and `updatedAt` ordering); the
  canonical list lives in `lib/library-status.ts`.
- **Personal home rails**: the home page's **Updates for you** rail mixes the
  newest chapter activity from your bookmarks, but leaves out anything you
  filed as **Completed** and anything the source itself lists as completed —
  a finished title has no new chapters to show. The **Bookmarks** rail and
  /my-library still list everything you filed, whatever its status.
- **Profile pages**: the navbar swaps the Login link for an avatar menu once a
  reader is signed in. The account page has an editable banner and profile
  picture, display name, handle, bio, location and website, plus reading stats
  (chapters read, series tracked, series in bookmarks). Image uploads are validated by
  magic bytes and stored under `public/uploads/profiles/`; see the deployment
  note below before running on a serverless host.
- Server-side **image proxy** - required because MangaDex blocks hotlinking
- Prisma + Postgres for series/chapter metadata (page *URLs are never stored*)
- **Vertical webtoon scroll reader**: the whole chapter stacks in one centered
  column on a full-black immersive canvas — the site header and footer step out
  of the way while a chapter is open. Prev/Next (and Left/Right arrows) move
  between *chapters*; Up/Down/Space still scroll. The floating control rail on
  the **left** opens a settings panel with Prev/Next, page/progress, auto-scroll,
  mark read, low data and fullscreen. Reaching the bottom of a chapter **no
  longer auto-advances** - the panel's Prev/Next are the only forward path, so
  the strip never yanks you into a chapter you did not choose. The
  **"Auto-scroll" toggle** scrolls down one page every 5 seconds and stops at
  the last page (it never flips chapters, and a manual scroll re-times it so it
  never fights you). Pages lazy-load, because each image is
  proxied at ~4 req/s upstream, and the next chapter's page list is prefetched so
  flipping chapters is instant. A "low data" switch loads MangaDex's compressed
  variant (measured 144 KB vs 1.66 MB for the same page)
- Theme picker in the avatar menu (per-reader, applied before the first paint)
- Email-verified accounts with username + password login, password reset, profile editing
- Bundled demo data as a graceful fallback when the database is not configured,
  so the site never renders blank

## Getting started

```bash
npm install
npx vercel link    # log in + choose the yoru project (one time)
npm run env:pull   # pulls the shared Development env (see below)
npm run dev
```

Without Vercel access, copy the template instead and fill in a local
`DATABASE_URL`:

```bash
cp .env.example .env.local
```

Open http://localhost:3000.

### Environment variables for developers

Real values never live in git. `.env.local` is gitignored; `.env.example` only
documents the keys. The shared **development** values live in the Vercel
project's Development environment and are pulled with the Vercel CLI.

**One-time project setup (owner):**

1. Create a **separate** Supabase project (or Neon database) for development.
   Keep production on its own project.
2. In Vercel → Project → Settings → Environment Variables:

   | Key | Development | Production / Preview |
   |---|---|---|
   | `DATABASE_URL` | **Config** | **Secret** |
   | `AUTH_JWT_SECRET` | **Config** (dev-only value) | **Secret** |
   | `APP_URL` | **Config** | **Config** |
   | `SOURCE_USER_AGENT`, `SOURCE_RATE_PER_SEC`, `SOURCE_BURST`, `MANGADEX_ENABLED`, `ATSUMARU_ENABLED` | **Config** | **Config** |
   | `SMTP_*` (optional) | omit | **Secret** |

   Development defaults to **Config** and Production/Preview to **Secret**. Do
   **not** mark the Development values Secret: `vercel env pull` cannot read
   Secret values back and writes a placeholder instead.
3. Invite the other developer to the Vercel project (Settings → Members). They
   never need the raw keys.

**Developer onboarding:**

```bash
npm install
npx vercel login
npx vercel link          # choose the yoru project
npm run env:pull         # writes .env.local from the Development environment
npm run check:env        # confirms the required keys are present
npx prisma migrate dev
npm run dev
```

- `vercel env pull` merges into an existing `.env.local`: keys you added locally
  that are not in Vercel are kept.
- Production/Preview Secrets are write-only. They are injected into deployments
  and never pulled to a laptop.
- Supabase API keys (anon / publishable / service-role) are not used: Prisma
  connects straight to Postgres, so `DATABASE_URL` is the only Supabase value
  the app reads.
- **No Vercel access?** Use local Postgres (Database setup → Option A), copy
  `.env.example` to `.env.local`, and set `DATABASE_URL`. External contributors
  should never receive production credentials.
- **Leaked or rotated key?** Rotate it at the provider first (Supabase, Vercel,
  SMTP), update the Vercel value, then re-run `npm run env:pull`. If it was ever
  committed, removing it from the latest commit is not enough: purge the git
  history, force-push, and assume every existing clone still has the old value.

### Demo / test account

The local development database ships with a pre-verified account for trying the
signed-in UI (avatar menu, personal bookmarks, reading stats) without registering:

| Field | Value |
|---|---|
| Username | `demo` |
| Password | `Demo1234!` |
| Email | `demo@yoru.local` |

You can log in with **either the username (`demo`) or the email address**; the
handle is matched case-insensitively. Do not confuse the handle with the display
name (`demoreader`), which is only a label on the profile. This row lives in the
local Postgres database only — on a fresh database, create an account through the
Register link on the login page instead.

## Themes

The app ships thirteen palettes and lets a signed-in reader pick one from the
avatar menu (**Theme** row). Guests always get Yoru Dark.

| Theme | Mode | Canvas | Accent |
|---|---|---|---|
| Yoru Dark (default) | dark | `#0f1115` | `#6366f1` → `#8b5cf6` |
| Midnight | dark | `#000000` | `#5b7cfa` → `#8b7cf6` |
| Nord | dark | `#2E3440` | `#46618C` → `#5E81AC` |
| Dracula | dark | `#282A36` | `#7A57D1` → `#8B6BE0` |
| Solarized Dark | dark | `#002B36` | `#1A6FAF` → `#268BD2` |
| Tokyo Night | dark | `#1A1B26` | `#4463B0` → `#4A6BB8` |
| Catppuccin Mocha | dark | `#1E1E2E` | `#6F4FB0` → `#7C5CBF` |
| Gruvbox Dark | dark | `#282828` | `#C2570E` → `#D65D0E` |
| Yoru Light | light | `#ffffff` | `#6366f1` → `#8b5cf6` |
| Solarized Light | light | `#FDF6E3` | `#1A6FAF` → `#268BD2` |
| Catppuccin Latte | light | `#EFF1F5` | `#8839EF` → `#9A4FF2` |
| One Light | light | `#FAFAFA` | `#4078F2` → `#5285F3` |
| Rosé Pine Dawn | light | `#FAF4ED` | `#907AA9` → `#9A82B0` |

### How the theming works

1. **`lib/themes.ts`** is the single source of truth: each theme is one object
   with an 11-step `slate` ramp (50 → 950), `white`/`black`, `brand`/`brand-accent`,
   canvas + raised surface, card shadow, body-glow stops and scrollbar colours.
2. **`scripts/build-themes.ts`** turns those values into CSS custom properties in
   **`app/themes.generated.css`** (`[data-theme="nord"] { --slate-950: 35 40 49; … }`).
   `npm run themes:build` regenerates it; `predev`/`prebuild` do it automatically
   and `npm run themes:check` fails when the committed CSS is stale.
3. **`tailwind.config.js`** points `white`, `black`, `slate-*`, `brand` and `bg`
   at those variables, with `rgb(var(--token) / <alpha-value>)` so opacity
   modifiers (`bg-white/10`, `bg-slate-950/70`) still work. That is why the
   several hundred existing `dark:` utilities repaint per theme without a single
   component change — the `dark` class (toggled per theme mode) still decides
   which side of each pair applies.
4. **`lib/theme-store.ts`** owns persistence: `localStorage` key
   `yoru:theme:<userId>` (per reader), a non-httpOnly `yoru_theme` cookie hint
   for the pre-paint script, cross-tab `storage` sync, and the OS
   `prefers-color-scheme` listener used by **Follow system**.
5. **`ThemeProvider`** + the inline `THEME_BOOTSTRAP_SCRIPT` in `app/layout.tsx`
   apply the theme before first paint. Guests and stale cookies fall back to
   Yoru Dark.

### Adding a theme

1. Add one object to `THEMES` in `lib/themes.ts` (keep the ramp ordered
   light → dark; `slate-950` is also used as the dark overlay on cover art).
2. `npm run themes:build` and `npm run check:themes` (WCAG audit of body text,
   muted text and button labels — 4.5:1 / 3:1 thresholds).
3. Check it in the browser: avatar menu → Theme → hover the row, then compare
   the home, series, chapter list and reader pages in both desktop and phone
   widths.

## Loading real content

"Scans from other scanlators" needs **no new code** for groups that publish to
MangaDex - MangaDex *is* the aggregator, and each chapter carries the group that
made it. Find the groups, then import them:

```bash
# Explore only - no database needed
npm run import:mangadex -- --find-group "Astra Scans"    # locked? official? how many chapters?
npm run import:mangadex -- --list-groups <mangaUuid>     # which scanlators cover this title?

# Import into Postgres
npm run import:mangadex -- --id <mangaUuid> --db --limit 25   # smoke test
npm run import:mangadex -- --id <mangaUuid> --db              # full import
npm run import:mangadex -- --id <mangaUuid> --db --groups "Astra Scans"
npm run import:mangadex -- --id <mangaUuid> --db --incremental
```

Pass `--id` rather than a bare title: the CLI takes search result **#1** with no
prompt, and fuzzy English lookups often rank an unrelated title first (verified -
`"The Beginning After The End"` returns an unrelated roman as #1).

### Giving an imported series every one of its scanlators

A series imported from a single group is single-scanlator by nature. Atsumaru is
an *aggregator*, so one Atsumaru listing already carries **every** group that
uploaded the same title: Solo Leveling comes back as Asura + Alpha + Dusk +
Flame, 802 chapter rows across 201 numbers. Attaching that to a series you
already have is one command, and no scanlator switching is left to do afterwards:

```bash
npm run add:scanlators                      # dry run - series with no Atsumaru listing
npm run add:scanlators -- --apply           # write it
npm run add:scanlators -- --series "Nano Machine" --apply
npm run add:scanlators -- --map "return-of-the-mount-hua-sect=1lXE8" --apply
npm run scanlators                          # what each series ended up with
```

It dry-runs by default because matching two catalogs on title text is where bad
data comes from. MangaBaka stores a manhwa and the light novel behind it as
separate documents with nearly the same name (`Return of The Mount Hua Sect` is a
1,394-"chapter" Novel there; the manhwa is 179), and scanlators rename series
freely: *Return of the Mount Hua Sect* is MangaBaka's *Return of the Blossoming
Blade*, *Swordmaster's Youngest Son* is *The Swordmaster's Son*, *The Regressed
Mercenary's Machinations* is *The Regressed Mercenary Has a Plan*. So only
`medium:=Comic` entries are eligible, the score blends title similarity with how
close the chapter counts are, and anything under the bar is printed with a
ready-to-run `--map` line rather than imported. Before trusting a `--map`, check
the synopsis/author and the scanlator list the script prints - if the group you
already imported from appears in it, the two titles are the same work.

The listing is attached to the **same** `Series` row. By default
`overwriteSeriesMeta: false` keeps the series' existing title, cover, synopsis and
tags - the Atsumaru adapter tags everything `manga, aggregator`, which would
otherwise leak into a manhwa's genre list. `buildReadingOrder()` in
`lib/content.ts` then collapses the duplicate chapter numbers into one linear
list that follows a single scanlator per run, so the series page still lists each
chapter once and "Next" moves 2 -> 3 instead of into a duplicate. Which group that
linear list follows is the **most completely covered** one, so adding a fuller
scan can quietly take over a series; `npm run scanlators` shows the coverage per
group and the winner.

If a series was imported through another source and you want Atsumaru's metadata
as well (cover, title, synopsis, tags), run
`npm run migrate:atsumaru -- --apply`. It re-syncs each series from its Atsumaru
listing with `overwriteSeriesMeta: true` and then removes the other source's
rows; without `--apply` it only prints the plan.


The npm script runs `tsx --env-file=.env.local` deliberately. Plain
`npx tsx scripts/...` does **not** load `.env.local` (there is no `dotenv`
dependency), so any `--db` command fails with a missing `DATABASE_URL`.

Two filter caveats in the current code:

- `--limit` truncates the feed **before** the `--groups` filter (`lib/sources/mangadex.ts`
  breaks pagination on raw collected count), so `--groups X --limit 25` can
  quietly under-import on long titles. Omit `--limit` when filtering by group.
- `--groups` does not produce a per-group listing: `SeriesListing` is unique on
  `(sourceId, externalId)`, so chapters from several groups land in one listing
  and duplicate chapter numbers from different groups all render in the list.

There is intentionally **no `--write` flag any more**: the old importer pasted
MangaDex page URLs into `lib/data.ts`, and those URLs expire in ~15 minutes.
Chapters are stored by identity and their pages are resolved at read time via
`/api/chapter/[chapterId]/pages`.

## Database setup

Real content lives in Postgres. If the database is unreachable the site **still
renders**, but only bundled demo data: `lib/content.ts` catches read failures,
logs the reason once, and falls back. So "every cover is a placeholder and the
scanlator chip says *Yoru demo data*" means the database is unreachable - not
that the import failed.

### Option A: local Postgres (recommended for development)

```bash
brew install postgresql@16
brew services start postgresql@16
/opt/homebrew/opt/postgresql@16/bin/createdb -h localhost -U "$USER" yoru
```

Then in `.env.local` (Homebrew Postgres uses trust auth locally, so no password):

```
DATABASE_URL=postgresql://YOUR_MACOS_USERNAME@localhost:5432/yoru?schema=public
```

### Option B: hosted (Supabase / Neon)

Copy the connection URI from the provider and keep `?schema=public`; use the
**direct** (port 5432) URI for migrations rather than the pooled one. Note that
free hosted projects commonly **pause after about a week idle**, and because
reads fail soft the symptom is a silent revert to demo data.

### Then, either way

```bash
npx prisma migrate dev --name init
npx prisma generate
```

Use `migrate dev`, **not** `migrate deploy`, on a fresh database. `User`,
`VerificationCode` and `PasswordResetToken` are declared in
`prisma/schema.prisma` but had no migration until
`prisma/migrations/20260911005726_init_auth_tables/` was generated, so
`migrate deploy` alone yields a working library with broken auth.

**Restart `npm run dev` after changing `DATABASE_URL`.** Next.js loads
`.env.local` only at process startup, so a server started before the edit keeps
using the old URL and serves demo data indefinitely.

The content tables (`sources`, `series`, `series_listings`, `chapters`) and auth
tables are all defined in `prisma/schema.prisma`.

Note: the stale `data.sqlite` at the repo root is a leftover from a pre-Prisma
experiment (its tables are snake_case and do not match the schema). Postgres is
the configured provider; nothing reads that file.

### Profile image uploads

Avatars and banners are uploaded through `POST /api/auth/profile/image`
(`kind=avatar|banner`). The route sniffs the image's magic bytes (PNG, JPEG,
WebP or GIF), caps avatars at 2 MB and banners at 3 MB, writes the file to
`public/uploads/profiles/`, and stores only its URL on the user row. Deleting
or replacing an image removes the old file.

That folder is filesystem state: `next start` serves it fine on a VPS or local
machine, but it is ephemeral on serverless platforms (and not part of a build).
Swap the write for S3/R2/uploads before deploying there, and ignore
`public/uploads/` in version control if you want the repo to stay clean.

## Scripts

| npm script | Does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run env:pull` | Pull Development env vars from the linked Vercel project into `.env.local` |
| `npm run check:env` | Assert required env keys are present (values are never printed) |
| `npm run import:mangadex -- "Title" [--db]` | Search + optional import |
| `npm run import:atsumaru -- "Title" [--db]` | Atsumaru (MangaBaka API) - fast, non-MangaDex, on by default |
| `npm run migrate:atsumaru [-- --apply]` | Re-sync another source's series onto Atsumaru, then delete the old rows |
| `npm run add:scanlators [-- --apply]` | Attach every Atsumaru scanlator to series you already imported |
| `npm run backfill:formats [-- --dry]` | Re-tag imported series with its real format (manhwa / manhua / manga) |
| `npm run scanlators ["filter"]` | Per-series scanlator coverage + which group the reading order follows |
| `npm run check:read-progress` | Assert the "next unread chapter" helpers (no DB needed) |
| `npm run themes:build` | Regenerate `app/themes.generated.css` from `lib/themes.ts` (runs automatically before `dev` / `build`) |
| `npm run themes:check` | Fail when the generated theme CSS is stale |
| `npm run check:themes` | WCAG contrast audit for every palette |

## Folder structure

```
app/                 Next.js App Router pages and API routes (+ themes.generated.css)
  api/chapter/[id]/  Resolve a chapter's pages at read time
  api/image/         Same-origin proxy for upstream page images
components/          UI, including the client-side Reader
lib/
  sources/           ScanlationSource adapters (mangadex, atsumaru) + registry
  themes.ts          Palette registry (theme ids, ramps, pre-paint script)
  theme-store.ts     Client theme store: persistence, cookie hint, cross-tab sync
  content.ts         DB-first reads with demo fallback
  sync.ts            Import / incremental re-sync
  image-proxy.ts     Proxy URL encoding + SSRF allowlist
  data.ts            Bundled demo data (fallback only)
prisma/              Schema and migrations
scripts/             CLI importers
```

## Notes & disclaimer

- Demo series use placeholder images from placehold.co and are badged `demo`.
- MangaDex's acceptable-use policy applies to anything built on their API:
  credit MangaDex and the scanlation groups, honour group removal requests, and
  run no ads or paid service. Requests must carry a real, non-spoofed
  `User-Agent`, stay under ~5 requests/second, and go through your own proxy.
- `lib/sources/atsumaru.ts` is an **API source, not a scraper**, and it is the
  active source for the library. It reads the public MangaBaka JSON API that
  atsu.moe is built on, and proxies page images from `cdn.atsu.moe`. It is a
  different, fast path from MangaDex (no MangaDex@Home volunteer nodes), so it is
  **enabled by default** (`ATSUMARU_ENABLED=true`). It is still an unofficial fan
  aggregator, so credit Atsumaru/MangaBaka and the scanlation groups and honor
  takedown requests. Import with `npm run import:atsumaru -- "Title" --db`.
- Not affiliated with atsu.moe, MangaDex, or any scanlation group. Do not copy
  proprietary assets or code.

## Possible next steps

- Search & filtering across imported series
- Mid-chapter resume: the scroll reader already reports progress as a
  percentage, so resuming inside a chapter is mostly a storage problem (the
  per-chapter "read" ticks already cover series-level position)
- A scheduled re-sync job using `--db --incremental` and the per-listing cursor
- Object storage (S3/R2) if you decide to host images rather than proxy them

## License
No specific license yet; treat as a personal educational project.
