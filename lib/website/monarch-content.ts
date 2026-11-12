/**
 * Monarch Tax Suite's website, brought over from the old site builder
 * (VerexaHQ "Monarch Tax Suit" site) and rebuilt as editable sections.
 * Loaded as drafts the first time someone opens Monarch → Website; nothing is
 * public until it's published from the editor.
 */
import { WISP_PAGES } from "./mkb-content";
import type { Section, SiteButton, SitePage, SiteSettings } from "./types";

const OLD = "https://daxpavvsotvsyqqntddc.supabase.co/storage/v1/object/public/branding/2896bf43-95db-420f-9bb5-8854f537bbd1/media";
/** The black-and-gold chess board photo used behind the old site's banners. */
const CHESS = `${OLD}/1791313930528-876D50AB-C0C8-4A9B-A624-C96F9D7631A7.png`;

export const MONARCH_SETTINGS: SiteSettings = {
  siteName: "Monarch Tax Suite",
  tagline: "Build Your Tax Business. Make Your Next Move.",
  topBar: "SOFTWARE • EDUCATION • SYSTEMS • SUPPORT • GROWTH",
  logo: "/brand/monarch-logo-light.webp",
  phone: "",
  email: "info@monarchtaxsuite.com",
  location: "",
  facebook: "",
  instagram: "",
  footerBlurb: "Professional tax software, systems, and mentorship built for tax professionals who are ready to operate like a business.",
  ctaLabel: "Become a Monarch Partner",
  ctaHref: "/contact",
  bookingLabel: "",
  bookingHref: "",
  portalHref: "",
};

let n = 0;
const id = () => `msec-${(++n).toString(36).padStart(4, "0")}`;
const gold = (label: string, href: string): SiteButton => ({ label, href, style: "gold" });
const outline = (label: string, href: string): SiteButton => ({ label, href, style: "outline" });
const ticks = (intro: string, list: string[]) => `${intro}\n\n${list.map((x) => `✓ ${x}`).join("\n")}`;
const cta = (): Section => ({ id: id(), type: "cta", eyebrow: "It's time to", title: "Make Your Next Move.", body: "Join Monarch Tax Suite and get the tools, training, and support to build the tax business you envision.", buttons: [{ label: "Join Monarch →", href: "/contact", style: "dark" }] });
const page = (slug: string, title: string, description: string, position: number, sections: Section[], nav = true): SitePage => ({ id: `pg-m-${slug || "home"}`, slug, title, description, nav, position, draft: sections, published: null, rev: 1 });

const software: Section[] = [
  { id: id(), type: "text", tone: "dark", eyebrow: "Tax software", title: "Your Tax Business Deserves Better Tools.", body: "Our professional tax software and integrated tools give you everything you need to prepare, file, and manage your clients efficiently — all in one place.", buttons: [gold("Explore Software →", "/contact")] },
  { id: id(), type: "cards", tone: "dark", columns: 3, items: [
    { title: "Tax Preparation Software", body: "Accurate. Reliable. Built for Professionals." },
    { title: "Client Management", body: "Keep everything organized and accessible." },
    { title: "Workflow & Automation", body: "Save time and improve efficiency." },
    { title: "Banking & Payment Tools", body: "Streamlined payment solutions for your business." },
    { title: "Business Resources", body: "Templates, forms, and more to support your growth." },
  ] },
];
const mentorship: Section[] = [
  { id: id(), type: "text", tone: "light", eyebrow: "Mentorship", title: "Don't Just Get the Software. Learn How to Use It.", body: "Our mentorship program gives you real-world guidance, proven strategies, and ongoing support to help you build a profitable and sustainable tax business.", buttons: [gold("View Mentorship Options →", "/contact")] },
  { id: id(), type: "cards", tone: "warm", columns: 3, items: [
    { title: "Step-by-step training on the software and systems" },
    { title: "Live coaching and Q&A support" },
    { title: "Business setup and growth strategies" },
    { title: "Marketing and client acquisition guidance" },
    { title: "Learn from an experienced tax professional" },
    { title: "Ongoing support throughout tax season and beyond" },
  ] },
];

