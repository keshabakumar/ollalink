# @v1/web — Ollalink Marketing Site

Static marketing site. Next.js 14 App Router. No dashboard, no auth forms.

## Layout

```
src/
├── app/
│   ├── layout.tsx / page.tsx        # Landing page
│   ├── privacy/ terms/ talk-to-us/  # Static pages
│   ├── manifest.ts / robots.ts / sitemap.ts
│   └── opengraph-image.png / twitter-image.png
├── components/header.tsx
├── fonts/
└── env.ts                          # t3-env validated env vars
```

## Commands

```bash
bun dev        # next dev -p 3001
bun build      # next build
bun start      # next start
bun lint       # biome lint
bun typecheck  # tsc --noEmit
```

## Environment

Copy `.env.example` to `.env.local`. See root [`ENV.md`](../../ENV.md).