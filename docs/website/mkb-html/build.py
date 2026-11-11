"""Builds the MKB Financial Group website as plain HTML pages (metallic gold foil design)."""
import os, html as H

OUT = os.path.join(os.path.dirname(__file__), "out")
os.makedirs(OUT, exist_ok=True)
M = "/site/media/"
PHONE, EMAIL = "833-379-3320", "info@mkbfinancialgroup.com"
FB, IG = "https://www.facebook.com/share/14vYUMQyJwW/", "https://www.instagram.com/mkbfinancialgroup"
PORTAL = "https://portal.mkbfinancialgroup.com"

CSS = r"""
/* ============================================================
   MKB FINANCIAL GROUP — website styles
   Metallic gold foil design system. Edit the tokens below to
   change the look everywhere on this page.
   ============================================================ */
:root{
  --black:#0B0B0B; --black-2:#111111; --charcoal:#161616; --line:#2a2722;
  --warm-white:#F7F5F0; --cream:#F1EDE4; --ink:#141210; --ink-2:#4a453d;
  --text:#F4EFE4; --text-2:#BDB5A6;
  /* Metallic gold foil: champagne highlights, rich midtones, darker metal shadows */
  --gold-foil:linear-gradient(115deg,#6E4A16 0%,#9B6B20 8%,#C49A43 16%,#F2DC98 24%,#FFF5D2 28%,#E9C774 34%,#B88932 45%,#D9B259 54%,#F8E7A9 61%,#C9993F 70%,#8F621D 80%,#D7AE57 90%,#F3DD95 95%,#7A511B 100%);
  /* Deeper foil for gold on cream backgrounds (keeps contrast) */
  --gold-foil-deep:linear-gradient(115deg,#5A3A0E 0%,#8A5D19 20%,#B88932 38%,#7A511B 55%,#A9792C 72%,#5E3E10 100%);
  --gold-edge:linear-gradient(90deg,rgba(184,137,50,0),#B88932 18%,#F8E7A9 50%,#B88932 82%,rgba(184,137,50,0));
  --gold-solid:#C9A253; /* fallback only */
  /* Subtle foil grain + light sweep, layered over the gold */
  --foil-grain:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 .95 0 0 0 0 .8 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");
  --foil-sheen:linear-gradient(180deg,rgba(255,252,235,.55) 0%,rgba(255,252,235,.08) 42%,rgba(60,35,5,0) 58%,rgba(60,35,5,.28) 100%);
  --serif:"Cormorant Garamond","Playfair Display",Georgia,"Times New Roman",serif;
  --sans:"Inter","Helvetica Neue",Arial,sans-serif;
  --max:1200px; --radius:6px;
}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--black);color:var(--text);font:400 16px/1.7 var(--sans);-webkit-font-smoothing:antialiased;overflow-x:hidden}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
p{margin:0 0 14px}
.wrap{width:min(calc(100% - 40px),var(--max));margin:0 auto}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}

/* ---------- metallic gold system (reusable) ---------- */
.metallic-gold-text{background:var(--gold-foil);background-size:220% 100%;background-position:10% 0;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:var(--gold-solid);filter:drop-shadow(0 1px 0 rgba(0,0,0,.55))}
.on-light .metallic-gold-text{background:var(--gold-foil-deep);-webkit-background-clip:text;background-clip:text;filter:none}
.metallic-gold-button{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:50px;padding:14px 26px;border-radius:var(--radius);font:700 13.5px/1 var(--sans);letter-spacing:.03em;color:#1B1306;
  background:var(--foil-sheen),var(--foil-grain),var(--gold-foil);background-size:100% 100%,160px 160px,240% 100%;background-position:0 0,0 0,8% 0;
  border:1px solid #8A5F1D;box-shadow:inset 0 1px 0 rgba(255,248,215,.85),inset 0 -2px 4px rgba(90,55,10,.45),0 10px 26px rgba(0,0,0,.45),0 0 0 1px rgba(255,230,160,.06);
  text-shadow:0 1px 0 rgba(255,240,190,.55);transition:background-position .6s ease,transform .2s ease,box-shadow .2s ease}
.metallic-gold-button:hover{background-position:0 0,0 0,72% 0;transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,248,215,.9),inset 0 -2px 4px rgba(90,55,10,.45),0 14px 30px rgba(0,0,0,.5),0 0 22px rgba(232,196,107,.25)}
.metallic-gold-button svg{width:16px;height:16px}
.metallic-gold-border{border:1px solid transparent;background:linear-gradient(var(--black),var(--black)) padding-box,var(--gold-foil) border-box}
.metallic-gold-divider{height:1px;border:0;background:var(--gold-edge);margin:0}
.metallic-gold-icon{width:46px;height:46px;stroke:url(#mkbGoldStroke);fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 1px 0 rgba(0,0,0,.5))}
.btn-outline{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:50px;padding:14px 26px;border-radius:var(--radius);font:600 13.5px/1 var(--sans);letter-spacing:.03em;color:var(--text);border:1px solid transparent;background:linear-gradient(#0D0C0B,#0D0C0B) padding-box,var(--gold-foil) border-box;transition:background .2s}
.btn-outline:hover{background:linear-gradient(#1E1810,#1E1810) padding-box,var(--gold-foil) border-box}
.on-light .btn-outline{color:var(--ink);background:linear-gradient(var(--warm-white),var(--warm-white)) padding-box,var(--gold-foil-deep) border-box}

/* ---------- type ---------- */
.eyebrow{display:inline-block;font:700 11px/1.4 var(--sans);letter-spacing:.28em;text-transform:uppercase;margin:0 0 16px}
.eyebrow.gold{background:var(--gold-foil);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:var(--gold-solid)}
.on-light .eyebrow.gold{background:var(--gold-foil-deep);-webkit-background-clip:text;background-clip:text}
h1,h2,h3{font-family:var(--serif);font-weight:500;letter-spacing:-.01em;margin:0}
h1{font-size:clamp(42px,5.6vw,72px);line-height:1.04;color:#FBF7EE}
h2{font-size:clamp(34px,4.2vw,52px);line-height:1.08;color:#FBF7EE;margin-bottom:18px}
h3{font-size:25px;line-height:1.2;color:#FBF7EE;margin-bottom:10px}
.lead{font-size:18px;line-height:1.7;color:var(--text-2);max-width:640px}
.on-light h1,.on-light h2,.on-light h3{color:var(--ink)}
.on-light .lead,.on-light p{color:var(--ink-2)}
.center{text-align:center}.center .lead{margin-left:auto;margin-right:auto}

/* ---------- header ---------- */
.site-header{position:sticky;top:0;z-index:50;background:rgba(8,8,8,.94);backdrop-filter:saturate(140%) blur(10px);border-bottom:1px solid rgba(201,162,83,.18)}
.site-header .bar{display:flex;align-items:center;gap:26px;height:92px}
.brand img{height:74px;width:auto;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))}
.nav{display:flex;align-items:center;gap:4px;margin-left:auto;list-style:none;padding:0;margin-top:0;margin-bottom:0}
.nav>li{position:relative}
.nav>li>a,.nav>li>span{display:flex;align-items:center;gap:6px;padding:12px 11px;font:500 13.5px/1 var(--sans);color:#E9E2D2;cursor:pointer;white-space:nowrap}
.nav>li>a:hover,.nav>li:hover>span,.nav>li:focus-within>span{color:#F6DFA0}
.nav .caret{width:10px;height:10px;stroke:currentColor;fill:none;stroke-width:2}
.nav .sub{position:absolute;top:100%;left:0;min-width:240px;list-style:none;margin:0;padding:10px;background:#0F0E0C;border:1px solid transparent;background-clip:padding-box;border-radius:8px;box-shadow:0 24px 50px rgba(0,0,0,.6);opacity:0;visibility:hidden;transform:translateY(6px);transition:all .18s ease}
.nav .sub::before{content:"";position:absolute;inset:-1px;border-radius:8px;padding:1px;background:var(--gold-foil);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;opacity:.6}
.nav>li:hover .sub,.nav>li:focus-within .sub{opacity:1;visibility:visible;transform:none}
.nav .sub a{display:block;padding:11px 12px;border-radius:6px;font:500 14px/1.3 var(--sans);color:#E9E2D2}
.nav .sub a small{display:block;font-size:12px;color:#8F8778;margin-top:3px}
.nav .sub a:hover{background:rgba(201,162,83,.1);color:#F6DFA0}
.header-cta{display:flex;align-items:center;gap:10px}
.portal{display:inline-flex;align-items:center;gap:8px;min-height:42px;padding:10px 16px;border-radius:var(--radius);font:600 12.5px/1 var(--sans);color:#E9E2D2;background:linear-gradient(#0b0b0b,#0b0b0b) padding-box,var(--gold-foil) border-box;border:1px solid transparent}
.portal svg{width:14px;height:14px;stroke:#E8C46B;fill:none;stroke-width:2}
.site-header .metallic-gold-button{min-height:42px;padding:10px 18px;font-size:12.5px}
.mnav{display:none;margin-left:auto}
.mnav summary{list-style:none;cursor:pointer;width:48px;height:48px;display:grid;place-items:center;border-radius:8px}
.mnav summary::-webkit-details-marker{display:none}
.mnav summary svg{width:26px;height:26px;stroke:#E8C46B;fill:none;stroke-width:1.8}
.mnav .panel{position:absolute;left:0;right:0;top:100%;background:#0B0B0B;border-top:1px solid rgba(201,162,83,.25);padding:14px 20px 26px;max-height:calc(100vh - 80px);overflow:auto;box-shadow:0 30px 60px rgba(0,0,0,.6)}
.mnav .panel a{display:block;padding:13px 4px;font:500 16px/1.2 var(--sans);color:#EDE6D6;border-bottom:1px solid #1d1b18}
.mnav .panel .grp{font:700 11px/1 var(--sans);letter-spacing:.24em;text-transform:uppercase;color:#8F8778;padding:18px 4px 6px}
.mnav .panel .sub a{padding-left:16px;font-size:15px}
.mnav .panel .btns{display:grid;gap:10px;margin-top:18px}
.mnav .panel .btns a{border-bottom:0;padding:15px}

/* ---------- hero ---------- */
.hero{position:relative;overflow:hidden;background:#070707;min-height:640px;display:flex;align-items:center}
.hero .photo{position:absolute;inset:0 0 0 auto;width:58%;background-size:cover;background-position:center 8%}
.hero .photo::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#070707 0%,rgba(7,7,7,.92) 14%,rgba(7,7,7,.45) 42%,rgba(7,7,7,.12) 70%,rgba(7,7,7,.35) 100%),linear-gradient(0deg,rgba(7,7,7,.75),rgba(7,7,7,0) 30%)}
.hero .glow{position:absolute;inset:auto auto -30% -10%;width:70%;height:90%;background:radial-gradient(closest-side,rgba(201,150,60,.16),rgba(201,150,60,0));pointer-events:none}
.hero .wrap{position:relative;z-index:2;padding:110px 0 96px}
.hero .copy{max-width:640px}
.hero .lead{color:#D9D1C1;margin:22px 0 32px}
.actions{display:flex;flex-wrap:wrap;gap:14px}
.place{margin-top:34px;font:600 11.5px/1 var(--sans);letter-spacing:.32em;color:#CFC6B4}
.place i{font-style:normal;color:#D7AE57;margin:0 10px}
.hero.short{min-height:520px}
.hero.plain .wrap{padding:100px 0 86px}
.hero.plain{background:radial-gradient(120% 90% at 85% 10%,#2a2112 0%,#0d0c0a 45%,#070707 75%)}
.hero.plain::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(232,196,107,.035) 0 1px,transparent 1px 140px);pointer-events:none}

/* ---------- sections ---------- */
.sec{padding:104px 0}
.sec.dark{background:var(--black)}
.sec.dark2{background:var(--black-2)}
.sec.charcoal{background:var(--charcoal)}
.sec.light{background:var(--warm-white);color:var(--ink)}
.sec.cream{background:var(--cream);color:var(--ink)}
.head{max-width:760px;margin-bottom:54px}
.head.center{margin-left:auto;margin-right:auto}
.rule{width:84px;height:2px;background:var(--gold-foil);margin:22px 0 0;border:0}
.center .rule{margin-left:auto;margin-right:auto}

/* cards */
.grid{display:grid;gap:22px}
.g2{grid-template-columns:repeat(2,1fr)}.g3{grid-template-columns:repeat(3,1fr)}.g4{grid-template-columns:repeat(4,1fr)}.g5{grid-template-columns:repeat(5,1fr)}
.card{position:relative;padding:34px 30px;border-radius:10px;background:linear-gradient(180deg,#151413,#0E0D0C);border:1px solid #24211c;transition:transform .25s ease,border-color .25s ease}
.card:hover{transform:translateY(-3px);border-color:rgba(201,162,83,.45)}
.card .num{font:600 12px/1 var(--sans);letter-spacing:.24em;color:#B79650;margin-bottom:18px;display:block}
.card p{color:var(--text-2);margin:0}
.on-light .card{background:#FFFDF8;border:1px solid #E4DCCB;box-shadow:0 12px 30px rgba(40,30,10,.06)}
.on-light .card:hover{border-color:#C9A253}
.on-light .card .num{color:#8A5F1D}
.on-light .card p{color:var(--ink-2)}
.svc{display:flex;flex-direction:column;gap:14px;text-align:left}
.svc .ic{width:58px;height:58px;display:grid;place-items:center;border-radius:12px;background:radial-gradient(circle at 30% 20%,#2a2215,#121110);border:1px solid #2e2920}
.svc a.more{margin-top:auto;font:600 13px/1 var(--sans);color:#E8C46B;display:inline-flex;gap:8px;align-items:center;padding-top:8px}
.svc a.more:hover{color:#F8E7A9}
.svc a.more svg{width:15px;height:15px;flex:none}

/* split */
.split{display:grid;grid-template-columns:1.05fr .95fr;gap:72px;align-items:center}
.portrait{position:relative;border-radius:12px;overflow:hidden}
.portrait img{width:100%;height:100%;object-fit:cover}
.portrait.framed{padding:1px;background:var(--gold-foil)}
.portrait.framed img{border-radius:11px}
.portrait.tall img{aspect-ratio:4/5}
.quote{font:500 italic 26px/1.4 var(--serif);color:#F4EBD6;border-left:2px solid #C9A253;padding-left:22px;margin:26px 0}
.on-light .quote{color:var(--ink)}

/* pricing */
.price{display:flex;flex-direction:column;gap:6px}
.price .tier{font:700 11.5px/1 var(--sans);letter-spacing:.22em;text-transform:uppercase;color:#B79650}
.price .amt{font:500 46px/1 var(--serif);margin:10px 0 4px}
.price .amt small{font:500 15px/1 var(--sans);color:var(--text-2);margin-left:4px}
.on-light .price .amt small{color:var(--ink-2)}
.price.featured{border:1px solid transparent;background:linear-gradient(#FFFDF8,#FFFDF8) padding-box,var(--gold-foil) border-box}
.price.featured .flag{position:absolute;top:-12px;left:24px;padding:6px 12px;border-radius:30px;font:700 10.5px/1 var(--sans);letter-spacing:.16em;color:#1B1306;background:var(--foil-sheen),var(--gold-foil)}
.note{margin-top:22px;font-size:13.5px;color:var(--ink-2)}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.chip{padding:9px 14px;border-radius:30px;font:500 13px/1 var(--sans);background:#FFFDF8;border:1px solid #E4DCCB;color:var(--ink-2)}

/* steps & lists */
.steps{counter-reset:s}
.ticks{list-style:none;padding:0;margin:18px 0 0;display:grid;gap:12px}
.ticks li{position:relative;padding-left:30px;color:var(--text-2)}
.ticks li::before{content:"";position:absolute;left:0;top:7px;width:16px;height:16px;border-radius:50%;background:var(--foil-sheen),var(--gold-foil)}
.ticks li::after{content:"";position:absolute;left:5px;top:10px;width:5px;height:8px;border:solid #1B1306;border-width:0 2px 2px 0;transform:rotate(45deg)}
.on-light .ticks li{color:var(--ink-2)}

/* notice */
.notice{padding:30px 32px;border-radius:10px;border:1px solid transparent;background:linear-gradient(#121110,#121110) padding-box,var(--gold-foil) border-box}
.notice p{color:#D9D1C1}
.on-light .notice{background:linear-gradient(#FFFDF8,#FFFDF8) padding-box,var(--gold-foil-deep) border-box}
.on-light .notice p{color:var(--ink-2)}

/* faq */
.faq{display:grid;gap:12px;max-width:880px}
.faq details{border-radius:10px;background:#FFFDF8;border:1px solid #E4DCCB;padding:0 24px}
.faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:20px;align-items:center;padding:20px 0;font:600 16.5px/1.4 var(--sans);color:var(--ink)}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";font:400 26px/1 var(--serif);color:#8A5F1D}
.faq details[open] summary::after{content:"–"}
.faq details p{color:var(--ink-2);padding-bottom:18px;margin:0}

/* band & cta */
.band{background:#0A0908;border-top:1px solid #2a2418;border-bottom:1px solid #2a2418;padding:34px 0}
.band .wrap{display:grid;grid-template-columns:repeat(3,1fr);text-align:center}
.band div>div{padding:6px 18px;border-right:1px solid #2a2418}
.band div>div:last-child{border-right:0}
.band strong{display:block;font:500 22px/1.2 var(--serif);color:#F4EBD6}
.band span{font-size:13px;color:#9C9483}
.cta{position:relative;overflow:hidden;padding:96px 0;background:radial-gradient(90% 140% at 15% 0%,#2a2112,#0b0b0b 60%)}
.cta::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(232,196,107,.04) 0 1px,transparent 1px 120px)}
.cta .wrap{position:relative;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:30px}
.cta h2{max-width:720px;margin:0}
.cta p{margin:12px 0 0;color:#BDB5A6;letter-spacing:.28em;font:600 11.5px/1 var(--sans);text-transform:uppercase}

/* form & embed boxes */
.formbox{max-width:780px;margin:0 auto}
.embedbox{border-radius:12px;overflow:hidden;background:#fff}

/* footer */
.site-footer{background:#070707;padding:84px 0 34px;border-top:1px solid #1f1c17}
.foot{display:grid;grid-template-columns:1.5fr 1fr 1fr 1.1fr;gap:42px}
.foot .logo img{width:230px;height:auto}
.foot h4{font:700 11px/1 var(--sans);letter-spacing:.26em;text-transform:uppercase;margin:6px 0 18px}
.foot a,.foot p{display:block;font-size:14px;color:#A49C8C;margin:0 0 11px}
.foot a:hover{color:#F6DFA0}
.foot .blurb{max-width:330px;color:#A49C8C;margin-top:18px}
.legal{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;margin-top:56px;padding-top:24px;font-size:12.5px;color:#6E675B}
.social{display:flex;gap:10px;margin-top:8px}
.social a{width:40px;height:40px;display:grid;place-items:center;border-radius:50%;border:1px solid #2e2920;margin:0}
.social svg{width:17px;height:17px;stroke:#E8C46B;fill:none;stroke-width:1.7}

/* funnel pages: no menu */
.slim .bar{justify-content:center}

/* ---------- responsive ---------- */
@media (max-width:1180px){.nav,.header-cta{display:none}.mnav{display:block}.site-header .bar{height:84px}.brand img{height:62px}}
@media (max-width:980px){
  .g3,.g4,.g5{grid-template-columns:repeat(2,1fr)}
  .split{grid-template-columns:1fr;gap:42px}
  .foot{grid-template-columns:1fr 1fr}
  .hero{flex-direction:column;align-items:stretch}
  .hero .photo{position:relative;inset:auto;width:100%;height:440px;background-position:center 12%}
  .hero .photo::after{background:linear-gradient(0deg,#070707 0%,rgba(7,7,7,.25) 45%,rgba(7,7,7,0) 70%)}
  .hero .photo+.glow+.wrap{padding-top:8px}
}
@media (max-width:640px){
  .sec{padding:72px 0}
  .g2,.g3,.g4,.g5{grid-template-columns:1fr}
  .hero{min-height:0}.hero .wrap{padding:72px 0 64px}
  .hero .photo{height:380px}
  .actions{flex-direction:column}.actions a{width:100%}
  .band .wrap{grid-template-columns:1fr;gap:16px}.band div>div{border-right:0}
  .foot{grid-template-columns:1fr}
  .cta .wrap{flex-direction:column;align-items:flex-start}.cta .metallic-gold-button{width:100%}
  .place{letter-spacing:.24em;font-size:10.5px}
  .brand img{height:56px}
}
"""

