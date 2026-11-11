/**
 * MKB Financial Group's website, rebuilt from the old platform's pages
 * (docs/website/mkb-site-export.md). Used to fill an empty website the first
 * time ("Load MKB's website" in the editor) and by the design preview.
 * Business Services is a new draft (the old page was empty).
 */
import type { Section, SiteButton, SitePage, SiteSettings } from "./types";

const OLD = "https://daxpavvsotvsyqqntddc.supabase.co/storage/v1/object/public/branding/2896bf43-95db-420f-9bb5-8854f537bbd1/media";
export const OLD_LOGO = `${OLD}/1789190212386-9D4A34BB-5B7E-4BB5-B516-78950688283F.png`;
export const OLD_PHOTO = `${OLD}/1789190228609-CF16A25C-2C4B-436D-85FC-2D83B02C26AB.png`;
const MONARCH_LOGO = `${OLD}/1791313956460-3ECB562D-8A6C-4D87-BBA7-EDB77F6BE53E.png`;
const MONARCH_CHESS = `${OLD}/1791313930528-876D50AB-C0C8-4A9B-A624-C96F9D7631A7.png`;
const MONARCH_WISP = "https://monarch-tax-suite.vercel.app/wisp";

export const MKB_SETTINGS: SiteSettings = {
  siteName: "MKB Financial Group",
  tagline: "Strategy • Growth • Legacy",
  topBar: "LOUISIANA • TEXAS • VIRTUAL   STRATEGY • GROWTH • LEGACY",
  logo: OLD_LOGO,
  phone: "833-379-3320",
  email: "info@mkbfinancialgroup.com",
  location: "Louisiana • Texas • Virtual",
  facebook: "https://www.facebook.com/share/14vYUMQyJwW/",
  instagram: "https://www.instagram.com/mkbfinancialgroup",
  footerBlurb: "Professional financial services for entrepreneurs building something real.",
  ctaLabel: "Let's Talk",
  ctaHref: "/contact",
  bookingLabel: "",
  bookingHref: "",
  portalHref: "",
};

let n = 0;
const id = () => `sec-${(++n).toString(36).padStart(4, "0")}`;
const talk = { label: "Let's Talk About Your Business", href: "/contact", style: "gold" as const };
const book = { label: "Book a Consultation", href: "/contact", style: "outline" as const };
const hero = (eyebrow: string, title: string, body: string, buttons: SiteButton[] = [talk]): Section => ({ id: id(), type: "hero", eyebrow, title, body, buttons, image: OLD_PHOTO });
const cta = (title: string): Section => ({ id: id(), type: "cta", title, body: "Strategy • Growth • Legacy", buttons: [{ label: "Get Started", href: "/contact", style: "dark" }] });
const text = (tone: Section["tone"], eyebrow: string, title: string, body: string): Section => ({ id: id(), type: "text", tone, eyebrow, title, body });
const cards = (tone: Section["tone"], eyebrow: string, items: { label?: string; title: string; body?: string }[], columns: 2 | 3 | 4 = 3, title?: string, intro?: string): Section => ({ id: id(), type: "cards", tone, eyebrow, title, body: intro, items, columns });

/** `live: false` = loaded as a draft only (not on the live site until published from its page). */
const page = (slug: string, title: string, description: string, position: number, sections: Section[], nav = true, live = true): SitePage => ({ id: `pg-${slug || "home"}`, slug, title, description, nav, position, draft: sections, published: live ? sections : null, rev: 1 });

