# @v1/email

React Email templates for Ollalink. Rendered server-side and sent via Resend
(or SMTP). Used by `backend/convex` for auth + billing emails.

## Layout

```
emails/          # Email templates (welcome.tsx, …)
components/      # Shared email building blocks
```

## Commands

```bash
bun dev      # email dev -p 3003  (live preview at http://localhost:3003)
bun build    # email build
bun start    # email start
bun lint     # biome check .
bun typecheck # tsc --noEmit
```

## Adding a template

1. Create `emails/<name>.tsx` exporting a default React component.
2. Import it from `backend/convex/convex/email/templates/` and call
   `sendEmail()` from `backend/convex/convex/email/index.ts`.