GOLD_DEFS = """<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="mkbGoldStroke" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9B6B20"/><stop offset=".22" stop-color="#F2DC98"/><stop offset=".38" stop-color="#C49A43"/><stop offset=".55" stop-color="#F8E7A9"/><stop offset=".72" stop-color="#B88932"/><stop offset="1" stop-color="#7A511B"/></linearGradient></defs></svg>"""

ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
CARET = '<svg class="caret" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4"/></svg>'
LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'

ICONS = {
  "books": '<path d="M4 20h16"/><path d="M6 16v-4"/><path d="M10 16V9"/><path d="M14 16v-6"/><path d="M18 16V6"/><path d="M5 9l5-4 4 3 6-5"/>',
  "biz": '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17.5l9 5 9-5"/>',
  "tax": '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h4M8 17h3"/><path d="M15 18l4-5"/><circle cx="15.2" cy="13.4" r=".9"/><circle cx="18.8" cy="17.6" r=".9"/>',
  "payroll": '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.5 3-5.5 6-5.5s5.4 2 6 5.5"/><path d="M16 6.5a3 3 0 0 1 0 5.6"/><path d="M18 14.6c1.8.8 2.9 2.6 3.2 5.4"/>',
  "relief": '<path d="M12 3l8 3v6c0 5-3.5 8.3-8 9-4.5-.7-8-4-8-9V6z"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/>',
  "calc": '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h4"/>',
  "clarity": '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  "structure": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  "ahead": '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
}
def icon(name, size=46):
  return f'<svg class="metallic-gold-icon" viewBox="0 0 24 24" width="{size}" height="{size}" aria-hidden="true">{ICONS[name]}</svg>'

