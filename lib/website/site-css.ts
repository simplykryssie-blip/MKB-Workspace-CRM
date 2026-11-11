/** Styles for section-built website pages (scoped to .mkbsite). Used in the editor preview and on the public pages. */
export const SITE_CSS = String.raw`/* MKB public website — black, white and gold foil (from the original site). Scoped to .mkbsite. */
.mkbsite {
  --b: #0b0b0b; --w: #fff; --g: #b87912; --gd: #f6d37a; --warm: #f7f6f2; --m: #626262; --l: #ddd; --max: 1180px;
  --foil: linear-gradient(115deg, #6e4105, #b87912, #f7d77f, #a96808, #ffe7a1, #b87912, #6e4105);
  font: 16px/1.65 Arial, Helvetica, sans-serif; color: var(--b); background: #fff; min-height: 100vh; overflow-x: clip;
}
.mkbsite *, .mkbsite *::before, .mkbsite *::after { box-sizing: border-box; }
.mkbsite a { color: inherit; text-decoration: none; }
.mkbsite img { max-width: 100%; display: block; }
.mkbsite .wrap { width: min(calc(100% - 40px), var(--max)); margin: 0 auto; }
.mkbsite .serif { font-family: Georgia, "Times New Roman", serif; font-weight: 500; }
.mkbsite .eyebrow { font-size: 10px; font-weight: 900; letter-spacing: .22em; text-transform: uppercase; color: var(--g); margin: 0 0 16px; }
.mkbsite .goldtext { background: var(--foil); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.mkbsite .rule { width: 68px; height: 3px; background: var(--foil); margin: 22px 0; }
.mkbsite p { margin: 0 0 14px; }

/* top bar + header */
.mkbsite .topbar { background: var(--b); color: #fff; text-align: center; padding: 9px 12px; font-size: 10px; font-weight: 800; letter-spacing: .2em; white-space: pre-wrap; }
.mkbsite .header { position: sticky; top: 0; z-index: 30; background: #fff; border-bottom: 1px solid #eee; }
.mkbsite .header .bar { height: 78px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.mkbsite .logo img { height: 52px; width: auto; }
.mkbsite .logo .name { font: 600 20px Georgia, serif; }
.mkbsite .links { display: flex; gap: 18px; align-items: center; font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.mkbsite .links a:hover { color: var(--g); }
.mkbsite .btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 12px 21px; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; border: 1px solid transparent; cursor: pointer; }
.mkbsite .btn.gold { background: var(--foil); color: #111; }
.mkbsite .btn.dark { background: var(--b); color: #fff; }
.mkbsite .btn.outline { border-color: currentColor; }
.mkbsite .menu { display: none; position: relative; }
.mkbsite .menu summary { list-style: none; cursor: pointer; min-height: 44px; display: flex; align-items: center; padding: 0 6px; font-size: 11px; font-weight: 900; letter-spacing: .14em; }
.mkbsite .menu summary::-webkit-details-marker { display: none; }
.mkbsite .menu nav { position: absolute; right: 0; top: 52px; width: min(300px, 86vw); background: #fff; border: 1px solid var(--l); box-shadow: 0 18px 40px rgba(0,0,0,.14); padding: 10px; display: grid; }
.mkbsite .menu nav a { padding: 12px 10px; font-size: 13px; font-weight: 700; border-bottom: 1px solid #f0f0f0; }
.mkbsite .menu nav a:last-child { border-bottom: 0; }

/* sections */
.mkbsite .sec { padding: 88px 0; }
.mkbsite .tone-light { background: #fff; color: var(--b); }
.mkbsite .tone-warm { background: var(--warm); color: var(--b); }
.mkbsite .tone-dark { background: var(--b); color: #fff; }
.mkbsite .h1 { font: 500 clamp(42px, 6vw, 76px)/1.03 Georgia, serif; margin: 0 0 20px; }
.mkbsite .h2 { font: 500 clamp(32px, 4.4vw, 56px)/1.08 Georgia, serif; margin: 0 0 18px; max-width: 900px; }
.mkbsite .lead { font-size: 17px; line-height: 1.75; color: var(--m); max-width: 760px; }
.mkbsite .tone-dark .lead { color: #d2d2d2; }
.mkbsite .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 26px; }

/* hero */
.mkbsite .hero { background: var(--b); color: #fff; position: relative; overflow: hidden; }
.mkbsite .hero .grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr); gap: 48px; align-items: center; min-height: 600px; }
.mkbsite .hero .copy { padding: 90px 0; position: relative; z-index: 2; }
.mkbsite .hero .lead { color: #ddd; }
.mkbsite .hero .photo { align-self: stretch; position: relative; margin-right: calc((100vw - min(100vw - 40px, var(--max))) / -2); min-height: 420px; }
.mkbsite .hero .photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 15%; }
.mkbsite .hero .photo::before { content: ""; position: absolute; inset: 0; z-index: 1; background: linear-gradient(90deg, #0b0b0b 0%, rgba(11,11,11,.55) 18%, rgba(11,11,11,0) 55%); }
.mkbsite .hero.noimg .grid { grid-template-columns: 1fr; min-height: 0; }

/* cards + prices */
.mkbsite .cards { display: grid; gap: 1px; background: var(--l); border: 1px solid var(--l); margin-top: 34px; }
.mkbsite .cols-2 { grid-template-columns: repeat(2, 1fr); }
.mkbsite .cols-3 { grid-template-columns: repeat(3, 1fr); }
.mkbsite .cols-4 { grid-template-columns: repeat(4, 1fr); }
.mkbsite .card { background: #fff; padding: 30px; min-height: 190px; }
.mkbsite .tone-warm .card { background: #fff; }
.mkbsite .tone-dark .cards { background: #2a2a2a; border-color: #2a2a2a; }
.mkbsite .tone-dark .card { background: #111; color: #fff; }
.mkbsite .card .lbl { font-size: 10px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: var(--g); }
.mkbsite .card h3 { font: 500 26px/1.2 Georgia, serif; margin: 22px 0 10px; }
.mkbsite .card p { color: #666; font-size: 14px; margin: 0; }
.mkbsite .tone-dark .card p { color: #ccc; }
.mkbsite .price { position: relative; }
.mkbsite .price.featured { background: var(--b); color: #fff; }
.mkbsite .price.featured p { color: #ddd; }
.mkbsite .price .amt { font: 40px/1 Georgia, serif; margin: 14px 0 12px; }
.mkbsite .price .amt small { font: 13px Arial, sans-serif; color: #888; margin-left: 4px; }
.mkbsite .note { font-size: 13px; color: #777; margin-top: 20px; max-width: 900px; }
.mkbsite .tone-dark .note { color: #aaa; }

/* faq */
.mkbsite .faq { margin-top: 26px; max-width: 900px; }
.mkbsite .faq details { border-bottom: 1px solid var(--l); padding: 18px 0; }
.mkbsite .faq summary { font-weight: 800; cursor: pointer; min-height: 32px; }
.mkbsite .faq details p { color: #666; margin: 10px 0 0; }
.mkbsite .tone-dark .faq details p { color: #ccc; }

/* cta */
.mkbsite .cta { background: var(--foil); color: #0b0b0b; padding: 70px 0; }
.mkbsite .cta .inner { display: flex; justify-content: space-between; align-items: center; gap: 30px; }
.mkbsite .cta h2 { font: 500 clamp(32px, 4vw, 48px)/1.06 Georgia, serif; margin: 0 0 8px; max-width: 760px; }
.mkbsite .cta p { margin: 0; font-weight: 700; letter-spacing: .08em; }

/* form */
.mkbsite .formbox { max-width: 720px; margin-top: 28px; }
.mkbsite .embed { display: block; width: 100%; border: 0; background: #fff; }

/* footer */
.mkbsite .footer { background: #090909; color: #fff; padding: 56px 0 22px; }
.mkbsite .foot { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 40px; }
.mkbsite .foot img { height: 60px; width: auto; margin-bottom: 16px; }
.mkbsite .foot h4 { color: var(--gd); font-size: 10px; letter-spacing: .16em; margin: 0 0 14px; }
.mkbsite .foot a, .mkbsite .foot p { display: block; color: #aaa; font-size: 13px; margin: 0 0 9px; }
.mkbsite .foot a:hover { color: #fff; }
.mkbsite .copyright { border-top: 1px solid #292929; margin-top: 34px; padding-top: 16px; color: #777; font-size: 11px; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.mkbsite .draftbar { position: sticky; top: 0; z-index: 40; background: #fff6d8; color: #5b4300; font-size: 12.5px; text-align: center; padding: 7px 12px; border-bottom: 1px solid #ecd9a0; }

@media (max-width: 1080px) {
  .mkbsite .links { display: none; }
  .mkbsite .menu { display: block; }
}
@media (max-width: 900px) {
  .mkbsite .hero .grid { grid-template-columns: 1fr; gap: 0; min-height: 0; }
  .mkbsite .hero .copy { padding: 64px 0 36px; }
  .mkbsite .hero .photo { margin: 0 calc(50% - 50vw); min-height: 0; aspect-ratio: 4 / 5; max-height: 560px; }
  .mkbsite .hero .photo::before { background: linear-gradient(180deg, #0b0b0b 0%, rgba(11,11,11,0) 30%); }
  .mkbsite .cols-3, .mkbsite .cols-4 { grid-template-columns: repeat(2, 1fr); }
  .mkbsite .foot { grid-template-columns: 1fr 1fr; }
  .mkbsite .cta .inner { display: block; }
  .mkbsite .cta .actions { margin-top: 20px; }
}
@media (max-width: 600px) {
  .mkbsite .wrap { width: calc(100% - 32px); }
  .mkbsite .sec { padding: 60px 0; }
  .mkbsite .header .bar { height: 66px; }
  .mkbsite .logo img { height: 42px; }
  .mkbsite .header .btn.gold { display: none; }
  .mkbsite .cols-2, .mkbsite .cols-3, .mkbsite .cols-4, .mkbsite .foot { grid-template-columns: 1fr; }
  .mkbsite .card { min-height: 0; padding: 24px; }
}

/* Monarch website contact form */
.mkbsite .mform { display: grid; gap: 14px; background: #fff; border: 1px solid #e5e1d8; padding: 24px; color: #111; font-family: var(--font-sans, system-ui); }
.mkbsite .mform .grid2 { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.mkbsite .mform label { display: grid; gap: 6px; font-size: 14px; font-weight: 600; }
.mkbsite .mform input, .mkbsite .mform select, .mkbsite .mform textarea { font: inherit; font-weight: 400; padding: 11px 12px; border: 1px solid #cfcac0; border-radius: 4px; background: #fff; color: #111; width: 100%; box-sizing: border-box; }
.mkbsite .mform .check { display: flex; gap: 10px; align-items: flex-start; font-weight: 400; font-size: 13px; color: #444; }
.mkbsite .mform .check input { width: 18px; height: 18px; margin-top: 2px; flex: none; }
.mkbsite .mform .hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.mkbsite .mform .err { color: #a12b1e; margin: 0; font-size: 14px; }
.mkbsite .mform button { justify-self: start; border: 0; cursor: pointer; }
.mkbsite .mform.done h3 { margin: 0 0 6px; font-size: 22px; }

/* WISP Generator (Monarch funnel) */
.mkbsite .wisp .wisp-step { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: #9a650d; }
.mkbsite .wisp .wisp-bar { height: 6px; background: #eee8dc; border-radius: 9px; overflow: hidden; }
.mkbsite .wisp .wisp-bar span { display: block; height: 100%; background: linear-gradient(110deg,#6e4105,#b87912,#f7d77f,#b87912); }
.mkbsite .wisp .wisp-qs { display: grid; gap: 12px; }
.mkbsite .wisp fieldset { border: 1px solid #e5e1d8; border-radius: 6px; padding: 14px; margin: 0; }
.mkbsite .wisp legend { font-weight: 700; font-size: 15px; padding: 0 4px; line-height: 1.4; }
.mkbsite .wisp .wisp-opts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.mkbsite .wisp .wisp-opts label { display: flex; gap: 8px; align-items: center; border: 1px solid #cfcac0; border-radius: 6px; padding: 10px 14px; font-weight: 600; cursor: pointer; min-height: 44px; }
.mkbsite .wisp .wisp-opts label.on { border-color: #b87912; background: #fbf5e6; }
.mkbsite .wisp .wisp-opts input { width: 18px; height: 18px; margin: 0; }
.mkbsite .wisp .wisp-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.mkbsite .wisp .wisp-actions .btn { border: 0; cursor: pointer; }
.mkbsite .wisp .btn.outline-dark { background: #fff; color: #111; border: 1px solid #111; }
.mkbsite .wisp .btn:disabled { opacity: .5; cursor: not-allowed; }
.mkbsite .wisp .wisp-note { margin: 0; font-size: 12px; color: #666; line-height: 1.5; }
.mkbsite .wisp ul { margin: 6px 0 14px; padding-left: 20px; line-height: 1.6; }
.mkbsite .wisp ul li { list-style: disc; }

/* Menu: one line per item; switch to the MENU button before items get squeezed */
.mkbsite .header .wrap.bar { width: min(calc(100% - 40px), 1320px); }
.mkbsite .links { gap: 15px; font-size: 10px; letter-spacing: .04em; flex-wrap: nowrap; }
.mkbsite .links a { white-space: nowrap; }
@media (max-width: 1180px) {
  .mkbsite .links { display: none; }
  .mkbsite .menu { display: block; }
}
/* MKB: a larger logo on a white tab that hangs over the top banner, so the
   small "FINANCIAL GROUP" line under the letters stays readable */
.mkbsite.site-mkb .header .logo { position: relative; z-index: 31; align-self: flex-start; background: #fff; padding: 10px 18px 12px; margin-top: 4px; border-radius: 0 0 14px 14px; box-shadow: 0 10px 24px rgba(0,0,0,.18); }
.mkbsite.site-mkb .header .logo img { height: 128px; display: block; }
@media (max-width: 600px) {
  .mkbsite.site-mkb .header .logo { padding: 6px 12px 8px; }
  .mkbsite.site-mkb .header .logo img { height: 84px; }
}
`;