/**
 * The WISP funnel (same pages as on the old Monarch site): landing page →
 * WISP Generator (answers become Monarch leads) → next steps. The menu is
 * hidden on these pages so visitors stay on the path.
 */
const wisp = WISP_PAGES.map((p, i): SitePage => {
  const base: SitePage = { ...structuredClone(p), id: `pg-m-${p.slug}`, title: p.slug === "wisp-next-steps" ? "WISP Next Steps" : p.title, nav: false, hideNav: true, position: 10 + i, published: null };
  if (p.slug === "wisp-builder")
    base.draft = [
      { id: id(), type: "hero", eyebrow: "Monarch Tax Suite • WISP Builder", title: "Protect the business behind the return.", body: "Build a practical Written Information Security Plan for your tax practice. Answer a guided set of questions, review your security readiness, and get your WISP as a PDF you can save and review.", buttons: [{ label: "Start My WISP →", href: "/wisp-generator", style: "gold" }], image: CHESS },
      { id: id(), type: "cards", tone: "light", eyebrow: "What you'll complete", title: "A guided process. Not a cybersecurity exam.", columns: 3, items: [
        { label: "01 / Your practice", title: "Tell us about your firm.", body: "Business details, who's responsible for security, and how your practice is set up." },
        { label: "02 / Security", title: "Walk through your safeguards.", body: "MFA, devices, backups, access, training, vendors and more." },
        { label: "03 / Readiness", title: "See what needs attention.", body: "Get your WISP and a readiness snapshot based on your answers." },
      ] },
      { id: id(), type: "cta", title: "Ready to build your plan?", body: "Free · about 10 minutes · your WISP as a PDF", buttons: [{ label: "Start My WISP →", href: "/wisp-generator", style: "dark" }] },
    ];
  if (p.slug === "wisp-generator")
    base.draft = [
      { id: id(), type: "hero", eyebrow: "Monarch Tax Suite • WISP Builder", title: "Build your Written Information Security Plan.", body: "Answer a few questions about your practice and your safeguards. You'll get your WISP as a PDF, a readiness score, and a list of what to work on next — free.", buttons: [], image: CHESS },
      { id: id(), type: "wisp", tone: "warm", title: "Your WISP in about 10 minutes" },
    ];
  if (p.slug === "wisp-next-steps")
    base.draft = [...base.draft, { id: id(), type: "cta", eyebrow: "Grow with Monarch", title: "Ready to make your next move?", body: "Professional tax software, systems and mentorship for tax professionals.", buttons: [{ label: "Become a Monarch Partner →", href: "/contact", style: "dark" }] }];
  return base;
});