e = H.escape
def gold(t): return f'<span class="metallic-gold-text">{t}</span>'
def btn(label, href, arrow=True): return f'<a class="metallic-gold-button" href="{href}">{e(label)}{ARROW if arrow else ""}</a>'
def obtn(label, href): return f'<a class="btn-outline" href="{href}">{e(label)}</a>'
def head(eyebrow, title, lead="", center=False, rule=True):
  return f'<div class="head{" center" if center else ""}">{f"<span class=\"eyebrow gold\">{e(eyebrow)}</span>" if eyebrow else ""}<h2>{title}</h2>{f"<p class=\"lead\">{lead}</p>" if lead else ""}{"<hr class=\"rule\">" if rule else ""}</div>'

NAV = [
  ("Home", "/", None),
  ("About MKB", "/about", None),
  ("Business Services", None, [("Bookkeeping", "/bookkeeping", "Monthly books & financial statements"), ("Business Services", "/business-services", "Formation, compliance & documents"), ("Payroll", "/payroll", "Processing, payroll tax & records")]),
  ("Tax Services", None, [("Tax Preparation", "/tax-preparation", "Individual & business returns"), ("Tax Calculator", "/tax-calculator", "Free refund / balance-due estimate")]),
  ("Record Relief", "/record-expungement", None),
  ("Resources", "/resources", None),
]

