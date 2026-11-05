# MKB Business Suite

Staff CRM and client portal for **MKB Financial Group**. It covers Tax Preparation, Bookkeeping, Business Services and Record Expungement.

> **Status: Phase 1 (Design).** Frontend only. There is no backend, database, authentication or deployment yet.
> All data is fictional sample data in `lib/sample-data.ts`.

## Stack
- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS v4 with CSS-variable design tokens (light and dark themes in `app/globals.css`)
- lucide-react icons, with hand-built SVG charts (no paid or charting dependencies)
- Target hosting: Cloudflare Workers via `@opennextjs/cloudflare`, added in Phase 3 after approval

## Run locally
```bash
npm install
npm run dev     # http://localhost:3000
npm run build && npm start
```

## Design system
- Palette derived from the Verexa CRM: azure `#0B7FE0`, lime `#A4D22B`, cool slate neutrals and soft card shadows.
- Service division colors (blue, cyan, green, amber) were checked for color-blind separation in both themes.
- The navy sidebar becomes an icon rail on tablet and a slide-out drawer on mobile.
- The logo is an SVG placeholder (`components/brand/Logo.tsx`). Swap it for the official MKB logo file.

## Roadmap
1. **Design**: dashboard, navigation, themes ← *current*
2. **Frontend**: service workspaces, CRM screens, client portal, roles and permissions UI
3. **Backend**: Cloudflare, database, auth with MFA, RBAC, file storage, audit logs
4. **Testing and deployment**: protected preview first, then a production domain only after approval

Credit repair is out of scope for this phase.
