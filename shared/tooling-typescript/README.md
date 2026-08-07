# @v1/typescript

Shared TypeScript config bases extended by every TS package in the monorepo.

| Base | Extends | Use for |
| --- | --- | --- |
| `base.json` | — | Strict ES2022, NodeNext, `noUncheckedIndexedAccess`, DOM libs |
| `nextjs.json` | `base.json` | Next.js apps (ESNext/Bundler, jsx preserve, Next plugin) |
| `react-library.json` | `base.json` | React libraries (`jsx: react-jsx`) |

## Usage

```jsonc
// frontend/dashboard/tsconfig.json
{
  "extends": "@v1/typescript/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

```jsonc
// shared/ui/tsconfig.json
{
  "extends": "@v1/typescript/react-library.json",
  "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"] } }
}
```