def header(slim=False):
  if slim:
    return f'<header class="site-header slim"><div class="wrap bar"><a class="brand" href="/" aria-label="MKB Financial Group home"><img src="{M}mkb-logo-header.webp" alt="MKB Financial Group" width="600" height="297"></a></div></header>'
  items = []
  for label, href, sub in NAV:
    if sub:
      subs = "".join(f'<li><a href="{h}">{e(l)}<small>{e(d)}</small></a></li>' for l, h, d in sub)
      items.append(f'<li><span tabindex="0">{e(label)}{CARET}</span><ul class="sub">{subs}</ul></li>')
    else:
      items.append(f'<li><a href="{href}">{e(label)}</a></li>')
  mob = []
  for label, href, sub in NAV:
    if sub:
      mob.append(f'<div class="grp">{e(label)}</div><div class="sub">' + "".join(f'<a href="{h}">{e(l)}</a>' for l, h, _ in sub) + '</div>')
    else:
      mob.append(f'<a href="{href}">{e(label)}</a>')
  return f'''<header class="site-header"><div class="wrap bar" style="position:relative">
<a class="brand" href="/" aria-label="MKB Financial Group home"><img src="{M}mkb-logo-header.webp" alt="MKB Financial Group" width="600" height="297"></a>
<nav aria-label="Main"><ul class="nav">{"".join(items)}</ul></nav>
<div class="header-cta"><a class="portal" href="{PORTAL}">{LOCK}Client Portal</a><a class="metallic-gold-button" href="/contact">Book a Consultation</a></div>
<details class="mnav"><summary aria-label="Open menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></summary><div class="panel">{"".join(mob)}<div class="btns"><a class="metallic-gold-button" href="/contact">Book a Consultation</a><a class="portal" href="{PORTAL}" style="justify-content:center">{LOCK}Client Portal</a></div></div></details>
</div></header>'''

def footer(slim=False):
  if slim:
    return f'<footer class="site-footer" style="padding:40px 0"><div class="wrap"><hr class="metallic-gold-divider"><div class="legal"><span>© 2026 MKB Financial Group. All rights reserved.</span><span>{PHONE} · {EMAIL}</span></div></div></footer>'
  return f'''<footer class="site-footer"><div class="wrap">
<div class="foot">
 <div><a class="logo" href="/"><img src="{M}mkb-logo-gold.webp" alt="MKB Financial Group — Strategy, Growth, Legacy" width="900" height="518"></a><p class="blurb">Professional financial services for entrepreneurs building something real.</p></div>
 <div><h4 class="metallic-gold-text">Services</h4><a href="/bookkeeping">Bookkeeping</a><a href="/business-services">Business Services</a><a href="/tax-preparation">Tax Preparation</a><a href="/payroll">Payroll</a><a href="/record-expungement">Record Relief</a></div>
 <div><h4 class="metallic-gold-text">Explore</h4><a href="/about">About MKB</a><a href="/resources">Resources</a><a href="/tax-calculator">Tax Calculator</a><a href="/contact">Book a Consultation</a><a href="{PORTAL}">Client Portal Sign In</a></div>
 <div><h4 class="metallic-gold-text">Contact</h4><a href="tel:8333793320">{PHONE}</a><a href="mailto:{EMAIL}">{EMAIL}</a><p>Louisiana • Texas • Virtual</p>
  <div class="social"><a href="{FB}" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><svg viewBox="0 0 24 24"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/></svg></a><a href="{IG}" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg></a></div>
 </div>
</div>
<hr class="metallic-gold-divider" style="margin-top:56px"><div class="legal" style="margin-top:0"><span>© 2026 MKB Financial Group. All rights reserved.</span><span class="metallic-gold-text" style="letter-spacing:.28em;font-weight:600;font-size:11.5px">STRATEGY • GROWTH • LEGACY</span></div>
</div></footer>'''

def page(title, desc, main, slim=False):
  return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{M}mkb-logo-gold.webp">