export const MONARCH_PAGES: SitePage[] = [
  page("", "Home", "Professional tax software, business systems, resources and mentorship for tax professionals ready to grow.", 0, [
    { id: id(), type: "hero", eyebrow: "Software • Education • Systems • Support • Growth — for tax professionals who want more.", title: "Build Your Tax Business. Make Your Next Move.", body: "Professional tax software, systems, and mentorship built for tax professionals who are ready to operate like a business.", buttons: [gold("Explore the Software →", "/software"), outline("Explore Mentorship", "/mentorship")], image: CHESS },
    { id: id(), type: "cards", tone: "warm", eyebrow: "Three ways to grow", title: "Choose Your Move.", body: "Everything you need to start, scale, and sustain a profitable tax business.", columns: 3, items: [
      { title: "Tax Software", body: ticks("Professional tax preparation software built for today's tax professionals.", ["Prepare & e-file with confidence", "Save time with built-in tools", "Year-round access", "Scales with your business"]) },
      { title: "Tax Business Systems", body: ticks("Operate with structure, efficiency, and compliance-minded systems.", ["Client management tools", "Workflow automation", "Banking & payment solutions", "Templates, forms & resources"]) },
      { title: "Mentorship", body: ticks("Practical guidance from an experienced tax professional who's been in your shoes.", ["Step-by-step training", "Live support & coaching", "Business growth strategies", "Learn how to maximize your tools"]) },
    ] },
    { id: id(), type: "text", tone: "light", eyebrow: "More than software", title: "Built for Tax Professionals.", body: "Monarch Tax Suite gives you the tools, training, and support to run a smarter, more profitable tax business. Whether you're just getting started or ready to scale, our ecosystem helps you work efficiently, stay compliant, and grow with confidence.", buttons: [gold("See How It Works →", "/software")] },
    { id: id(), type: "cards", tone: "light", columns: 3, items: [
      { title: "Professional Tools", body: "Powerful software and resources built for tax professionals." },
      { title: "Streamlined Workflows", body: "Save time and stay organized year-round." },
      { title: "Compliance Focused", body: "Built with tax professionals in mind." },
      { title: "Business Growth", body: "Tools and training to help you scale." },
      { title: "Ongoing Education", body: "Stay informed with continual learning." },
      { title: "Dedicated Support", body: "Get the help you need when you need it." },
    ] },
    { id: id(), type: "cards", tone: "dark", columns: 4, items: [
      { title: "Built for Tax Professionals", body: "Tools. Training. Support." },
      { title: "Software + Education", body: "A Complete Ecosystem" },
      { title: "Grow With Confidence", body: "From Season to Season" },
      { title: "Join a Community", body: "Of Like-Minded Professionals" },
    ] },
    { id: id(), type: "faq", tone: "warm", eyebrow: "Frequently asked questions", title: "Quick Answers.", items: [
      { title: "Who is Monarch Tax Suite for?", body: "Tax professionals who want professional software, systems, education and support to build a stronger tax business." },
      { title: "What's included in the software packages?", body: "Package inclusions vary by offering. Review the current software package details before purchasing." },
      { title: "Do you offer mentorship?", body: "Yes. Monarch offers mentorship and education designed around software use, business setup, growth and operations." },
      { title: "How much does the software cost?", body: "Pricing depends on the software package and business path you choose." },
      { title: "How does onboarding work?", body: "After selecting your offer, you'll receive the appropriate next steps and access instructions." },
      { title: "Is there ongoing support?", body: "Support options depend on the product or mentorship path selected." },
    ] },
    cta(),
  ]),
  page("software", "Software", "Professional tax software and integrated tools for tax professionals.", 1, [...software, cta()]),
  page("mentorship", "Mentorship", "Mentorship and education for tax professionals building a profitable tax business.", 2, [...mentorship, cta()]),
  page("contact", "Become a Partner", "Become a Monarch partner — choose the path that fits your tax business.", 3, [
    { id: id(), type: "hero", eyebrow: "Become a Monarch partner", title: "Ready to Make Your Move?", body: "Choose the path that fits your tax business and get started with Monarch. Tell us about your office and we'll reach out with next steps.", buttons: [], image: CHESS },
    { id: id(), type: "form", tone: "warm", title: "Get started with Monarch", formSlug: "monarch" },
  ], false),
  page("privacy", "Privacy Policy", "How Monarch Tax Suite collects, uses, protects and shares information, including text messaging.", 20, [
    { id: id(), type: "hero", eyebrow: "Privacy Policy", title: "Your information, handled with care.", body: "How Monarch Tax Suite collects, uses, protects and shares personal information — on our website, during setup, and by email and text.\n\nEffective November 12, 2026" },
    { id: id(), type: "cards", tone: "light", columns: 2, items: [
      { title: "Who we are", body: "Monarch Tax Suite (“Monarch,” “we,” “us”) provides tax software, business systems, onboarding and mentorship to tax professionals and tax offices. You can reach us at info@monarchtaxsuite.com." },
      { title: "Information we collect", body: "• Information you give us on our website: your name, office name, email, phone number, city and state, and anything you write in a form — including answers you give in our free WISP generator.\n• Information you give us to set up your services, through a private setup link: office details, preparer and location information, and documents needed for software and bank enrollment. Sensitive information is stored securely, with encryption where it applies.\n• Communication preferences: whether you agreed to receive marketing emails or text messages, and when and how.\n• Basic technical information: such as your browser type and pages visited, and whether a marketing email was opened or a link in it was clicked." },
      { title: "How we use information", body: "• To respond to your requests and to provide, set up, support and bill for the products and services you choose.\n• To send service messages, such as setup links, reminders, receipts and replies to your questions.\n• To send marketing emails and text messages — only as described here, and you can opt out at any time.\n• To protect our customers and our business, and to meet legal obligations." },
      { title: "Text messaging", body: "No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. Information sharing with subcontractors in support services, such as customer service, is permitted. All other categories in this policy exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.\n\nWe text only people who agreed to receive texts — by checking the optional text consent box on our website forms, or by texting START. Message frequency varies. Message and data rates may apply. Reply HELP for help or STOP to opt out. See our Text Message Terms (link at the bottom of this page)." },
      { title: "How we share information", body: "We do not sell your personal information. We share it only with service providers who help us operate — for example the tax software providers and banks you enroll with, secure hosting, email and text message delivery, and payment processing — and only as needed to provide their services; when required by law; or with your permission." },
      { title: "How we protect information", body: "We use encryption, access controls, sign-in verification and activity logs to protect your information. We never ask for passwords, Social Security numbers or client tax information by email. No system is perfectly secure, so please contact us right away if you believe your information has been misused." },
      { title: "Your choices", body: "• Email: use the unsubscribe link in any marketing email.\n• Text messages: reply STOP to any message, or START to resubscribe.\n• Your information: email info@monarchtaxsuite.com to review, correct or ask us to delete it. Some records must be kept for a period of time by law." },
      { title: "Keeping information, children and changes", body: "We keep information as long as needed to provide our services and meet legal record-keeping requirements, then securely delete it. Our website and services are not directed to children under 13. We may update this policy; the effective date at the top shows when it last changed." },
    ] },
  ], false),
  page("text-terms", "Text Message Terms", "Terms for Monarch Tax Suite text messages: what we send, how often, HELP and STOP.", 21, [
    { id: id(), type: "hero", eyebrow: "Text Message Terms", title: "Text messages from Monarch Tax Suite.", body: "What to expect when you agree to get text messages from us — and how to get help or stop them at any time.\n\nEffective November 12, 2026" },
    { id: id(), type: "cards", tone: "light", columns: 2, items: [
      { title: "At a glance", body: "Monarch Tax Suite text messages. Message frequency varies (typically 2–4 messages per month). Message and data rates may apply. Reply HELP for help. Reply STOP to cancel at any time." },
      { title: "What we send", body: "Product updates, tax season and onboarding reminders, offers for our software and mentorship, and replies to questions you send us by text." },
      { title: "How you sign up", body: "By checking the optional text consent box on one of our website forms (for example our contact form or WISP generator), or by texting START to our number. Agreeing to receive text messages is not a condition of buying any product or service." },
      { title: "How to stop", body: "Reply STOP to any message (STOPALL, UNSUBSCRIBE, CANCEL, END and QUIT also work). You’ll get one message confirming you’re unsubscribed, and no more messages after that. To start again, reply START." },
      { title: "How to get help", body: "Reply HELP to any message, or email info@monarchtaxsuite.com." },
      { title: "Costs and delivery", body: "Message and data rates may apply according to your mobile plan. Carriers are not liable for delayed or undelivered messages." },
      { title: "Privacy", body: "No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. Text messaging opt-in data and consent will not be shared with any third parties. Our full Privacy Policy is linked at the bottom of this page." },
    ] },
  ], false),
  ...wisp,
];
