/**
 * Monarch Tax Suite's website, brought over from the old site builder
 * (VerexaHQ "Monarch Tax Suit" site) and rebuilt as editable sections.
 * Loaded as drafts the first time someone opens Monarch → Website; nothing is
 * public until it's published from the editor.
 */
import { MKB_PAGES } from "./mkb-content";
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

/** The WISP funnel pages (same pages as on the old Monarch site). */
const wisp = MKB_PAGES.filter((p) => p.slug.startsWith("wisp-")).map((p, i): SitePage => ({
  ...structuredClone(p),
  id: `pg-m-${p.slug}`,
  title: p.slug === "wisp-next-steps" ? "WISP Next Steps" : p.title,
  nav: p.slug === "wisp-builder",
  position: 10 + i,
  published: null,
}));

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
  ...wisp,
];