<link rel="icon" href="/brand/mkb-seal.ico" sizes="any">
<link rel="apple-touch-icon" href="/brand/mkb-seal-apple-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>{CSS}</style>
</head>
<body>
{GOLD_DEFS}
{header(slim)}
<main>
{main}
</main>
{footer(slim)}
</body>
</html>
'''

def hero(eyebrow, title_html, lead, actions, photo=None, place=True, short=False):
  ph = f'<div class="photo" style="background-image:url(\'{M}{photo}\')" role="img" aria-label="MKB Financial Group founder"></div>' if photo else ""
  cls = "hero" + ("" if photo else " plain") + (" short" if short else "")
  return f'''<section class="{cls}">{ph}<div class="glow"></div><div class="wrap"><div class="copy">
<span class="eyebrow gold">{e(eyebrow)}</span>
<h1>{title_html}</h1>
<p class="lead">{lead}</p>
<div class="actions">{actions}</div>
{'<div class="place">LOUISIANA<i>•</i>TEXAS<i>•</i>VIRTUAL</div>' if place else ""}
</div></div></section>'''

def cards(items, cols, num_fmt=None):
  out = []
  for i, (lbl, title, body) in enumerate(items):
    out.append(f'<div class="card">{f"<span class=\"num\">{e(lbl)}</span>" if lbl else ""}<h3>{e(title)}</h3><p>{e(body)}</p></div>')
  return f'<div class="grid g{cols}">{"".join(out)}</div>'

def cta(title, label="Book a Consultation"):
  return f'<section class="cta"><div class="wrap"><div><h2>{title}</h2><p>Strategy • Growth • Legacy</p></div>{btn(label, "/contact")}</div></section>'

def notice(title, paras, light=True):
  return f'<div class="notice"><h3>{e(title)}</h3>{"".join(f"<p>{e(p)}</p>" for p in paras)}</div>'

def faq(items):
  return '<div class="faq">' + "".join(f'<details><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in items) + '</div>'

def pricing(items, featured_idx=None, light=True):
  out = []
  for i, (tier, name, amt, unit, body) in enumerate(items):
    f = i == featured_idx
    out.append(f'<div class="card price{" featured" if f else ""}">{"<span class=\"flag\">MOST POPULAR</span>" if f else ""}<span class="tier">{e(tier)}</span><h3>{e(name)}</h3><div class="amt">{gold(e(amt)) if not light else f"<span class=\"metallic-gold-text\">{e(amt)}</span>"}<small>{e(unit)}</small></div><p>{e(body)}</p></div>')
  return "".join(out)

# ============================================================ pages
pages = {}

SERVICES = [
  ("books", "Bookkeeping", "Know your numbers and build a clearer picture of performance.", "/bookkeeping"),
  ("biz", "Business Services", "Build the structure behind the business.", "/business-services"),
  ("tax", "Tax Preparation", "Prepare today and think ahead.", "/tax-preparation"),
  ("payroll", "Payroll", "Keep your people and payroll organized.", "/payroll"),
  ("relief", "Record Relief", "Administrative help with the paperwork behind a fresh start.", "/record-expungement"),
]
svc_cards = '<div class="grid g5">' + "".join(f'<div class="card svc"><div class="ic">{icon(i, 34)}</div><h3>{e(t)}</h3><p>{e(b)}</p><a class="more" href="{h}">Learn more {ARROW}</a></div>' for i, t, b, h in SERVICES) + '</div>'

pages[""] = page("MKB Financial Group | Strategy • Growth • Legacy", "Bookkeeping, business services, tax preparation, payroll and record relief for entrepreneurs in Louisiana, Texas and virtually.",
  hero("MKB Financial Group", f"The business you’ve built deserves a {gold('stronger financial foundation.')}",
       "Bookkeeping, business services, tax preparation and payroll for owners who are serious about what they’re building. MKB helps entrepreneurs start right, stay organized, plan strategically, and grow intentionally.",
       btn("Explore Business Services", "/business-services") + obtn("Book a Consultation", "/contact"), photo="founder-desk-seated.webp")
  + f'''<section class="sec dark2"><div class="wrap">{head("What we do", "Everything the financial side of your business needs.", "Five service divisions, one team — so your books, taxes, payroll and paperwork work together.", center=True)}{svc_cards}</div></section>
<section class="sec light on-light"><div class="wrap split"><div>{head("The MKB perspective", "Starting a business is easy. Building one is different.", "", rule=False)}<p class="lead">Your business has financial records to maintain, taxes to plan for, payroll responsibilities to manage, numbers to track, and decisions to make. MKB helps connect those pieces.</p><hr class="rule"></div>
<div class="grid g2">''' + "".join(f'<div class="card"><span class="num">{n}</span><h3>{t}</h3><p>{b}</p></div>' for n, t, b in [("01 / Thinking", "Thinking", "You have an idea and are preparing to launch."), ("02 / Starting", "Starting", "You’ve formed the business and need to understand what comes next."), ("03 / Building", "Building", "You’re operating and need organized financial systems."), ("04 / Understanding", "Understanding", "You need to know what your numbers are telling you."), ("05 / Planning", "Planning", "You want to think about taxes before they become urgent."), ("06 / Growing", "Growing", "You’re ready to make informed decisions and pursue growth.")]) + f'''</div></div></section>
<section class="sec charcoal"><div class="wrap split"><div class="portrait framed tall"><img src="{M}founder-standing.webp" alt="The founder of MKB Financial Group in her office" loading="lazy" width="1024" height="1536"></div>
<div><span class="eyebrow gold">About MKB</span><h2>We didn’t build MKB just to {gold("file tax returns.")}</h2><p class="lead">MKB was built to help business owners understand, organize, and strengthen the financial side of their businesses.</p>
<ul class="ticks"><li>Clarity — know what is happening financially inside your business.</li><li>Organization — keep financial information structured, accessible, and maintained.</li><li>Strategy — use financial information to support future decisions.</li></ul>
<div class="actions" style="margin-top:32px">{btn("Meet MKB", "/about")}</div></div></div></section>
<section class="band"><div class="wrap"><div><strong>Bookkeeping</strong><span>Know your numbers</span></div><div><strong>Tax</strong><span>Prepare today, think ahead</span></div><div><strong>Payroll</strong><span>Keep your people organized</span></div></div></section>
<section class="sec cream on-light"><div class="wrap grid g2" style="gap:30px">
<div class="card"><span class="num">BOOKKEEPING</span><h3 style="font-size:34px">Know your numbers.</h3><p>Monthly bookkeeping gives you organized records, financial statements, and visibility throughout the year.</p><div class="actions" style="margin-top:22px">{obtn("Bookkeeping packages", "/bookkeeping")}</div></div>
<div class="card"><span class="num">TAX</span><h3 style="font-size:34px">Tax preparation looks back. Tax planning looks ahead.</h3><p>Your return tells you what happened. Planning gives you an opportunity to think about what comes next.</p><div class="actions" style="margin-top:22px">{obtn("Tax preparation", "/tax-preparation")}{obtn("Free tax calculator", "/tax-calculator")}</div></div>
</div></section>
{cta(f"You’re building a business. Let’s build the {gold('financial foundation')} with it.")}''')

pages["bookkeeping"] = page("Bookkeeping | MKB Financial Group", "Monthly bookkeeping packages from $399/month: reconciliations, P&L, Balance Sheet and Cash Flow.",
  hero("Bookkeeping", f"Your books should help you {gold('run your business.')}", "Professional monthly bookkeeping designed to give business owners organized records, clearer financial statements, and better visibility throughout the year.", btn("Book a Consultation", "/contact") + obtn("See packages", "#packages"))
  + f'''<section class="sec dark2"><div class="wrap">{head("What MKB bookkeeping does", "Organized records. Clear statements.")}{cards([("01", "Monthly Bookkeeping", "Recurring organization and recording of financial activity within the agreed scope."), ("02", "Reconciliation", "Financial account reconciliation as part of the monthly close process."), ("03", "Financial Statements", "P&L, Balance Sheet, and Cash Flow as standard statements.")], 3)}</div></section>
