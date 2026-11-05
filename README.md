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
- The Verexa-style white sidebar (blue-to-lime active pill, slate dark mode) becomes an icon rail on tablet and a slide-out drawer on mobile.
- Logo: the official MKB gold artwork, with the black background removed and the letters kept solid so it sits directly on the white sidebar (`brand-assets/build_logo.py` regenerates it). The original is in `brand-assets/`; web versions are in `public/brand/`. Gold is used only for the brand mark, not the UI.

## What works in the preview (sample data, in-browser only)
- **Dashboard**: KPIs, revenue chart, service performance, appointments, tasks, activity, invoices.
- **Clients**: list (search, filters, sort, CSV export), profile with services, documents, messages,
  appointments, invoices, signatures, notes and activity; formatted contact/tax fields
  (DOB, SSN/ITIN, EIN, responsible party) with masked, audited reveal.
- **Leads**: board (drag-and-drop) and list (bulk actions), customizable stages and sources,
  follow-up reminders, notes, activity log, status and priority, and lead → client conversion
  that carries over contact, business info, notes, staff, source and full history.

- **Tax Preparation Center**: dashboard metrics, individual and business returns per tax year,
  organizers that drive the document checklist, missing-document tracking, preparer/reviewer
  assignment with sign-off, the full return status workflow, e-file submissions with
  acknowledgements and rejection codes, fee schedule, pricing, invoices and balances, and a
  permission preview. Returns link to the central client profile (documents, invoices,
  engagement and activity live there).
- **Bookkeeping Workspace**: an oversight layer over each client's own QuickBooks Online (not a
  replacement for it). Overview KPIs and a work queue showing who acts next (client or MKB); one
  workspace per business (a client can have several); an 8-stage monthly close with reopen and a
  full status history; a client task center and client portal preview; an MKB-only review and
  reconciliation center (flagged items, statement balances and dates, discrepancies, assignments,
  final approval); a QuickBooks tab designed around Intuit OAuth 2.0 per company (no real
  connection); a report center; documents, client-visible messages and internal notes; and billing
  on the client record. Reconciliation balances are marked as fictional sample values.
- **Business Services Center** (nationwide, all 50 states): dashboard KPIs and a work queue with the
  next required action; an administrator-editable service catalog (custom services, no code changes)
  that labels administrative and document-preparation work as not legal advice; service requests from
  intake through quote, payment, client information, assignment, processing, agency submission,
  verified approval, reviewed deliverables, completion approval and follow-up; a formation workspace;
  businesses linked to existing clients (several per client) with formation state, state ID numbers
  and foreign registrations in other states; a configurable state requirement framework (agency,
  official website, frequency, due date, fee, source, last-verified date) that ships with no
  hard-coded deadlines or fees; verification tracking that never labels a business compliant without
  a recorded check; a nationwide compliance calendar (filters by state, entity type, deadline and
  staff) with 60/30/14/7-day reminders; state-specific document checklists; documents and billing on
  the client record with MKB fees separated from government and third-party fees, refunds and
  adjustment history; and a mobile-friendly client portal view.
- **Expungement Center**: administrative assistance (not legal services) from inquiry through
  records, screening, document preparation, filing coordination and completion. One matter per
  client holds any number of separate case records (arrests, dockets, charges, courts, states), each
  with its own records checklist and request tracker, preliminary screening recorded by a person
  (approval blocked until records, jurisdiction rules and any required legal review are verified),
  document preparation with internal and client approval, and filing/court tracking (Submitted,
  Granted and Completed require verified confirmations). Louisiana and Texas are configured
  separately with no hard-coded statutes, waiting periods or fees; pricing is configurable by
  service, jurisdiction and complexity. Includes a guided client intake, a client portal, role
  previews with restricted criminal-history access, masked identifiers and an access log.

Changes reset on page reload. Nothing is sent to a server.

## Roadmap
1. **Design**: dashboard, navigation, themes (approved)
2. **Frontend**: service workspaces, CRM screens, client portal, roles and permissions UI ← *current*
3. **Backend**: Cloudflare, database, auth with MFA, RBAC, file storage, audit logs
4. **Testing and deployment**: protected preview first, then a production domain only after approval

Credit repair is out of scope for this phase.
