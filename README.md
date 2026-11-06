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
  Release scope: Louisiana (expungement) and Texas (expunction and order of nondisclosure as two
  separate workflows, never combined); no other states are active or offered. The intake collects
  the full SSN into the identifier vault — masked everywhere, revealed only by permitted roles, and
  every reveal logged (production: field-level encryption, server-side access control, audit logs).
- **Team & Permissions** (`/team`): overview KPIs, a searchable and paginated team directory, seven
  default roles (Owner, Administrator, Manager, Senior Staff, Staff, Limited Access Staff, Client)
  plus custom and duplicated roles, a module × action permission matrix, record-type and
  sensitivity limits, record scopes (all records in the member's departments, assigned only, managed
  team, individually selected), separate sensitive-information permissions (masked view, reveal and
  edit SSN, ITIN, EIN, financial and expungement records, sensitive downloads and exports), six
  departments that never grant each other's access, invitations (resend, cancel, expiry), access
  requests (sensitive access is approved only by the Owner), onboarding and offboarding checklists
  with work reassignment (staff are deactivated, never deleted), a read-only audit log and a security
  policy page. The "Previewing as" selector in the banner switches the whole suite to any team
  member or a client's portal: navigation, records, actions and SSN reveals change with the role, and
  opening a URL directly never grants access.
  **These are interface checks for review, not security.** The production backend must enforce
  every permission on every request and write the audit log server-side; MFA, password, session and
  lockout settings are stored for the Phase 3 authentication service, which enforces them.
- **Guided tax interview** (Tax return → Interview tab, and the client portal): one sitting,
  branching on every answer, with repeating entries (W-2s, dependents, rentals, K-1s, vehicles,
  owners). Paths for Form 1040, 1040 + Schedule C (sole proprietor / single-member LLC), 1040-X,
  1065 (partnership / multi-member LLC), 1120-S and 1120; the 990 interview is not built yet.
  Answers pre-fill from the client profile, save as you go, and resume at the first unfinished step.
  Submitting adds the documents the answers call for to the checklist and sets the filing status.
  Staff see a coverage map of the return's parts, automatic flags (e.g. self-employment on a plain
  1040, ownership not totalling 100%, S-corp officer without wages), the schedules the return needs
  with one-click pricing, and a follow-up request that collects every question and sends them to the
  client together. SSN/EIN/bank numbers keep only the last four digits (production: encrypted vault).
  The question sets are a draft (TY 2026 v1) that MKB's preparer must review and approve each year.
- **Forms** (`/forms`): lead-capture forms built in the platform for the website and social links.
  A builder with live preview (question types, required answers, "show only if" logic, and where each
  answer saves on the lead), lead routing (assignee, pipeline stage, source/campaign, tags, services,
  follow-up reminder), a direct link and website embed code, a Test tab, and a submissions inbox with
  spam handling. Each submission creates a lead automatically — or, when the email/phone matches,
  adds to the existing lead or client's activity instead of creating a duplicate. Forms can't be
  published with fields that would collect sensitive information (SSN, bank/card numbers, date of
  birth, criminal-history details); those are collected later through the secure portal interviews.
  The public page (`/f/<link-name>`) is separate from the staff app; in this preview it shows the
  sample forms and doesn't save responses (use the Test tab to see a submission become a lead).

Changes reset on page reload. Nothing is sent to a server.

## Backend (Phase 3 — in progress)
The foundation — database, sign-in with MFA, server-enforced permissions, encrypted identifiers
and an append-only audit log — is built and tested locally on Cloudflare's runtime. Nothing is
deployed and no cloud resources exist yet. See [docs/BACKEND.md](docs/BACKEND.md) for how to run
it, what's tested, and what must happen before it goes live.

## Roadmap
1. **Design**: dashboard, navigation, themes (approved)
2. **Frontend**: service workspaces, CRM screens, client portal, roles and permissions UI ← *current*
3. **Backend**: Cloudflare, database, auth with MFA, RBAC, file storage, audit logs
4. **Testing and deployment**: protected preview first, then a production domain only after approval

Credit repair is out of scope for this phase.