<section class="sec cream on-light" id="packages"><div class="wrap">{head("Bookkeeping packages", "Choose the package that fits your volume.", "Includes: monthly bookkeeping, account reconciliations, P&L, Balance Sheet, Cash Flow, month-end close, financial record organization, and standard bookkeeping support.", center=True)}
<div class="grid g4">{pricing([("Foundation", "Foundation", "$399", "/mo", "Up to 150 transactions • 3 financial accounts"), ("Essential", "Essential", "$549", "/mo", "Up to 400 transactions • 5 financial accounts"), ("Growth", "Growth", "$749", "/mo", "Up to 750 transactions • 8 financial accounts"), ("Advanced", "Advanced", "$999+", "/mo", "Up to 1,500 transactions • 12 financial accounts")], featured_idx=1)}</div>
<p class="note center">Internal bank transfers are excluded from transaction counts. Monthly completion is within 10 days; statements are delivered by the 5th day after the 10-day completion period.</p></div></section>
<section class="sec light on-light"><div class="wrap">{head("Add-ons", "Extend your package as you grow.")}{cards([("+$50/mo", "Additional Financial Account", "Per additional account."), ("+$150/mo", "Biweekly Upgrade", "Upgrade the bookkeeping cadence."), ("+$300/mo", "Weekly Upgrade", "Upgrade the bookkeeping cadence."), ("From $150/mo", "Additional Entity/Location", "Pricing varies by complexity."), ("Separate scope", "Catch-Up & Cleanup", "Assessment-based services."), ("Separate scope", "A/P & A/R", "Recording services available by volume.")], 3)}</div></section>
<section class="sec dark"><div class="wrap" style="max-width:900px">{notice("A minimalist service with clear boundaries.", ["Standard bookkeeping does not automatically include priority/expedited service, unlimited communication, financial analysis, advisory, consulting, additional reporting, or cleanup/catch-up work."])}</div></section>
{cta(f"Your books should {gold('work for your business.')}")}''')

pages["business-services"] = page("Business Services | MKB Financial Group", "Business formation, EIN, annual reports, compliance tracking and business documentation support.",
  hero("Business Services", f"Build the {gold('structure')} behind the business.", "From forming your business to keeping it in good standing, MKB helps you handle the paperwork, filings and deadlines that come with owning a business — so you can focus on running it.", btn("Book a Consultation", "/contact"))
  + f'''<section class="sec dark2"><div class="wrap">{head("Business formation", "Start on the right foundation.")}{cards([("01", "LLC & Corporation Formation", "Name availability check, preparation and submission of your formation documents, and EIN assistance."), ("02", "EIN Application", "Help completing and submitting your IRS Employer Identification Number application."), ("03", "Registrations & Changes", "Trade names, registering in another state, amendments, name changes and dissolutions.")], 3)}</div></section>
<section class="sec cream on-light"><div class="wrap">{head("Stay in good standing", "Deadlines tracked. Filings handled.")}{cards([("Compliance", "Annual Reports", "Preparation and submission of your state annual report or registration."), ("Compliance", "Licenses & Deadlines", "Tracking of business licenses, permits and state deadlines, with reminders before they are due."), ("Compliance", "Registered Agent Coordination", "Coordinating a registered agent appointment or change with the provider and the state.")], 3)}</div></section>
<section class="sec light on-light"><div class="wrap">{head("Business documentation", "Records that keep up with the business.")}{cards([("Documents", "Operating Agreements", "Administrative preparation from a standard template and your instructions."), ("Documents", "Resolutions & Records", "Resolutions for actions your members or board approved, and an organized business record book.")], 2)}</div></section>
<section class="sec dark"><div class="wrap" style="max-width:900px">{notice("Administrative support — not legal advice.", ["MKB prepares and submits paperwork on your behalf using the information you provide, and prepares documents from standard templates and your instructions. MKB is not a law firm and does not provide legal advice. State and government filing fees are separate and are confirmed for your state before anything is filed."])}</div></section>
{cta(f"Your business deserves a {gold('solid structure.')} Let’s build it.")}''')

pages["tax-preparation"] = page("Tax Preparation | MKB Financial Group", "Individual and business tax preparation, tax document organization and year-round tax planning.",
  hero("Tax Services", f"Tax preparation looks back. {gold('Tax planning looks ahead.')}", "MKB helps clients organize tax preparation while keeping the bigger financial picture in view.", btn("Book a Consultation", "/contact") + obtn("Free tax calculator", "/tax-calculator"))
  + f'''<section class="sec dark2"><div class="wrap">{head("Tax preparation", "Individual and business returns.")}{cards([("01", "Individual Tax Preparation", "Professional preparation and guidance based on the client’s circumstances and MKB’s return scope."), ("02", "Business Tax Preparation", "Business tax preparation supported by organized financial information and documentation."), ("03", "Tax Document Organization", "Help understanding the information and documentation needed for preparation.")], 3)}</div></section>
<section class="sec charcoal"><div class="wrap split"><div>{head("Tax planning & strategy", f"Don’t wait until tax season to {gold('think about taxes.')}", "Understand what is affecting your tax position, think through relevant financial decisions, and keep information organized for filing.", rule=True)}</div>
<div class="notice"><span class="eyebrow gold">Tax + bookkeeping</span><h3>Better books can make tax time a different experience.</h3><p>When books are organized throughout the year, tax preparation doesn’t have to begin with reconstructing what happened months ago.</p></div></div></section>
<section class="sec cream on-light"><div class="wrap">{head("The tax process", "Three clear steps.", center=True)}{cards([("01", "Get Started", "Tell us about yourself and/or your business."), ("02", "Organize & Review", "Gather documentation and address missing information."), ("03", "Prepare & File", "Complete preparation, final review, approval, and filing.")], 3)}</div></section>
{cta(f"Your taxes are part of your business. {gold('Let’s treat them that way.')}")}''')

pages["payroll"] = page("Payroll | MKB Financial Group", "Payroll processing from $175/month, payroll tax compliance and payroll bookkeeping.",
  hero("Payroll", f"Keep payroll moving. {gold('Keep your business organized.')}", "MKB helps business owners keep payroll processing, payroll records, and payroll-related responsibilities organized as the business grows.", btn("Book a Consultation", "/contact") + obtn("See pricing", "#pricing"))
  + f'''<section class="sec cream on-light" id="pricing"><div class="wrap">{head("Full payroll processing", "Priced by the size of your team.", center=True)}