const ALL_PAGES: SitePage[] = [
  page("", "Home", "Bookkeeping, business services, tax preparation and payroll for entrepreneurs in Louisiana, Texas and virtually.", 0, [
    hero("MKB Financial Group", "Build your business with a stronger financial foundation.", "Bookkeeping. Business services. Tax preparation. Payroll. Financial guidance. MKB helps entrepreneurs start right, stay organized, plan strategically, and grow intentionally.", [talk, book]),
    text("light", "The MKB perspective", "Starting a business is easy. Building one is different.", "Your business has financial records to maintain, taxes to plan for, payroll responsibilities to manage, numbers to track, and decisions to make. MKB helps connect those pieces."),
    cards("warm", "Your business journey", [
      { label: "01 / Thinking", title: "Thinking", body: "You have an idea and are preparing to launch." },
      { label: "02 / Starting", title: "Starting", body: "You've formed the business and need to understand what comes next." },
      { label: "03 / Building", title: "Building", body: "You're operating and need organized financial systems." },
      { label: "04 / Understanding", title: "Understanding", body: "You need to know what your numbers are telling you." },
      { label: "05 / Planning", title: "Planning", body: "You want to think about taxes before they become urgent." },
      { label: "06 / Growing", title: "Growing", body: "You're ready to make informed decisions and pursue growth." },
    ]),
    cards("dark", "What we do", [
      { label: "01 / Foundation", title: "Bookkeeping", body: "Know your numbers and build a clearer picture of performance." },
      { label: "02 / Support", title: "Business Services", body: "Build the structure behind the business." },
      { label: "03 / Strategy", title: "Tax Preparation", body: "Prepare today and think ahead." },
      { label: "04 / Operations", title: "Payroll", body: "Keep your people and payroll organized." },
    ], 4),
    { ...text("light", "Bookkeeping", "Know your numbers.", "Monthly bookkeeping gives you organized records, financial statements, and visibility throughout the year."), buttons: [{ label: "Bookkeeping packages", href: "/bookkeeping", style: "dark" }] },
    { ...text("warm", "Tax", "Tax preparation looks back. Tax planning looks ahead.", "Your return tells you what happened. Planning gives you an opportunity to think about what comes next."), buttons: [{ label: "Tax preparation", href: "/tax-preparation", style: "dark" }] },
    { ...text("dark", "About MKB", "We didn't build MKB just to file tax returns.", "MKB was built to help business owners understand, organize, and strengthen the financial side of their businesses."), buttons: [{ label: "About MKB", href: "/about", style: "gold" }] },
    cta("You're building a business. Let's build the financial foundation with it."),
  ]),
  page("bookkeeping", "Bookkeeping", "Monthly bookkeeping packages from $399/month: reconciliations, P&L, Balance Sheet and Cash Flow.", 1, [
    hero("Bookkeeping", "Your books should help you run your business.", "Professional monthly bookkeeping designed to give business owners organized records, clearer financial statements, and better visibility throughout the year."),
    cards("light", "What MKB bookkeeping does", [
      { label: "01", title: "Monthly Bookkeeping", body: "Recurring organization and recording of financial activity within the agreed scope." },
      { label: "02", title: "Reconciliation", body: "Financial account reconciliation as part of the monthly close process." },
      { label: "03", title: "Financial Statements", body: "P&L, Balance Sheet, and Cash Flow as standard statements." },
    ]),
    { id: id(), type: "pricing", tone: "warm", eyebrow: "Bookkeeping packages", body: "Includes: Monthly bookkeeping, account reconciliations, P&L, Balance Sheet, Cash Flow, month-end close, financial record organization, and standard bookkeeping support.", items: [
      { label: "Foundation", title: "Foundation", price: "$399", unit: "/mo", body: "Up to 150 transactions • 3 financial accounts" },
      { label: "Essential", title: "Essential", price: "$549", unit: "/mo", body: "Up to 400 transactions • 5 financial accounts", featured: true },
      { label: "Growth", title: "Growth", price: "$749", unit: "/mo", body: "Up to 750 transactions • 8 financial accounts" },
      { label: "Advanced", title: "Advanced", price: "$999+", unit: "/mo", body: "Up to 1,500 transactions • 12 financial accounts" },
    ], note: "Internal bank transfers are excluded from transaction counts. Monthly completion is within 10 days; statements are delivered by the 5th day after the 10-day completion period." },
    cards("light", "Add-ons", [
      { label: "+$50/mo", title: "Additional Financial Account", body: "Per additional account." },
      { label: "+$150/mo", title: "Biweekly Upgrade", body: "Upgrade the bookkeeping cadence." },
      { label: "+$300/mo", title: "Weekly Upgrade", body: "Upgrade the bookkeeping cadence." },
      { label: "From $150/mo", title: "Additional Entity/Location", body: "Pricing varies by complexity." },
      { label: "Separate scope", title: "Catch-Up & Cleanup", body: "Assessment-based services." },
      { label: "Separate scope", title: "A/P & A/R", body: "Recording services available by volume." },
    ]),
    text("dark", "Scope", "A minimalist service with clear boundaries.", "Standard bookkeeping does not automatically include priority/expedited service, unlimited communication, financial analysis, advisory, consulting, additional reporting, or cleanup/catch-up work."),
    cta("Your books should work for your business."),
  ]),
  page("business-services", "Business Services", "Business formation, EIN, annual reports, compliance tracking and business documentation support.", 2, [
    hero("Business Services", "Build the structure behind the business.", "From forming your business to keeping it in good standing, MKB helps you handle the paperwork, filings and deadlines that come with owning a business — so you can focus on running it."),
    cards("light", "Business formation", [
      { label: "01", title: "LLC & Corporation Formation", body: "Name availability check, preparation and submission of your formation documents, and EIN assistance." },
      { label: "02", title: "EIN Application", body: "Help completing and submitting your IRS Employer Identification Number application." },
      { label: "03", title: "Registrations & Changes", body: "Trade names, registering in another state, amendments, name changes and dissolutions." },
    ]),
    cards("warm", "Stay in good standing", [
      { label: "Compliance", title: "Annual Reports", body: "Preparation and submission of your state annual report or registration." },
      { label: "Compliance", title: "Licenses & Deadlines", body: "Tracking of business licenses, permits and state deadlines, with reminders before they are due." },
      { label: "Compliance", title: "Registered Agent Coordination", body: "Coordinating a registered agent appointment or change with the provider and the state." },
    ]),
    cards("light", "Business documentation", [
      { label: "Documents", title: "Operating Agreements", body: "Administrative preparation from a standard template and your instructions." },
      { label: "Documents", title: "Resolutions & Records", body: "Resolutions for actions your members or board approved, and an organized business record book." },
    ], 2),
    text("dark", "How we help", "Administrative support — not legal advice.", "MKB prepares and submits paperwork on your behalf using the information you provide, and prepares documents from standard templates and your instructions. MKB is not a law firm and does not provide legal advice. State and government filing fees are separate and are confirmed for your state before anything is filed."),
    cta("Your business deserves a solid structure. Let's build it."),
  ]),
  page("tax-preparation", "Tax Preparation", "Individual and business tax preparation, tax document organization and year-round tax planning.", 3, [
    hero("Tax Preparation", "Tax preparation looks back. Tax planning looks ahead.", "MKB helps clients organize tax preparation while keeping the bigger financial picture in view."),
    cards("light", "Tax preparation", [
      { label: "01", title: "Individual Tax Preparation", body: "Professional preparation and guidance based on the client's circumstances and MKB's return scope." },
      { label: "02", title: "Business Tax Preparation", body: "Business tax preparation supported by organized financial information and documentation." },
      { label: "03", title: "Tax Document Organization", body: "Help understanding the information and documentation needed for preparation." },
    ]),
    text("dark", "Tax planning & strategy", "Don't wait until tax season to think about taxes.", "Understand what is affecting your tax position, think through relevant financial decisions, and keep information organized for filing."),
    text("warm", "Tax + bookkeeping", "Better books can make tax time a different experience.", "When books are organized throughout the year, tax preparation doesn't have to begin with reconstructing what happened months ago."),
    cards("light", "The tax process", [
      { label: "01", title: "Get Started", body: "Tell us about yourself and/or your business." },
      { label: "02", title: "Organize & Review", body: "Gather documentation and address missing information." },
      { label: "03", title: "Prepare & File", body: "Complete preparation, final review, approval, and filing." },
    ]),
    cta("Your taxes are part of your business. Let's treat them that way."),
  ]),
  page("payroll", "Payroll", "Payroll processing from $175/month, payroll tax compliance and payroll bookkeeping.", 4, [
    hero("Payroll", "Keep payroll moving. Keep your business organized.", "MKB helps business owners keep payroll processing, payroll records, and payroll-related responsibilities organized as the business grows."),
    { id: id(), type: "pricing", tone: "light", eyebrow: "Full payroll processing", items: [
      { label: "1–5 workers", title: "Starter", price: "$175", unit: "/month", body: "Recurring payroll processing for 1–5 workers. Includes employees, contractors paid through payroll, and owners processed through payroll." },
      { label: "6–10 workers", title: "Growing", price: "$275", unit: "/month", body: "Recurring payroll processing for 6–10 workers with the same core processing scope.", featured: true },
      { label: "11–25 workers", title: "Expanding", price: "$425", unit: "/month", body: "Recurring payroll processing for 11–25 workers as payroll volume increases." },
      { label: "26–50 workers", title: "Established", price: "$650", unit: "/month", body: "Recurring payroll processing for 26–50 workers. Higher-volume payroll requires an organized recurring process." },
    ], note: "Worker count includes employees, contractors paid through payroll, and owners processed through payroll. Owner draws/distributions remain bookkeeping transactions unless the owner is processed through payroll." },
    { id: id(), type: "pricing", tone: "warm", eyebrow: "Payroll tax compliance", body: "Federal + 1 state base scope.", items: [
      { label: "1–5 workers", title: "1–5", price: "$125", unit: "/month" },
      { label: "6–10 workers", title: "6–10", price: "$175", unit: "/month" },
      { label: "11–25 workers", title: "11–25", price: "$250", unit: "/month" },
      { label: "26–50 workers", title: "26–50", price: "$350", unit: "/month" },
    ] },
    cards("dark", "Three different services", [
      { label: "Processing", title: "Run Payroll", body: "Recurring payroll processing within the selected worker tier." },
      { label: "Compliance", title: "Handle Payroll Taxes", body: "Payroll tax compliance is a separate service." },
      { label: "Bookkeeping", title: "Record Payroll", body: "Payroll bookkeeping records and reconciles payroll activity when included." },
    ]),
    text("light", "Payroll + bookkeeping", "Your payroll doesn't stop at payday.", "Payroll activity affects financial statements. Connecting payroll to bookkeeping keeps the financial side organized."),
    cta("Your team deserves a payroll system that works."),
  ]),
  page("record-expungement", "Record Expungement", "Administrative help and document preparation for people seeking a record expungement. MKB is not a law firm and does not give legal advice.", 4, [
    hero("Record Expungement", "Help with the paperwork behind a fresh start.", "MKB Financial Group provides administrative assistance and document preparation for people pursuing a record expungement. We help you gather your information, request your records and prepare your paperwork — and we keep you updated along the way.", [talk]),
    cards("warm", "How we help", [
      { label: "1", title: "Intake", body: "We collect your information and organize it in one place." },
      { label: "2", title: "Records requests", body: "We help you request the records and court documents needed for your paperwork." },
      { label: "3", title: "Document preparation", body: "We prepare your documents from the information you provide, for you to review before anything is used." },
      { label: "4", title: "Updates", body: "You can see where your paperwork stands in your client portal." },
    ], 4, "Administrative assistance, step by step"),
    text("light", "Important", "What we do — and what we don't", "MKB Financial Group provides administrative assistance and document preparation. MKB is not a law firm and does not provide legal advice or representation.\n\nWe do not decide whether you are eligible for an expungement, and completing our intake does not mean you are eligible. Courts and agencies make their own determinations, and we cannot promise an outcome or a timeline.\n\nFor legal advice about your situation, please consult a licensed attorney."),
    { id: id(), type: "faq", tone: "warm", eyebrow: "Questions", title: "Common questions", items: [
      { title: "Can you tell me if I'm eligible?", body: "No. We can't determine eligibility or give legal advice. Eligibility is decided under the law that applies to your record, by the court or agency involved. For advice about your situation, consult a licensed attorney." },
      { title: "Do you guarantee my record will be expunged?", body: "No. Courts and agencies make their own decisions, and we cannot promise any outcome." },
      { title: "How long does it take?", body: "It depends on the agencies and courts involved, including how long records requests take. We can't promise a timeframe, but you can follow your progress in your client portal." },
      { title: "Are you a law firm?", body: "No. MKB Financial Group is not a law firm and does not provide legal advice or representation." },
    ] },
    cta("Have questions about our expungement assistance?"),
  ]),
  page("about", "About MKB", "MKB Financial Group helps business owners understand, organize and strengthen the financial side of their businesses.", 5, [
    hero("About MKB Financial Group", "We didn't build MKB just to file tax returns.", "MKB was built to help business owners understand, organize, and strengthen the financial side of their businesses."),
    text("light", "The why", "Business owners need more than a tax return.", "Running a business means making decisions constantly. MKB exists to help owners answer those questions with better financial information and organization."),
    cards("dark", "The MKB philosophy", [
      { label: "Clarity", title: "Understand", body: "Know what is happening financially inside your business." },
      { label: "Organization", title: "Structure", body: "Keep financial information structured, accessible, and maintained." },
      { label: "Strategy", title: "Think Ahead", body: "Use financial information to support future decisions." },
    ]),
    text("warm", "Meet the founder", "Built with purpose.", "MKB Financial Group was built to help business owners navigate the financial side of building a business with greater clarity, organization, and support."),
    cards("light", "Who we serve", [
      { label: "01", title: "New Entrepreneurs", body: "Starting and establishing a financial foundation." },
      { label: "02", title: "Growing Businesses", body: "Building stronger systems as the business changes." },
      { label: "03", title: "Established Businesses", body: "Maintaining organization as complexity increases." },
    ]),
    cta("You're building something. Let's build the foundation with it."),
  ]),
  page("resources", "Resources", "Bookkeeping basics, tax and payroll explainers, a business owner checklist and answers to common questions.", 6, [
    hero("MKB Resources", "Understand your business beyond the bank balance.", "Practical information for business owners who want to understand their books, taxes, payroll, financial responsibilities, and the decisions that come with running a business."),
    cards("light", "Start here", [
      { label: "01 • Bookkeeping", title: "Know your numbers.", body: "Learn how to read your P&L, Balance Sheet, Cash Flow, reconcile accounts, organize receipts, and understand what your books are telling you." },
      { label: "02 • Tax", title: "Prepare and plan.", body: "Understand tax documents, preparation, estimated-tax concepts, deductions, and why tax planning should happen before the filing deadline." },
      { label: "03 • Payroll", title: "Keep payroll organized.", body: "Learn the difference between payroll processing, payroll tax compliance, and payroll bookkeeping—and why each matters." },
      { label: "04 • Business", title: "Build the foundation.", body: "Business setup, financial systems, banking, QuickBooks organization, and the administrative practices that support growth." },
    ], 2, "Resources built around the questions business owners actually ask."),
    cards("warm", "Bookkeeping basics", [
      { label: "01", title: "Profit & Loss", body: "Understand income and expenses." },
      { label: "02", title: "Balance Sheet", body: "Understand what the business owns and owes." },
      { label: "03", title: "Cash Flow", body: "Understand how money moves." },
      { label: "04", title: "Reconciliations", body: "Make sure records agree with financial accounts." },
    ], 4, "Your books are more than a record of what already happened.", "Use financial statements to understand revenue, expenses, profitability, cash position, and trends. Good bookkeeping gives you organized information to work from."),
    text("dark", "Tax & compliance", "Tax season should not be the first time you look at your numbers.", "Organized records make tax preparation easier to support. Planning is different from preparation: preparation reports what happened; planning considers future decisions and their potential tax effects.\n\nFor specific tax advice, filing requirements, deadlines, or current law, work with your tax professional based on your circumstances."),
    cards("light", "Business owner checklist", [
      { label: "Monthly", title: "Close the books.", body: "Reconcile accounts, review financial statements, categorize outstanding items, and identify unusual activity." },
      { label: "Quarterly", title: "Review the direction.", body: "Look at revenue, expenses, cash, profitability, and major changes in the business." },
      { label: "Annually", title: "Prepare for the next year.", body: "Organize tax documents, review systems, evaluate recurring costs, and plan the financial priorities ahead." },
    ]),
    { id: id(), type: "faq", tone: "warm", eyebrow: "Frequently asked questions", items: [
      { title: "What is bookkeeping?", body: "Bookkeeping is the ongoing organization and recording of financial activity so a business has reliable financial records." },
      { title: "How often should a business reconcile its accounts?", body: "Frequency depends on transaction volume and business needs. MKB's core bookkeeping service is monthly, with biweekly and weekly upgrades available." },
      { title: "What financial statements should a business owner review?", body: "Common core statements include the Profit & Loss, Balance Sheet, and Cash Flow statement." },
      { title: "Is bookkeeping the same as tax preparation?", body: "No. Bookkeeping organizes financial records throughout the year. Tax preparation uses relevant financial and tax information to prepare and file a return." },
      { title: "Is payroll included with bookkeeping?", body: "Payroll processing and payroll tax compliance are separate services. Payroll bookkeeping addresses the recording and reconciliation of payroll activity." },
      { title: "Can MKB help if my books are behind?", body: "Yes. Catch-up and historical cleanup are available as separate, assessment-based services." },
      { title: "Can MKB tell me what I should do for my specific tax situation?", body: "MKB can explain the services it provides and help organize information. Specific tax advice depends on your circumstances and the scope of services engaged." },
    ] },
    text("light", "More from MKB", "Education that grows with your business.", "This resource center can expand with MKB guides, checklists, videos, tax education, bookkeeping education, payroll resources, and business-owner insights."),
    cta("You don't have to know everything about business. You just need to know where to start."),
  ]),
  page("contact", "Let's Talk", "Tell MKB Financial Group about your business — we'll follow up within one business day.", 7, [
    { ...hero("Get started", "Let's talk about your business.", "Tell us a little about yourself and what you need. We'll follow up within one business day.", []), image: undefined },
    { id: id(), type: "form", tone: "warm", eyebrow: "Contact MKB", title: "Tell us about your business.", body: "Prefer to call? 833-379-3320 · info@mkbfinancialgroup.com", formSlug: "contact" },
  ], false),
  page("calculator", "Tax Calculator", "A basic tax calculator from Monarch Tax Suite.", 8, [
    { id: id(), type: "embed", title: "Monarch Basic Tax Calculator", html: '<iframe src="https://monarch-tax-suite.vercel.app/embed/calculator?id=emb_jEt4FwT-a2pO1bpdKhe7OQ" title="Monarch Basic Tax Calculator" loading="lazy" style="width:100%;height:1400px;border:0;display:block"></iframe>', height: 1400 },
  ]),
  page("wisp-builder", "WISP Builder", "Build a Written Information Security Plan for your tax practice with Monarch Tax Suite.", 9, [
    { id: id(), type: "embed", title: "WISP Builder", height: 1500, html: `<style>body{margin:0}.wl{font-family:Arial,sans-serif;background:#0b0b0b;color:#fff;min-height:100vh}.wl *{box-sizing:border-box}.wl .w{width:min(1120px,92%);margin:auto}.wl .hero{min-height:720px;position:relative;display:flex;align-items:center;overflow:hidden;background:#050505}.wl .hero:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,5,5,.98),rgba(5,5,5,.82) 44%,rgba(5,5,5,.18) 78%,rgba(5,5,5,.04));z-index:1}.wl .chess{position:absolute;inset:0;background:url("${MONARCH_CHESS}") center/cover;opacity:.9}.wl .c{position:relative;z-index:2;max-width:650px;padding:90px 0}.wl .logo{width:270px;max-width:70%;margin-bottom:42px}.wl .ey{font-size:11px;letter-spacing:.25em;font-weight:800;color:#f5d47b;text-transform:uppercase}.wl h1{font:500 clamp(48px,7vw,82px)/.98 Georgia,serif;margin:18px 0 24px}.wl .g{background:linear-gradient(110deg,#6e4105,#b87912,#f7d77f,#fff0ae,#a96808);-webkit-background-clip:text;background-clip:text;color:transparent}.wl p{font-size:18px;line-height:1.75;color:#ddd}.wl .btn{display:inline-block;margin-top:25px;padding:16px 28px;background:linear-gradient(110deg,#6e4105,#b87912,#f7d77f,#fff0ae,#a96808);color:#090909;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;text-decoration:none}.wl .below{background:#fff;color:#0b0b0b;padding:80px 0}.wl .below h2{font:500 48px Georgia,serif}.wl .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#ddd;margin-top:40px}.wl .card{background:#fff;padding:30px;min-height:200px}.wl .card b{font-size:10px;letter-spacing:.16em;color:#9a650d}.wl .card h3{font:500 26px Georgia,serif}.wl .card p{font-size:14px;color:#666}.wl .foot{background:#0b0b0b;text-align:center;padding:30px;color:#aaa;font-size:11px}.wl .foot img{width:180px;margin-bottom:12px}@media(max-width:700px){.wl .hero{min-height:680px}.wl .c{padding:70px 0}.wl .chess{background-position:62% center;opacity:.7}.wl .grid{grid-template-columns:1fr}}</style><div class="wl"><section class="hero"><div class="chess"></div><div class="w"><div class="c"><img class="logo" src="${MONARCH_LOGO}" alt="Monarch Tax Suite"><div class="ey">MONARCH TAX SUITE • WISP BUILDER</div><h1>Protect the <span class="g">business</span> behind the return.</h1><p>Build a practical Written Information Security Plan for your tax practice. Answer a guided set of questions, review your security readiness, and generate your WISP in a format you can save and review.</p><a class="btn" href="/wisp-generator" target="_top">Start My WISP</a></div></div></section><section class="below"><div class="w"><div class="ey">WHAT YOU'LL COMPLETE</div><h2>A guided process. Not a cybersecurity exam.</h2><div class="grid"><div class="card"><b>01 / YOUR PRACTICE</b><h3>Tell us about your firm.</h3><p>Business details, tax year, PTIN and your practice structure.</p></div><div class="card"><b>02 / SECURITY</b><h3>Walk through your safeguards.</h3><p>MFA, devices, backups, access, training, vendors and more.</p></div><div class="card"><b>03 / READINESS</b><h3>See what needs attention.</h3><p>Receive a concise WISP and readiness snapshot based on your answers.</p></div></div></div></section><div class="foot"><img src="${MONARCH_LOGO}" alt="Monarch Tax Suite"><div>SOFTWARE • TOOLS • TRAINING • GROWTH</div></div></div>` },
  ], false, false),
  page("wisp-generator", "WISP Generator", "Generate a Written Information Security Plan for your tax practice with Monarch Tax Suite.", 10, [
    { id: id(), type: "hero", eyebrow: "WISP funnel • Step 2 — draft", title: "Generate your Written Information Security Plan.", body: "The old WISP Generator page was cut off when it was saved and never displayed. Until a new generator is built here, this step sends people to Monarch Tax Suite's working WISP Generator (free audit, then the guided plan).", buttons: [{ label: "Open the WISP Generator", href: MONARCH_WISP, style: "gold" }] },
    { id: id(), type: "text", tone: "light", eyebrow: "Next step", title: "After your WISP is complete", body: "See additional resources to protect your business.", buttons: [{ label: "Next steps", href: "/wisp-next-steps", style: "dark" }] },
  ], false, false),
  page("wisp-next-steps", "WISP Next Steps (LegalShield)", "Resources after completing your WISP.", 11, [
    { id: id(), type: "embed", title: "WISP Next Steps", height: 1100, html: `<style>body{margin:0}.wn2{font-family:Inter,Arial,sans-serif;background:#fff;color:#111;min-height:100vh}.wn2 *{box-sizing:border-box}.wn2 .shell{width:min(980px,92%);margin:auto}.wn2 .brandbar{height:94px;display:flex;align-items:center;border-bottom:1px solid #eee}.wn2 .logo{width:235px}.wn2 main{padding:58px 0}.wn2 .ey{font-size:10px;letter-spacing:.22em;color:#a66b0c;font-weight:900}.wn2 h1{font:500 clamp(42px,6vw,68px)/1.02 Georgia,serif;margin:12px 0}.wn2 .lead{color:#666;font-size:16px;line-height:1.7;max-width:720px}.wn2 .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:40px}.wn2 .card{border:1px solid #ddd;padding:32px;background:#fff}.wn2 .dark{background:#8231D4;color:#fff;border-color:#8231D4}.wn2 .legalShieldLogo{background:#fff;padding:14px 18px;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;margin-bottom:8px}.wn2 .legalShieldLogo img{display:block;width:min(250px,100%);height:auto}.wn2 h2{font:500 30px Georgia,serif}.wn2 p{line-height:1.7;color:#666}.wn2 .dark p{color:#fff}.wn2 .legalShieldBtn{background:#fff;color:#48217A}.wn2 .btn{display:inline-block;margin-top:16px;padding:15px 22px;text-decoration:none;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;border-radius:4px}.wn2 .gold{background:linear-gradient(110deg,#9a6208,#c88c1c,#f2cb72,#c88c1c,#9a6208);color:#111}.wn2 .legal{font-size:10px;color:#777;margin-top:28px}@media(max-width:700px){.wn2 .grid{grid-template-columns:1fr}.wn2 main{padding:42px 0}.wn2 .brandbar{height:80px}.wn2 .logo{width:205px}}</style><div class="wn2"><div class="brandbar"><div class="shell"><img class="logo" src="${MONARCH_LOGO}" alt="Monarch Tax Suite"></div></div><main class="shell"><div class="ey">WISP COMPLETE • NEXT STEPS</div><h1>Protect More Than Your Tax Business.</h1><p class="lead">Your WISP is a big step. Here are additional resources to help you protect the business and keep growing.</p><div class="grid"><div class="card dark"><div class="legalShieldLogo"><img src="https://upload.wikimedia.org/wikipedia/commons/e/ec/LegalShield_logo.png" alt="LegalShield"></div><div class="ey" style="color:#fff">BUSINESS &amp; LEGAL PROTECTION</div><h2>Protect your business.</h2><p>Get access to legal resources, identity protection, and business support with LegalShield.</p><a class="btn legalShieldBtn" href="https://martinbilbojr.legalshieldassociate.com" target="_blank" rel="noopener noreferrer">Visit LegalShield →</a></div><div class="card"><div class="ey">NEED HELP WITH YOUR WISP?</div><h2>Get personalized support.</h2><p>Need help understanding your results, implementing your plan, or staying compliant? Book a consultation.</p><a class="btn gold" href="/contact" target="_top">Book a Consultation →</a></div></div><p class="legal">Monarch Tax Suite and MKB Financial Group are not law firms and do not provide legal advice. LegalShield services are provided by LegalShield and its provider law firms.</p></main></div>` },
  ], false, false),
];

const isWisp = (p: SitePage) => p.slug.startsWith("wisp-");
export const MKB_PAGES: SitePage[] = ALL_PAGES.filter((p) => !isWisp(p));
/** The WISP funnel pages — part of Monarch Tax Suite's website, not MKB's. */
export const WISP_PAGES: SitePage[] = ALL_PAGES.filter(isWisp);
