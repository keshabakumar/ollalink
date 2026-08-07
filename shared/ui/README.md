# @v1/ui

Shared shadcn/Radix UI component library used by `frontend/dashboard` and `frontend/marketing`.

## Usage

Components are exported as subpaths (see `exports` in `package.json`):

```tsx
import { Button } from "@v1/ui/button";
import { Dialog, DialogContent } from "@v1/ui/dialog";
import { cn } from "@v1/ui/utils";
import "@v1/ui/globals.css";
```

Available exports: `globals.css`, `utils`, `avatar`, `button`, `dropdown-menu`,
`input`, `logo`, `select`, `tooltip`, `switch`, `dialog`, `skeleton`, `icons`,
`scroll-area`, `upload-input`, `tailwind.config`, `postcss`.

## Layout

```
src/
├── components/   # avatar, button, dialog, dropdown-menu, icons, input,
│                 # logo, scroll-area, select, skeleton, switch, tooltip, upload-input
├── utils/       # cn() (tailwind-merge) + useDoubleCheck hook
└── globals.css  # Tailwind base (imported by apps)
```

## Commands

```bash
bun lint        # biome check .
bun format      # biome --write .
bun typecheck   # tsc --noEmit
```

## Adding a component

1. Drop the component file in `src/components/<name>.tsx`.
2. Add an `exports` entry in `package.json`: `"./<name>": "./src/components/<name>.tsx"`.
3. Re-run `bun install` to refresh the workspace symlink.