<div class="grid g4">{pricing([("1–5 workers", "Starter", "$175", "/month", "Recurring payroll processing for 1–5 workers. Includes employees, contractors paid through payroll, and owners processed through payroll."), ("6–10 workers", "Growing", "$275", "/month", "Recurring payroll processing for 6–10 workers with the same core processing scope."), ("11–25 workers", "Expanding", "$425", "/month", "Recurring payroll processing for 11–25 workers as payroll volume increases."), ("26–50 workers", "Established", "$650", "/month", "Recurring payroll processing for 26–50 workers. Higher-volume payroll requires an organized recurring process.")])}</div>
<p class="note center">Worker count includes employees, contractors paid through payroll, and owners processed through payroll. Owner draws/distributions remain bookkeeping transactions unless the owner is processed through payroll.</p></div></section>
<section class="sec light on-light"><div class="wrap">{head("Payroll tax compliance", "Federal + 1 state base scope.", center=True)}
<div class="grid g4">{pricing([("1–5 workers", "1–5", "$125", "/month", ""), ("6–10 workers", "6–10", "$175", "/month", ""), ("11–25 workers", "11–25", "$250", "/month", ""), ("26–50 workers", "26–50", "$350", "/month", "")])}</div></div></section>
<section class="sec dark2"><div class="wrap">{head("Three different services", "Run it. File it. Record it.")}{cards([("Processing", "Run Payroll", "Recurring payroll processing within the selected worker tier."), ("Compliance", "Handle Payroll Taxes", "Payroll tax compliance is a separate service."), ("Bookkeeping", "Record Payroll", "Payroll bookkeeping records and reconciles payroll activity when included.")], 3)}</div></section>
<section class="sec charcoal"><div class="wrap" style="max-width:900px">{notice("Your payroll doesn’t stop at payday.", ["Payroll activity affects financial statements. Connecting payroll to bookkeeping keeps the financial side organized."])}</div></section>
{cta(f"Your team deserves a {gold('payroll system that works.')}")}''')

pages["record-expungement"] = page("Record Relief | MKB Financial Group", "Administrative help and document preparation for people seeking a record expungement. MKB is not a law firm and does not give legal advice.",
  hero("Record Relief", f"Help with the paperwork behind a {gold('fresh start.')}", "MKB Financial Group provides administrative assistance and document preparation for people pursuing a record expungement. We help you gather your information, request your records and prepare your paperwork — and we keep you updated along the way.", btn("Book a Consultation", "/contact"))
  + f'''<section class="sec dark2"><div class="wrap">{head("How we help", "Administrative assistance, step by step.")}{cards([("1", "Intake", "We collect your information and organize it in one place."), ("2", "Records requests", "We help you request the records and court documents needed for your paperwork."), ("3", "Document preparation", "We prepare your documents from the information you provide, for you to review before anything is used."), ("4", "Updates", "You can see where your paperwork stands in your client portal.")], 4)}</div></section>
<section class="sec dark"><div class="wrap" style="max-width:900px"><span class="eyebrow gold">Important</span>{notice("What we do — and what we don’t", ["MKB Financial Group provides administrative assistance and document preparation. MKB is not a law firm and does not provide legal advice or representation.", "We do not decide whether you are eligible for an expungement, and completing our intake does not mean you are eligible. Courts and agencies make their own determinations, and we cannot promise an outcome or a timeline.", "For legal advice about your situation, please consult a licensed attorney."])}</div></section>
<section class="sec cream on-light"><div class="wrap">{head("Questions", "Common questions.")}{faq([("Can you tell me if I’m eligible?", "No. We can’t determine eligibility or give legal advice. Eligibility is decided under the law that applies to your record, by the court or agency involved. For advice about your situation, consult a licensed attorney."), ("Do you guarantee my record will be expunged?", "No. Courts and agencies make their own decisions, and we cannot promise any outcome."), ("How long does it take?", "It depends on the agencies and courts involved, including how long records requests take. We can’t promise a timeframe, but you can follow your progress in your client portal."), ("Are you a law firm?", "No. MKB Financial Group is not a law firm and does not provide legal advice or representation.")])}</div></section>
{cta(f"Have questions about our {gold('record relief')} assistance?")}''')

pages["about"] = page("About MKB | MKB Financial Group", "MKB Financial Group helps business owners understand, organize and strengthen the financial side of their businesses.",
  hero("About MKB Financial Group", f"We didn’t build MKB just to {gold('file tax returns.')}", "MKB was built to help business owners understand, organize, and strengthen the financial side of their businesses.", btn("Book a Consultation", "/contact"), photo="founder-office-folder.webp")
  + f'''<section class="sec light on-light"><div class="wrap split"><div>{head("The why", "Business owners need more than a tax return.", "Running a business means making decisions constantly. MKB exists to help owners answer those questions with better financial information and organization.")}</div>
<div class="portrait framed"><img src="{M}founder-reading.webp" alt="The founder of MKB Financial Group reviewing documents" loading="lazy" width="1024" height="1536" style="aspect-ratio:4/4.4;object-position:center 20%"></div></div></section>
<section class="sec dark2"><div class="wrap">{head("The MKB philosophy", "Clarity. Organization. Strategy.", center=True)}<div class="grid g3">''' + "".join(f'<div class="card svc"><div class="ic">{icon(i, 34)}</div><span class="num">{n}</span><h3>{t}</h3><p>{b}</p></div>' for i, n, t, b in [("clarity", "Clarity", "Understand", "Know what is happening financially inside your business."), ("structure", "Organization", "Structure", "Keep financial information structured, accessible, and maintained."), ("ahead", "Strategy", "Think Ahead", "Use financial information to support future decisions.")]) + f'''</div></div></section>
<section class="sec charcoal"><div class="wrap split"><div class="portrait framed" style="max-width:460px"><img src="{M}founder-headshot.webp" alt="Portrait of the founder of MKB Financial Group" loading="lazy" width="583" height="572"></div>
<div><span class="eyebrow gold">Meet the founder</span><h2>Built with {gold("purpose.")}</h2><p class="lead">MKB Financial Group was built to help business owners navigate the financial side of building a business with greater clarity, organization, and support.</p><p class="quote">“Strategy. Growth. Legacy.”</p><div class="actions">{btn("Book a Consultation", "/contact")}</div></div></div></section>
<section class="sec cream on-light"><div class="wrap">{head("Who we serve", "Wherever you are in the journey.", center=True)}{cards([("01", "New Entrepreneurs", "Starting and establishing a financial foundation."), ("02", "Growing Businesses", "Building stronger systems as the business changes."), ("03", "Established Businesses", "Maintaining organization as complexity increases.")], 3)}</div></section>
{cta(f"You’re building something. Let’s build the {gold('foundation')} with it.")}''')

pages["resources"] = page("Resources | MKB Financial Group", "Bookkeeping basics, tax and payroll explainers, a business owner checklist and answers to common questions.",
  hero("MKB Resources", f"Understand your business beyond the {gold('bank balance.')}", "Practical information for business owners who want to understand their books, taxes, payroll, financial responsibilities, and the decisions that come with running a business.", btn("Free Tax Calculator", "/tax-calculator") + obtn("Book a Consultation", "/contact"))
  + f'''<section class="sec dark2"><div class="wrap">{head("Start here", "Resources built around the questions business owners actually ask.")}{cards([("01 • Bookkeeping", "Know your numbers.", "Learn how to read your P&L, Balance Sheet, Cash Flow, reconcile accounts, organize receipts, and understand what your books are telling you."), ("02 • Tax", "Prepare and plan.", "Understand tax documents, preparation, estimated-tax concepts, deductions, and why tax planning should happen before the filing deadline."), ("03 • Payroll", "Keep payroll organized.", "Learn the difference between payroll processing, payroll tax compliance, and payroll bookkeeping—and why each matters."), ("04 • Business", "Build the foundation.", "Business setup, financial systems, banking, QuickBooks organization, and the administrative practices that support growth.")], 4)}</div></section>
<section class="sec cream on-light"><div class="wrap">{head("Bookkeeping basics", "Your books are more than a record of what already happened.", "Use financial statements to understand revenue, expenses, profitability, cash position, and trends. Good bookkeeping gives you organized information to work from.")}{cards([("01", "Profit & Loss", "Understand income and expenses."), ("02", "Balance Sheet", "Understand what the business owns and owes."), ("03", "Cash Flow", "Understand how money moves."), ("04", "Reconciliations", "Make sure records agree with financial accounts.")], 4)}</div></section>
<section class="sec dark"><div class="wrap" style="max-width:900px"><span class="eyebrow gold">Tax & compliance</span>{notice("Tax season should not be the first time you look at your numbers.", ["Organized records make tax preparation easier to support. Planning is different from preparation: preparation reports what happened; planning considers future decisions and their potential tax effects.", "For specific tax advice, filing requirements, deadlines, or current law, work with your tax professional based on your circumstances."])}</div></section>
<section class="sec light on-light"><div class="wrap">{head("Business owner checklist", "A simple rhythm for staying on top of it.")}{cards([("Monthly", "Close the books.", "Reconcile accounts, review financial statements, categorize outstanding items, and identify unusual activity."), ("Quarterly", "Review the direction.", "Look at revenue, expenses, cash, profitability, and major changes in the business."), ("Annually", "Prepare for the next year.", "Organize tax documents, review systems, evaluate recurring costs, and plan the financial priorities ahead.")], 3)}</div></section>
<section class="sec cream on-light"><div class="wrap">{head("Frequently asked questions", "Quick answers.")}{faq([("What is bookkeeping?", "Bookkeeping is the ongoing organization and recording of financial activity so a business has reliable financial records."), ("How often should a business reconcile its accounts?", "Frequency depends on transaction volume and business needs. MKB’s core bookkeeping service is monthly, with biweekly and weekly upgrades available."), ("What financial statements should a business owner review?", "Common core statements include the Profit & Loss, Balance Sheet, and Cash Flow statement."), ("Is bookkeeping the same as tax preparation?", "No. Bookkeeping organizes financial records throughout the year. Tax preparation uses relevant financial and tax information to prepare and file a return."), ("Is payroll included with bookkeeping?", "Payroll processing and payroll tax compliance are separate services. Payroll bookkeeping addresses the recording and reconciliation of payroll activity."), ("Can MKB help if my books are behind?", "Yes. Catch-up and historical cleanup are available as separate, assessment-based services."), ("Can MKB tell me what I should do for my specific tax situation?", "MKB can explain the services it provides and help organize information. Specific tax advice depends on your circumstances and the scope of services engaged.")])}</div></section>
{cta(f"You don’t have to know everything about business. You just need to know {gold('where to start.')}")}''')

pages["contact"] = page("Book a Consultation | MKB Financial Group", "Tell MKB Financial Group about your business — we'll follow up within one business day.",
  hero("Book a Consultation", f"Let’s talk about {gold('your business.')}", "Tell us a little about yourself and what you need. We’ll follow up within one business day.", f'<a class="btn-outline" href="tel:8333793320">Call {PHONE}</a><a class="btn-outline" href="mailto:{EMAIL}">{EMAIL}</a>', photo="founder-standing.webp", short=True)
  + f'''<section class="sec cream on-light"><div class="wrap">{head("Contact MKB", "Tell us about your business.", f"Prefer to call? {PHONE} · {EMAIL}", center=True)}
<div class="formbox"><div data-mkb-widget="form" data-form="contact"></div></div></div></section>''')

pages["tax-calculator"] = page("Free Tax Calculator | MKB Financial Group", "Free tax estimator from MKB Financial Group — see what you might owe or get back.",
  hero("Free tax estimator", f"Refund or balance due? {gold('Get an estimate in minutes.')}", "Use our free tax calculator to see roughly what you might owe or get back this year. Tell us where to reach you and the calculator opens right away.", btn("Open the free calculator", "#start"), place=False)
  + f'''<section class="sec cream on-light" id="start"><div class="wrap">{head("", "Open the free calculator", "We’ll only use your details to follow up about your taxes. No obligation.", center=True)}
<div class="formbox"><div data-mkb-widget="form" data-form="tax-calculator" data-after="/calculator"></div></div></div></section>''', slim=True)

pages["calculator"] = page("Tax Calculator — Estimate | MKB Financial Group", "A basic tax calculator for a quick refund or balance-due estimate.",
  f'''<section class="sec dark2" style="padding-top:64px"><div class="wrap">{head("Tax calculator", f"Your {gold('estimate')}", "Enter your information below for a quick estimate.", center=True)}
<div class="embedbox"><iframe src="https://monarch-tax-suite.vercel.app/embed/calculator?id=emb_jEt4FwT-a2pO1bpdKhe7OQ" title="Basic Tax Calculator" loading="lazy" style="width:100%;height:1400px;border:0;display:block"></iframe></div></div></section>
{cta(f"Want an exact number? Let MKB {gold('prepare your return.')}", "Let’s Talk")}''', slim=True)

for slug, doc in pages.items():
  with open(os.path.join(OUT, (slug or "home") + ".html"), "w") as f:
    f.write(doc)
print("built", len(pages), "pages", {k or "home": len(v) for k, v in pages.items()})
