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
.site-header .bar{display:flex;align-items:center;gap:18px;height:92px}
.site-header .wrap{width:min(calc(100% - 40px),1400px)}
.brand img{height:74px;width:auto;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))}
.nav{display:flex;align-items:center;gap:4px;margin-left:auto;list-style:none;padding:0;margin-top:0;margin-bottom:0}
.nav>li{position:relative}
.nav>li>a,.nav>li>span{display:flex;align-items:center;gap:5px;padding:12px 8px;font:500 13px/1 var(--sans);color:#E9E2D2;cursor:pointer;white-space:nowrap}
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
.hero .photo{position:absolute;inset:0 0 0 auto;width:58%;background-size:cover;background-position:center top}
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
.portrait img{width:100%;height:100%;object-fit:cover;object-position:center top}
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
.faq{display:grid;gap:12px;max-width:880px;width:100%}
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

/* timeline, tables, resources */
.timeline{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;counter-reset:t}
.timeline .card{padding-top:30px}
.timeline .step{display:flex;align-items:center;gap:14px;margin-bottom:16px}
.timeline .step b{width:44px;height:44px;flex:none;display:grid;place-items:center;border-radius:50%;font:700 19px/1 var(--sans);color:#1B1306;text-shadow:0 1px 0 rgba(255,240,190,.6);background:var(--foil-sheen),var(--gold-foil);box-shadow:inset 0 1px 0 rgba(255,248,215,.8)}
.tbl{width:100%;border-collapse:collapse;font-size:15px}
.tbl th{text-align:left;font:700 11px/1 var(--sans);letter-spacing:.2em;text-transform:uppercase;color:#8A5F1D;padding:14px 16px;border-bottom:1px solid #D9CFBB}
.tbl td{padding:14px 16px;border-bottom:1px solid #E4DCCB;color:var(--ink-2);vertical-align:top}
.tbl td:first-child{white-space:nowrap;font:600 17px/1.3 var(--serif);color:var(--ink)}
.tblwrap{overflow-x:auto;border-radius:10px;background:#FFFDF8;border:1px solid #E4DCCB}
.jump{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.jump a{padding:10px 16px;border-radius:30px;font:600 13px/1 var(--sans);color:#E9E2D2;background:linear-gradient(#0D0C0B,#0D0C0B) padding-box,var(--gold-foil) border-box;border:1px solid transparent}
.jump a:hover{color:#F6DFA0}
.links-grid a{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 18px;border-radius:10px;background:#FFFDF8;border:1px solid #E4DCCB;color:var(--ink);font-weight:600}
.links-grid a small{display:block;font-weight:400;color:var(--ink-2);font-size:13px;margin-top:2px}
.links-grid a:hover{border-color:#C9A253}
.links-grid a svg{width:16px;height:16px;flex:none;color:#8A5F1D}
.check2{columns:2;column-gap:40px}
.check2 li{break-inside:avoid}
.printbtn{border:0;cursor:pointer}
@media print{.site-header,.site-footer,.cta,.hero,.jump,.printbtn{display:none!important}body{background:#fff;color:#000}.sec{padding:20px 0!important;background:#fff!important}}
@media (max-width:980px){.timeline{grid-template-columns:repeat(2,1fr)}.check2{columns:1}}
@media (max-width:640px){.timeline{grid-template-columns:1fr}}

/* ---------- secondary-page compositions ---------- */
.hero2{position:relative;overflow:hidden;padding:92px 0 96px;background:radial-gradient(110% 120% at 0% 0%,#24190b 0%,#0c0b09 46%,#070707 80%)}
.hero2::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(232,196,107,.035) 0 1px,transparent 1px 140px);pointer-events:none}
.hero2>.wrap{position:relative;display:grid;grid-template-columns:1.1fr .9fr;gap:70px;align-items:center}
.hero2.rev>.wrap{grid-template-columns:.9fr 1.1fr}.hero2.rev .frame{order:-1;justify-self:start}
.hero2 .lead{color:#D9D1C1;margin:22px 0 32px}
.frame{position:relative;width:100%;max-width:470px;justify-self:end;margin:0 22px 22px 0}
.frame::before{content:"";position:absolute;inset:22px -22px -22px 22px;border-radius:12px;padding:1px;background:var(--gold-foil);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
.frame img{position:relative;width:100%;height:auto;aspect-ratio:4/5;object-fit:cover;object-position:center top;border-radius:12px;box-shadow:0 40px 80px rgba(0,0,0,.6)}
.frame .tag{position:absolute;left:-34px;bottom:40px;max-width:250px;padding:18px 20px;border-radius:10px;background:linear-gradient(#0E0D0C,#0E0D0C) padding-box,var(--gold-foil) border-box;border:1px solid transparent;box-shadow:0 20px 40px rgba(0,0,0,.55)}
.frame .tag b{display:block;font:500 21px/1.2 var(--serif);color:#F4EBD6}
.frame .tag span{font-size:12.5px;color:#A49C8C}
.lines{display:grid;gap:0;border-top:1px solid #2a2722}
.lines>div{display:grid;grid-template-columns:70px 1fr;gap:20px;padding:26px 0;border-bottom:1px solid #2a2722}
.lines b{font:500 34px/1 var(--serif)}
.lines h3{font-size:24px;margin-bottom:6px}.lines p{margin:0;color:var(--text-2)}
.on-light .lines,.on-light .lines>div{border-color:#DDD3C0}.on-light .lines p{color:var(--ink-2)}
.duo{display:grid;grid-template-columns:1fr auto 1fr;gap:20px;align-items:stretch}
.split.wide-r{grid-template-columns:.85fr 1.15fr}
.split>*,.duo>*,.grid>*{min-width:0}
.duo .plus{align-self:center;font:500 54px/1 var(--serif)}
.duo a.card{display:flex;flex-direction:column;gap:12px}
.duo a.card .more{margin-top:auto;font:600 13px/1 var(--sans);color:#E8C46B;display:inline-flex;gap:8px;align-items:center}
.duo a.card .more svg{width:15px;height:15px}
.incl{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 34px;margin:0}
.tagline{display:inline-block;padding:5px 10px;border-radius:30px;font:700 10.5px/1.2 var(--sans);letter-spacing:.14em;text-transform:uppercase;color:#8A5F1D;background:rgba(201,162,83,.14);margin-left:8px;vertical-align:middle}
.paths{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.paths .card{display:flex;flex-direction:column;gap:10px}
.paths .card .actions{margin-top:auto;padding-top:18px}
.paths .card .actions a{width:100%}
.paths dl{margin:6px 0 0;display:grid;gap:0}
.paths dl div{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px dashed #DDD3C0;font-size:14.5px}
.paths dt{color:var(--ink-2)}.paths dd{margin:0;font-weight:600;color:var(--ink);white-space:nowrap}
.paths .opt{font:700 11px/1 var(--sans);letter-spacing:.24em;color:#8A5F1D}
.tabs{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:28px}
.tabs button{cursor:pointer;min-height:48px;padding:12px 20px;border-radius:30px;font:600 14px/1 var(--sans);color:var(--ink);background:#FFFDF8;border:1px solid #D9CFBB}
.tabs button[aria-selected="true"]{color:#1B1306;border-color:#8A5F1D;background:var(--foil-sheen),var(--gold-foil);box-shadow:inset 0 1px 0 rgba(255,248,215,.8)}
.pane[hidden]{display:none}
.t6{grid-template-columns:repeat(3,1fr)}
.tiles{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-top:38px;max-width:640px}
.tiles a{display:block;padding:22px 22px 20px;border-radius:10px;background:linear-gradient(#100F0D,#100F0D) padding-box,var(--gold-foil) border-box;border:1px solid transparent}
.tiles a b{display:block;font:500 24px/1.15 var(--serif);color:#F4EBD6;margin-bottom:6px}
.tiles a span{font-size:13.5px;color:#A49C8C}
.tiles a:hover b{color:#F6DFA0}
.tiles.three{grid-template-columns:repeat(3,1fr);max-width:none}
@media (max-width:980px){.tiles.three{grid-template-columns:1fr 1fr}}
@media (max-width:640px){.tiles.three{grid-template-columns:1fr}}
.statebox{display:grid;grid-template-columns:auto 1fr;gap:26px;align-items:center}
.statebox .seal{width:120px;height:120px;border-radius:50%;display:grid;place-items:center;text-align:center;font:700 12px/1.3 var(--sans);letter-spacing:.18em;color:#1B1306;background:var(--foil-sheen),var(--foil-grain),var(--gold-foil);box-shadow:inset 0 1px 0 rgba(255,248,215,.85),0 14px 30px rgba(0,0,0,.35)}
.strip{background:#0E0D0B;border-bottom:1px solid #2a2418;padding:16px 0;font-size:14px;color:#CFC6B4}
.strip .wrap{display:flex;flex-wrap:wrap;gap:10px 22px;align-items:center;justify-content:center}
.strip a{color:#E8C46B;font-weight:600}
@media (max-width:980px){
  .hero2>.wrap,.hero2.rev>.wrap{grid-template-columns:1fr;gap:56px}
  .hero2 .frame,.hero2.rev .frame{order:0;justify-self:center;max-width:420px}
  .frame .tag{left:-10px}
  .duo{grid-template-columns:1fr}.duo .plus{justify-self:center}
  .paths,.t6{grid-template-columns:1fr 1fr}
}
@media (max-width:640px){
  .hero2{padding:64px 0 72px}
  .frame{margin-right:16px}.frame::before{inset:16px -16px -16px 16px}
  .incl,.paths,.t6,.tiles{grid-template-columns:1fr}
  .lines>div{grid-template-columns:48px 1fr;gap:14px}
  .statebox{grid-template-columns:1fr;justify-items:start}
}

/* policy pages */
.prose{max-width:820px;margin:0 auto;font-size:16px;line-height:1.75;color:var(--ink-2)}
.prose h2{font-size:30px;margin:44px 0 12px;color:var(--ink)}
.prose h2:first-child{margin-top:0}
.prose p,.prose li{color:var(--ink-2)}
.prose ul{padding-left:22px;margin:0 0 16px}.prose li{margin:0 0 8px}
.prose a{color:#8A5F1D;font-weight:600;text-decoration:underline}
.prose .box{border-radius:10px;background:#FFFDF8;border:1px solid #E4DCCB;padding:18px 20px;margin:18px 0}
.prose .box p:last-child{margin-bottom:0}

/* funnel pages: no menu */
.slim .bar{justify-content:center}

/* ---------- responsive ---------- */
@media (max-width:1360px){.brand img{height:62px}.nav>li>a,.nav>li>span{padding:12px 6px;font-size:12.5px}.portal{padding:10px 12px}.site-header .metallic-gold-button{padding:10px 14px}}
@media (max-width:1240px){.nav,.header-cta{display:none}.mnav{display:block}.site-header .bar{height:84px}.brand img{height:62px}}
@media (max-width:980px){
  .g3,.g4,.g5{grid-template-columns:repeat(2,1fr)}
  .split{grid-template-columns:1fr;gap:42px}
  .foot{grid-template-columns:1fr 1fr}
  .hero{flex-direction:column;align-items:stretch}
  .hero .photo{position:relative;inset:auto;width:100%;height:460px;background-position:center top}
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

BFM = "/financial-management"
NAV = [
  ("Home", "/", None),
  ("About MKB", "/about", None),
  ("Financial Management", BFM, [("Overview", BFM, "Bookkeeping + payroll, one coordinated approach"), ("Bookkeeping", BFM + "#bookkeeping", "Monthly books & financial statements"), ("Payroll", BFM + "#payroll", "Processing, payroll tax & records"), ("Combined Services", BFM + "#combined", "Bookkeeping and payroll together"), ("Pricing", BFM + "#pricing", "Packages and quote requests")]),
  ("Business Solutions", "/business-services", None),
  ("Tax Services", "/tax-preparation", [("Tax Services", "/tax-preparation", "Preparation and planning"), ("Individual Tax Preparation", "/tax-preparation#individual", "Personal returns"), ("Business Tax Preparation", "/tax-preparation#business", "Business returns"), ("Free Tax Calculator", "/tax-calculator", "Refund / balance-due estimate")]),
  ("Record Relief", "/record-expungement", None),
  ("Contact", "/contact", None),
]

def header(slim=False):
  if slim:
    return f'<header class="site-header slim"><div class="wrap bar"><a class="brand" href="/" aria-label="MKB Financial Group home"><img src="{M}mkb-logo-header.webp" alt="MKB Financial Group" width="600" height="273"></a></div></header>'
  items = []
  for label, href, sub in NAV:
    if sub:
      subs = "".join(f'<li><a href="{h}">{e(l)}<small>{e(d)}</small></a></li>' for l, h, d in sub)
      top = f'<a href="{href}">{e(label)}{CARET}</a>' if href else f'<span tabindex="0">{e(label)}{CARET}</span>'
      items.append(f'<li>{top}<ul class="sub">{subs}</ul></li>')
    else:
      items.append(f'<li><a href="{href}">{e(label)}</a></li>')
  mob = []
  for label, href, sub in NAV:
    if sub:
      mob.append(f'<div class="grp">{e(label)}</div><div class="sub">' + "".join(f'<a href="{h}">{e(l)}</a>' for l, h, _ in sub) + '</div>')
    else:
      mob.append(f'<a href="{href}">{e(label)}</a>')
  return f'''<header class="site-header"><div class="wrap bar" style="position:relative">
<a class="brand" href="/" aria-label="MKB Financial Group home"><img src="{M}mkb-logo-header.webp" alt="MKB Financial Group" width="600" height="273"></a>
<nav aria-label="Main"><ul class="nav">{"".join(items)}</ul></nav>
<div class="header-cta"><a class="portal" href="{PORTAL}">{LOCK}Client Portal</a><a class="metallic-gold-button" href="/book-consultation">Book a Consultation</a></div>
<details class="mnav"><summary aria-label="Open menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></summary><div class="panel">{"".join(mob)}<div class="btns"><a class="metallic-gold-button" href="/book-consultation">Book a Consultation</a><a class="portal" href="{PORTAL}" style="justify-content:center">{LOCK}Client Portal</a></div></div></details>
</div></header>'''

def footer(slim=False):
  if slim:
    return f'<footer class="site-footer" style="padding:40px 0"><div class="wrap"><hr class="metallic-gold-divider"><div class="legal"><span>© 2026 MKB Financial Group. All rights reserved. · <a href="/privacy" style="color:inherit;text-decoration:underline">Privacy Policy</a> · <a href="/text-terms" style="color:inherit;text-decoration:underline">Text Message Terms</a></span><span>{PHONE} · {EMAIL}</span></div></div></footer>'
  return f'''<footer class="site-footer"><div class="wrap">
<div class="foot">
 <div><a class="logo" href="/"><img src="{M}mkb-logo-gold.webp" alt="MKB Financial Group — Strategy, Growth, Legacy" width="900" height="485"></a><p class="blurb">Professional financial services for entrepreneurs building something real.</p></div>
 <div><h4 class="metallic-gold-text">Services</h4><a href="/financial-management">Financial Management</a><a href="/bookkeeping">Bookkeeping</a><a href="/payroll">Payroll</a><a href="/business-services">Business Solutions</a><a href="/tax-preparation">Tax Services</a><a href="/record-expungement">Record Relief</a></div>
 <div><h4 class="metallic-gold-text">Explore</h4><a href="/about">About MKB</a><a href="/tax-calculator">Tax Calculator</a><a href="/get-started">Get Started</a><a href="/book-consultation">Book a Consultation</a><a href="/contact">Contact</a><a href="{PORTAL}">Client Portal Sign In</a></div>
 <div><h4 class="metallic-gold-text">Contact</h4><a href="tel:8333793320">{PHONE}</a><a href="mailto:{EMAIL}">{EMAIL}</a><p>Louisiana • Texas • Virtual</p>
  <div class="social"><a href="{FB}" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><svg viewBox="0 0 24 24"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/></svg></a><a href="{IG}" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg></a></div>
 </div>
</div>
<hr class="metallic-gold-divider" style="margin-top:56px"><div class="legal" style="margin-top:0"><span>© 2026 MKB Financial Group. All rights reserved. · <a href="/privacy" style="color:inherit;text-decoration:underline">Privacy Policy</a> · <a href="/text-terms" style="color:inherit;text-decoration:underline">Text Message Terms</a></span><span class="metallic-gold-text" style="letter-spacing:.28em;font-weight:600;font-size:11.5px">STRATEGY • GROWTH • LEGACY</span></div>
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

def hero2(eyebrow, title_html, lead, actions, photo, tag=None, rev=False, alt="The founder of MKB Financial Group"):
  t = f'<div class="tag"><b>{tag[0]}</b><span>{tag[1]}</span></div>' if tag else ""
  return f'''<section class="hero2{" rev" if rev else ""}"><div class="wrap"><div class="copy">
<span class="eyebrow gold">{e(eyebrow)}</span>
<h1>{title_html}</h1>
<p class="lead">{lead}</p>
<div class="actions">{actions}</div>
<div class="place">LOUISIANA<i>•</i>TEXAS<i>•</i>VIRTUAL</div>
</div><div class="frame"><img src="{M}{photo}" alt="{e(alt)}" width="1024" height="1536">{t}</div></div></section>'''

def lines(items):
  return '<div class="lines">' + "".join(f'<div><b class="metallic-gold-text">{n}</b><div><h3>{e(t)}</h3><p>{b}</p></div></div>' for n, t, b in items) + '</div>'

def cards(items, cols, num_fmt=None):
  out = []
  for i, (lbl, title, body) in enumerate(items):
    out.append(f'<div class="card">{f"<span class=\"num\">{e(lbl)}</span>" if lbl else ""}<h3>{e(title)}</h3><p>{e(body)}</p></div>')
  return f'<div class="grid g{cols}">{"".join(out)}</div>'

def cta(title, label="Book a Consultation", href="/book-consultation"):
  return f'<section class="cta"><div class="wrap"><div><h2>{title}</h2><p>Strategy • Growth • Legacy</p></div>{btn(label, href)}</div></section>'

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
  ("books", "Financial Management", "Bookkeeping + Payroll", "Organized books and reliable payroll — on their own or managed together.", "/financial-management"),
  ("biz", "Business Solutions", "Business Formation + Administrative Support", "Build the structure behind the business.", "/business-services"),
  ("tax", "Tax Services", "Individual + Business Tax Preparation", "Prepare today and think ahead.", "/tax-preparation"),
  ("relief", "MKB Record Relief", "Expungement Administrative Assistance", "Administrative help with the paperwork behind a fresh start.", "/record-expungement"),
]
svc_cards = '<div class="grid g4">' + "".join(f'<div class="card svc"><div class="ic">{icon(i, 34)}</div><span class="num" style="margin:0">{e(sub)}</span><h3>{e(t)}</h3><p>{e(b)}</p><a class="more" href="{h}">Learn more {ARROW}</a></div>' for i, t, sub, b, h in SERVICES) + '</div>'

pages[""] = page("MKB Financial Group | Strategy • Growth • Legacy", "Business financial management (bookkeeping + payroll), business solutions, tax services and record relief for entrepreneurs in Louisiana, Texas and virtually.",
  hero("MKB Financial Group", f"The business you’ve built deserves a {gold('stronger financial foundation.')}",
       "Bookkeeping, business services, tax preparation and payroll for owners who are serious about what they’re building. MKB helps entrepreneurs start right, stay organized, plan strategically, and grow intentionally.",
       btn("Explore Our Services", "#services") + obtn("Book a Consultation", "/book-consultation"), photo="founder-desk-seated.webp")
  + f'''<section class="sec dark2" id="services"><div class="wrap">{head("What we do", "Everything the financial side of your business needs.", "Four service divisions, one team — so your books, payroll, taxes and paperwork work together.", center=True)}{svc_cards}</div></section>
<section class="sec light on-light"><div class="wrap split"><div>{head("The MKB perspective", "Starting a business is easy. Building one is different.", "", rule=False)}<p class="lead">Your business has financial records to maintain, taxes to plan for, payroll responsibilities to manage, numbers to track, and decisions to make. MKB helps connect those pieces.</p><hr class="rule"></div>
<div class="grid g2">''' + "".join(f'<div class="card"><span class="num">{n}</span><h3>{t}</h3><p>{b}</p></div>' for n, t, b in [("01 / Thinking", "Thinking", "You have an idea and are preparing to launch."), ("02 / Starting", "Starting", "You’ve formed the business and need to understand what comes next."), ("03 / Building", "Building", "You’re operating and need organized financial systems."), ("04 / Understanding", "Understanding", "You need to know what your numbers are telling you."), ("05 / Planning", "Planning", "You want to think about taxes before they become urgent."), ("06 / Growing", "Growing", "You’re ready to make informed decisions and pursue growth.")]) + f'''</div></div></section>
<section class="sec charcoal"><div class="wrap split"><div class="portrait framed tall"><img src="{M}founder-standing.webp" alt="The founder of MKB Financial Group in her office" loading="lazy" width="1024" height="1536"></div>
<div><span class="eyebrow gold">About MKB</span><h2>We didn’t build MKB just to {gold("file tax returns.")}</h2><p class="lead">MKB was built to help business owners understand, organize, and strengthen the financial side of their businesses.</p>
<ul class="ticks"><li>Clarity — know what is happening financially inside your business.</li><li>Organization — keep financial information structured, accessible, and maintained.</li><li>Strategy — use financial information to support future decisions.</li></ul>
<div class="actions" style="margin-top:32px">{btn("Meet MKB", "/about")}</div></div></div></section>
<section class="band"><div class="wrap"><div><strong>Bookkeeping</strong><span>Know your numbers</span></div><div><strong>Tax</strong><span>Prepare today, think ahead</span></div><div><strong>Payroll</strong><span>Keep your people organized</span></div></div></section>
<section class="sec cream on-light"><div class="wrap grid g2" style="gap:30px">
<div class="card"><span class="num">BOOKKEEPING</span><h3 style="font-size:34px">Know your numbers.</h3><p>Monthly bookkeeping gives you organized records, financial statements, and visibility throughout the year.</p><div class="actions" style="margin-top:22px">{obtn("Bookkeeping & payroll", "/financial-management")}</div></div>
<div class="card"><span class="num">TAX</span><h3 style="font-size:34px">Tax preparation looks back. Tax planning looks ahead.</h3><p>Your return tells you what happened. Planning gives you an opportunity to think about what comes next.</p><div class="actions" style="margin-top:22px">{obtn("Tax services", "/tax-preparation")}{obtn("Free tax calculator", "/tax-calculator")}</div></div>
</div></section>
{cta(f"You’re building a business. Let’s build the {gold('financial foundation')} with it.")}''')

pages["about"] = page("About MKB | MKB Financial Group", "MKB Financial Group helps business owners understand, organize and strengthen the financial side of their businesses.",
  hero("About MKB Financial Group", f"We didn’t build MKB just to {gold('file tax returns.')}", "MKB was built to help business owners understand, organize, and strengthen the financial side of their businesses.", btn("Book a Consultation", "/book-consultation"), photo="founder-office-folder.webp")
  + f'''<section class="sec light on-light"><div class="wrap split"><div>{head("The why", "Business owners need more than a tax return.", "Running a business means making decisions constantly. MKB exists to help owners answer those questions with better financial information and organization.")}</div>
<div class="portrait framed"><img src="{M}founder-reading.webp" alt="The founder of MKB Financial Group reviewing documents" loading="lazy" width="1024" height="1536" style="aspect-ratio:4/4.4;object-position:center 20%"></div></div></section>
<section class="sec dark2"><div class="wrap">{head("The MKB philosophy", "Clarity. Organization. Strategy.", center=True)}<div class="grid g3">''' + "".join(f'<div class="card svc"><div class="ic">{icon(i, 34)}</div><span class="num">{n}</span><h3>{t}</h3><p>{b}</p></div>' for i, n, t, b in [("clarity", "Clarity", "Understand", "Know what is happening financially inside your business."), ("structure", "Organization", "Structure", "Keep financial information structured, accessible, and maintained."), ("ahead", "Strategy", "Think Ahead", "Use financial information to support future decisions.")]) + f'''</div></div></section>
<section class="sec charcoal"><div class="wrap split"><div class="portrait framed" style="max-width:460px"><img src="{M}founder-headshot.webp" alt="Portrait of the founder of MKB Financial Group" loading="lazy" width="583" height="572"></div>
<div><span class="eyebrow gold">Meet the founder</span><h2>Built with {gold("purpose.")}</h2><p class="lead">MKB Financial Group was built to help business owners navigate the financial side of building a business with greater clarity, organization, and support.</p><p class="quote">“Strategy. Growth. Legacy.”</p><div class="actions">{btn("Book a Consultation", "/book-consultation")}</div></div></div></section>
<section class="sec cream on-light"><div class="wrap">{head("Who we serve", "Wherever you are in the journey.", center=True)}{cards([("01", "New Entrepreneurs", "Starting and establishing a financial foundation."), ("02", "Growing Businesses", "Building stronger systems as the business changes."), ("03", "Established Businesses", "Maintaining organization as complexity increases.")], 3)}</div></section>
{cta(f"You’re building something. Let’s build the {gold('foundation')} with it.")}''')

EXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>'
def links(items): return '<div class="grid g2 links-grid">' + "".join(f'<a href="{h}" target="_blank" rel="noopener noreferrer"><span>{e(t)}<small>{e(d)}</small></span>{EXT}</a>' for t, d, h in items) + '</div>'
def table(rows, cols): return '<div class="tblwrap"><table class="tbl"><thead><tr>' + "".join(f"<th>{c}</th>" for c in cols) + '</tr></thead><tbody>' + "".join("<tr>" + "".join(f"<td>{e(c)}</td>" for c in r) + "</tr>" for r in rows) + '</tbody></table></div>'

# ============================================================ Financial Management (flagship)
BK_TIERS = [("Foundation", "Foundation", "$399", "/mo", "Up to 150 transactions • 3 financial accounts"), ("Essential", "Essential", "$549", "/mo", "Up to 400 transactions • 5 financial accounts"), ("Growth", "Growth", "$749", "/mo", "Up to 750 transactions • 8 financial accounts"), ("Advanced", "Advanced", "$999+", "/mo", "Up to 1,500 transactions • 12 financial accounts")]
BK_NOTE = "Internal bank transfers are excluded from transaction counts. Monthly completion is within 10 days; statements are delivered by the 5th day after the 10-day completion period."
BK_ADDONS = [("+$50/mo", "Additional Financial Account", "Per additional account."), ("+$150/mo", "Biweekly Upgrade", "Upgrade the bookkeeping cadence."), ("+$300/mo", "Weekly Upgrade", "Upgrade the bookkeeping cadence."), ("From $150/mo", "Additional Entity/Location", "Pricing varies by complexity."), ("Separate scope", "Catch-Up & Cleanup", "Assessment-based services."), ("Separate scope", "A/P & A/R", "Recording services available by volume.")]
BK_BOUNDARY = "Standard bookkeeping does not automatically include priority/expedited service, unlimited communication, financial analysis, advisory, consulting, additional reporting, or cleanup/catch-up work."
PR_TIERS = [("1–5 workers", "Starter", "$175", "/month", "Recurring payroll processing for 1–5 workers. Includes employees, contractors paid through payroll, and owners processed through payroll."), ("6–10 workers", "Growing", "$275", "/month", "Recurring payroll processing for 6–10 workers with the same core processing scope."), ("11–25 workers", "Expanding", "$425", "/month", "Recurring payroll processing for 11–25 workers as payroll volume increases."), ("26–50 workers", "Established", "$650", "/month", "Recurring payroll processing for 26–50 workers. Higher-volume payroll requires an organized recurring process.")]
PR_COMP = [("1–5 workers", "Starter Compliance", "$125", "/month", "Payroll tax compliance for teams of 1–5 workers. Federal and one state included."), ("6–10 workers", "Growing Compliance", "$175", "/month", "Payroll tax compliance for teams of 6–10 workers. Federal and one state included."), ("11–25 workers", "Expanding Compliance", "$250", "/month", "Payroll tax compliance for teams of 11–25 workers. Federal and one state included."), ("26–50 workers", "Established Compliance", "$350", "/month", "Payroll tax compliance for teams of 26–50 workers. Federal and one state included.")]
PR_NOTE = "Worker count includes employees, contractors paid through payroll, and owners processed through payroll. Owner draws/distributions remain bookkeeping transactions unless the owner is processed through payroll."

def addon_table():
  return table([(a, b, c) for a, b, c in [(t, p, d) for p, t, d in BK_ADDONS]], ["Add-on", "Price", "Details"])

def scope_table():
  return table([
    ("Payroll processing", "Recurring payroll runs on your schedule for employees, contractors paid through payroll, and owners processed through payroll — with payroll reports and organized payroll records.", "Included in every payroll package · $175–$650/month by worker tier"),
    ("Payroll tax compliance", "Payroll tax administration for federal and one state.", "Separate service — add it to processing · $125–$350/month by worker tier"),
    ("Additional states", "Payroll tax compliance beyond the one included state.", "Scoped separately"),
    ("Payroll bookkeeping", "Recording and reconciling payroll activity in your books.", "Coordinated with your bookkeeping engagement · scoped with it"),
    ("More than 50 workers", "Payroll for larger teams.", "Quoted separately"),
  ], ["Service", "What it covers", "How it’s included"])

BFM_FAQ = [
  ("Can I purchase payroll without bookkeeping?", "Yes. Payroll is available on its own. Payroll processing is priced by the number of workers, starting at $175/month, and payroll tax compliance can be added as a separate service."),
  ("Can I add payroll to my bookkeeping package later?", "Yes. You can start with bookkeeping and add payroll whenever you’re ready. We’ll scope it with you and add it to your service agreement at our standard payroll pricing."),
  ("Can I purchase bookkeeping without payroll?", "Yes. Bookkeeping packages start at $399/month and don’t require payroll."),
  ("How does monthly bookkeeping work?", "Each month we record and categorize your transactions, reconcile your accounts, and close the month. Monthly completion is within 10 days, and your Profit & Loss, Balance Sheet and Cash Flow statements are delivered by the 5th day after that 10-day completion period."),
  ("What happens if my books are behind?", "Catch-up and cleanup are available as separate, assessment-based services. We review where your books stand and scope the work before monthly bookkeeping begins."),
  ("What payroll information is required to get started?", "After you sign on, we collect what we need — such as your business details, pay schedule, worker information and pay rates, prior payroll reports if you’re switching providers, and your payroll tax account details if compliance is included. All of it is collected securely through your client portal, never through a public website form."),
  ("Do you handle payroll tax filings?", "Payroll tax compliance is a separate service from payroll processing. Its base scope covers federal and one state, priced by the size of your team; additional states are scoped separately. Your service agreement lists exactly what is included."),
  ("Can MKB support multiple business entities?", "Yes. Additional entity or location support starts at $150/month, depending on complexity, and each entity’s records are kept separate."),
  ("How do I get started?", "Choose a pathway below — Bookkeeping, Payroll, or Bookkeeping + Payroll — or book a consultation. We follow up within one business day."),
]

PATHWAYS_JS = """<script>(function(){var ids=["bookkeeping","payroll","combined"];function show(k,scroll){ids.forEach(function(i){var b=document.getElementById("tab-"+i),p=document.getElementById("start-"+i);if(!b||!p)return;var on=i===k;b.setAttribute("aria-selected",on?"true":"false");p.hidden=!on;});if(scroll){var g=document.getElementById("get-started");if(g)g.scrollIntoView({behavior:"smooth",block:"start"});}}
document.querySelectorAll("[data-path]").forEach(function(b){b.addEventListener("click",function(){show(b.getAttribute("data-path"),false);});});
function fromHash(){var m=location.hash.match(/^#start-(bookkeeping|payroll|combined)$/);if(m)show(m[1],true);}window.addEventListener("hashchange",fromHash);fromHash();})();</script>"""

pages["financial-management"] = page("Financial Management | MKB Financial Group", "Bookkeeping and payroll for small businesses — on their own or together. Monthly bookkeeping from $399/month and payroll from $175/month. Louisiana, Texas and virtual.",
  hero2("Financial Management", f"Your business deserves more than someone {gold('keeping the books.')}", "From organized financial records to reliable payroll operations, MKB helps business owners manage the financial side of their business with greater clarity and confidence.",
        btn("Book a Consultation", "/book-consultation") + obtn("Explore Services", "#overview"), "founder-office-folder.webp", tag=("Bookkeeping + Payroll", "Purchase either one on its own — or both, together."))
  + f'''<section class="sec dark2" id="overview"><div class="wrap split wide-r" style="align-items:start"><div>{head("Introduction", "Better financial management starts with better organization.", "", rule=False)}<p class="lead">Bookkeeping and payroll are connected parts of running a healthy business. Every payroll you run shows up in your books — and your books are only as clear as the payroll records behind them.</p><p class="lead">MKB offers both as two service lines. Choose the one you need, or let us manage them together.</p><hr class="rule"></div>
<div class="duo"><a class="card svc" href="#bookkeeping"><div class="ic">{icon("books", 34)}</div><span class="num" style="margin:0">Service line 01</span><h3>Bookkeeping</h3><p>Monthly books, reconciliations and financial statements — so you know your numbers.</p><span class="more">See bookkeeping {ARROW}</span></a><span class="plus metallic-gold-text" aria-hidden="true">+</span><a class="card svc" href="#payroll"><div class="ic">{icon("payroll", 34)}</div><span class="num" style="margin:0">Service line 02</span><h3>Payroll</h3><p>Payroll processing, records and optional payroll tax compliance — available on its own.</p><span class="more">See payroll {ARROW}</span></a></div></div></section>

<section class="sec cream on-light" id="bookkeeping"><div class="wrap"><div class="split" style="align-items:start;margin-bottom:54px"><div>{head("Bookkeeping", "Know your numbers. Understand your business.", "Professional monthly bookkeeping that gives you organized records, clear financial statements, and visibility throughout the year.")}</div>
<div class="card"><span class="num">WHAT BOOKKEEPING COVERS</span><ul class="ticks incl"><li>Monthly bookkeeping</li><li>Bank and credit card reconciliation</li><li>Financial statement preparation — P&amp;L, Balance Sheet, Cash Flow</li><li>Income and expense categorization</li><li>Monthly financial reporting and month-end close</li><li>Catch-up bookkeeping <span class="tagline">Separate scope</span></li><li>Bookkeeping cleanup <span class="tagline">Separate scope</span></li><li>Additional entity support <span class="tagline">From $150/mo</span></li></ul></div></div>
<div class="grid g4">{pricing(BK_TIERS, featured_idx=1)}</div>
<p class="note center">{BK_NOTE}</p>
<div class="split" style="margin-top:46px;align-items:start;gap:40px"><div>{addon_table()}</div><div>{notice("A minimalist service with clear boundaries.", [BK_BOUNDARY])}<div class="actions" style="margin-top:24px">{btn("Explore Bookkeeping Packages", "/bookkeeping")}{obtn("Get a quote", "#start-bookkeeping")}{obtn("Ready? Start your intake", "/get-started#bookkeeping")}</div></div></div></div></section>

<section class="sec charcoal" id="payroll"><div class="wrap"><div class="split" style="align-items:start;margin-bottom:50px"><div>{head("Payroll", f"Your people deserve a payroll process {gold('that works.')}", "Payroll is available on its own — you don’t need bookkeeping to use it — or as an addition to your bookkeeping.")}</div>
<div class="card"><span class="num">WHAT PAYROLL COVERS</span><ul class="ticks incl"><li>Payroll processing</li><li>Employee payroll administration</li><li>Payroll schedule management</li><li>Payroll reporting</li><li>Payroll tax administration, where included in your contracted service</li><li>Payroll record organization</li><li>Payroll bookkeeping coordination</li></ul></div></div>
<span class="eyebrow gold">Included vs. separately scoped</span><h3 style="font-size:30px;margin-bottom:20px">Exactly what each payroll service covers.</h3><div class="on-light">{scope_table()}</div><p class="note" style="color:#A49C8C">{PR_NOTE}</p></div></section>
<section class="sec light on-light"><div class="wrap">{head("Payroll pricing", "Priced by the size of your team.", "Payroll processing and payroll tax compliance are two separate services. Choose processing on its own, or pair it with compliance.", center=True)}
<span class="eyebrow gold">Full payroll processing</span><div class="grid g4">{pricing(PR_TIERS)}</div>
<span class="eyebrow gold" style="margin-top:46px">Payroll tax compliance · federal + 1 state</span><div class="grid g4">{pricing(PR_COMP)}</div>
<div class="actions" style="margin-top:34px;justify-content:center">{btn("Get Started With Payroll", "/get-started#payroll")}{obtn("Get a payroll quote", "#start-payroll")}{obtn("Payroll details", "/payroll")}</div></div></section>

<section class="sec dark" id="combined"><div class="wrap split" style="align-items:start"><div>{head("Combined services", f"One business. Two essential financial functions. {gold('One coordinated approach.')}", "When MKB handles both your bookkeeping and your payroll, the two work from the same information — and you work with one team.")}
<div class="actions">{btn("Combine My Services", "#start-combined")}</div>
<div class="portrait framed" style="max-width:400px;margin-top:44px"><img src="{M}founder-desk-seated.webp" alt="The founder of MKB Financial Group at her desk" loading="lazy" width="1024" height="1536" style="aspect-ratio:5/4;object-position:center 20%"></div></div>
<div>{lines([("01", "Better coordination", "Payroll and bookkeeping are handled by the same team, so payroll activity is recorded the way it was actually run."), ("02", "More organized records", "Payroll records and financial records are kept together and stay consistent."), ("03", "Easier month-end reconciliation", "Payroll reports are already in hand when it’s time to reconcile and close the month."), ("04", "Visibility into labor costs", "See what your team costs in the same financial statements you use to run the business."), ("05", "A streamlined process", "One onboarding, one secure client portal and one set of document requests."), ("06", "One service relationship", "One point of contact for both — no going back and forth between providers.")])}
<p class="note" style="color:#8F8778">Results depend on each business. Combined service is about coordination — we don’t promise specific savings.</p></div></div></section>

<section class="sec dark2"><div class="wrap">{head("How it works", "From first conversation to ongoing support.", "", center=True)}
<div class="timeline t6">''' + "".join(f'<div class="card"><div class="step"><b>{n}</b></div><h3>{t}</h3><p>{b}</p></div>' for n, t, b in [("1", "Initial consultation", "We talk through your business, how it runs today and what you need help with."), ("2", "Business & service assessment", "We review your volume, accounts, entities, team size and the condition of your books."), ("3", "Package selection", "You choose bookkeeping, payroll or both, with pricing based on our approved packages."), ("4", "Secure onboarding", "We collect documents and payroll details through your secure client portal."), ("5", "Service activation", "Your books and/or payroll are set up and your first cycle is scheduled."), ("6", "Ongoing financial support", "Monthly bookkeeping, payroll on your schedule, and reports you can use.")]) + f'''</div></div></section>

<section class="sec cream on-light" id="pricing"><div class="wrap">{head("Pricing", "Choose the arrangement that fits your business.", "Bookkeeping and payroll can each be purchased on its own. Or request one combined quote for both.", center=True)}
<div class="paths">
<div class="card"><span class="opt">OPTION 1</span><h3>Bookkeeping only</h3><p>Monthly bookkeeping packages by transaction volume and number of accounts.</p><dl>''' + "".join(f'<div><dt>{n}</dt><dd>{a}/mo</dd></div>' for _, n, a, _, _ in BK_TIERS) + f'''</dl><div class="actions">{btn("Start bookkeeping inquiry", "#start-bookkeeping", arrow=False)}</div></div>
<div class="card"><span class="opt">OPTION 2</span><h3>Payroll only</h3><p>Payroll processing by worker count. Payroll tax compliance (federal + 1 state) is optional.</p><dl>''' + "".join(f'<div><dt>{t}</dt><dd>{a}/mo</dd></div>' for t, _, a, _, _ in PR_TIERS) + f'''<div><dt>+ Tax compliance</dt><dd>from $125/mo</dd></div></dl><div class="actions">{btn("Start payroll inquiry", "#start-payroll", arrow=False)}</div></div>
<div class="card price featured"><span class="flag">BOTH SERVICES</span><span class="opt">OPTION 3</span><h3>Bookkeeping + Payroll</h3><p>Request one combined quote. It’s built from our approved bookkeeping and payroll pricing for your volume, accounts and team size — so you see exactly what each part costs.</p><ul class="ticks"><li>One onboarding and one client portal</li><li>Payroll recorded in your books by the same team</li><li>Payroll tax compliance optional</li></ul><div class="actions">{btn("Request a combined quote", "#start-combined", arrow=False)}</div></div>
</div></div></section>

<section class="sec light on-light" id="get-started"><div class="wrap">{head("Get started", "Tell us what you need.", "Pick a pathway and answer a few quick questions. We’ll follow up within one business day. Please don’t send employee or payroll details here — we collect those securely in your client portal after onboarding.", center=True)}
<div class="tabs" role="tablist"><button type="button" role="tab" id="tab-bookkeeping" data-path="bookkeeping" aria-selected="true">Bookkeeping only</button><button type="button" role="tab" id="tab-payroll" data-path="payroll" aria-selected="false">Payroll only</button><button type="button" role="tab" id="tab-combined" data-path="combined" aria-selected="false">Bookkeeping + Payroll</button></div>
<div class="formbox"><div class="pane" id="start-bookkeeping" role="tabpanel"><div data-mkb-widget="form" data-form="bookkeeping-inquiry"></div></div><div class="pane" id="start-payroll" role="tabpanel" hidden><div data-mkb-widget="form" data-form="payroll-inquiry"></div></div><div class="pane" id="start-combined" role="tabpanel" hidden><div data-mkb-widget="form" data-form="combined-inquiry"></div></div></div></div></section>

<section class="sec cream on-light"><div class="wrap">{head("Questions", "Frequently asked questions.", center=True)}<div style="display:grid;justify-items:center">{faq(BFM_FAQ)}</div></div></section>
<section class="cta"><div class="wrap"><div><h2>Let’s put the financial side of your business {gold('in order.')}</h2><p>Strategy • Growth • Legacy</p></div><div class="actions">{btn("Book a Consultation", "/book-consultation")}{obtn("Explore Services", "#overview")}</div></div></section>
{PATHWAYS_JS}''')

STRIP = lambda what, anchor: f'<div class="strip"><div class="wrap"><span>{what} is part of <b>Financial Management</b> — available on its own or together with {"payroll" if what == "Bookkeeping" else "bookkeeping"}.</span><a href="/financial-management#{anchor}">See it in Financial Management →</a></div></div>'

# ============================================================ Bookkeeping (lightweight landing page — keeps old links working)
pages["bookkeeping"] = page("Bookkeeping | MKB Financial Group", "Monthly bookkeeping packages from $399/month: reconciliations, P&L, Balance Sheet and Cash Flow. Part of MKB Financial Management.",
  STRIP("Bookkeeping", "bookkeeping")
  + hero("Bookkeeping", f"Your books should help you {gold('run your business.')}", "Professional monthly bookkeeping designed to give business owners organized records, clearer financial statements, and better visibility throughout the year.", btn("Start a bookkeeping inquiry", "/financial-management#start-bookkeeping") + obtn("See packages", "#packages"), short=True)
  + f'''<section class="sec dark2"><div class="wrap">{head("What MKB bookkeeping does", "Organized records. Clear statements.")}{cards([("01", "Monthly Bookkeeping", "Recurring organization and recording of financial activity within the agreed scope."), ("02", "Reconciliation", "Financial account reconciliation as part of the monthly close process."), ("03", "Financial Statements", "P&L, Balance Sheet, and Cash Flow as standard statements.")], 3)}</div></section>
<section class="sec cream on-light" id="packages"><div class="wrap">{head("Bookkeeping packages", "Choose the package that fits your volume.", "Includes: monthly bookkeeping, account reconciliations, P&L, Balance Sheet, Cash Flow, month-end close, financial record organization, and standard bookkeeping support.", center=True)}
<div class="grid g4">{pricing(BK_TIERS, featured_idx=1)}</div>
<p class="note center">{BK_NOTE}</p></div></section>
<section class="sec light on-light"><div class="wrap">{head("Add-ons", "Extend your package as you grow.")}{cards([(p, t, d) for p, t, d in BK_ADDONS], 3)}</div></section>
<section class="sec dark"><div class="wrap" style="max-width:900px">{notice("A minimalist service with clear boundaries.", [BK_BOUNDARY])}<div class="actions" style="margin-top:26px">{btn("Start your bookkeeping", "/get-started#bookkeeping")}{obtn("Get a quote first", "/financial-management#start-bookkeeping")}{obtn("Add payroll too", "/financial-management#combined")}</div></div></section>
{cta(f"Your books should {gold('work for your business.')}")}''')

# ============================================================ Payroll (lightweight landing page — keeps old links working)
pages["payroll"] = page("Payroll | MKB Financial Group", "Payroll processing from $175/month, payroll tax compliance and payroll bookkeeping. Part of MKB Financial Management.",
  STRIP("Payroll", "payroll")
  + hero("Payroll", f"Keep payroll moving. {gold('Keep your business organized.')}", "MKB helps business owners keep payroll processing, payroll records, and payroll-related responsibilities organized as the business grows. Available on its own — no bookkeeping required.", btn("Get Started With Payroll", "/financial-management#start-payroll") + obtn("See pricing", "#pricing"), short=True)
  + f'''<section class="sec cream on-light" id="pricing"><div class="wrap">{head("Full payroll processing", "Priced by the size of your team.", center=True)}
<div class="grid g4">{pricing(PR_TIERS)}</div>
<p class="note center">{PR_NOTE}</p></div></section>
<section class="sec light on-light"><div class="wrap">{head("Payroll tax compliance", "Stay on top of payroll taxes.", "Federal + 1 state base scope, priced by the size of your team.", center=True)}
<div class="grid g4">{pricing(PR_COMP)}</div>
<p class="note center">Payroll tax compliance is a separate service from payroll processing. Pair it with a processing package to keep payroll and payroll taxes handled together.</p></div></section>
<section class="sec dark2"><div class="wrap">{head("Three different services", "Run it. File it. Record it.")}{cards([("Processing", "Run Payroll", "Recurring payroll processing within the selected worker tier."), ("Compliance", "Handle Payroll Taxes", "Payroll tax compliance is a separate service."), ("Bookkeeping", "Record Payroll", "Payroll bookkeeping records and reconciles payroll activity when included.")], 3)}
<div class="on-light" style="margin-top:34px">{scope_table()}</div></div></section>
<section class="sec charcoal"><div class="wrap" style="max-width:900px">{notice("Your payroll doesn’t stop at payday.", ["Payroll activity affects financial statements. Connecting payroll to bookkeeping keeps the financial side organized."])}<div class="actions" style="margin-top:26px">{btn("Get Started With Payroll", "/get-started#payroll")}{obtn("Get a quote first", "/financial-management#start-payroll")}{obtn("Combine with bookkeeping", "/financial-management#combined")}</div></div></section>
{cta(f"Your team deserves a {gold('payroll system that works.')}")}''')

# ============================================================ Business Solutions
pages["business-services"] = page("Business Solutions | MKB Financial Group", "Business formation, EIN assistance, registrations, annual reports, compliance tracking and business documentation support.",
  hero2("Business Solutions", f"Build your business with the {gold('right foundation.')}", "From forming your business to keeping it in good standing, MKB helps you handle the paperwork, filings and deadlines that come with owning a business — so you can focus on running it.",
        btn("Start your filing", "/get-started#business") + obtn("Book a Consultation", "/book-consultation"), "founder-standing.webp", tag=("Formation → Good standing", "Paperwork, filings and deadlines, handled."), rev=True)
  + f'''<section class="sec dark2" id="formation"><div class="wrap split" style="align-items:start"><div>{head("01 — Formation", f"Start on the {gold('right foundation.')}", "The first filings set the shape of your business. We prepare and submit them with you, step by step.")}</div>
<div>{lines([("01", "LLC & Corporation Formation", "Name availability check, preparation and submission of your formation documents, and EIN assistance."), ("02", "EIN Application", "Help completing and submitting your IRS Employer Identification Number application."), ("03", "Registrations & Changes", "Trade names, registering in another state, amendments, name changes and dissolutions.")])}</div></div></section>
<section class="sec cream on-light"><div class="wrap split" style="align-items:start"><div>{head("02 — Good standing", "Deadlines tracked. Filings handled.", "Once you’re formed, the state still expects to hear from you. We keep the calendar for you.")}</div>
<div>{lines([("A", "Annual Reports", "Preparation and submission of your state annual report or registration."), ("B", "Licenses & Deadlines", "Tracking of business licenses, permits and state deadlines, with reminders before they are due."), ("C", "Registered Agent Coordination", "Coordinating a registered agent appointment or change with the provider and the state.")])}</div></div></section>
<section class="sec charcoal"><div class="wrap split"><div class="portrait framed" style="max-width:460px"><img src="{M}founder-headshot.webp" alt="The founder of MKB Financial Group" loading="lazy" width="583" height="572"></div>
<div>{head("03 — Documentation & administration", "Records that keep up with the business.", "", rule=False)}<ul class="ticks"><li><b style="color:#F4EBD6">Operating agreements</b> — administrative preparation from a standard template and your instructions.</li><li><b style="color:#F4EBD6">Resolutions &amp; records</b> — resolutions for actions your members or board approved.</li><li><b style="color:#F4EBD6">Business record book</b> — your formation papers, filings and records organized in one place.</li><li><b style="color:#F4EBD6">Administrative support</b> — filings prepared and submitted for you, with updates in your client portal.</li></ul></div></div></section>
<section class="sec dark"><div class="wrap" style="max-width:900px">{notice("Administrative support — not legal advice.", ["MKB prepares and submits paperwork on your behalf using the information you provide, and prepares documents from standard templates and your instructions. MKB is not a law firm and does not provide legal advice. State and government filing fees are separate and are confirmed for your state before anything is filed."])}<div class="actions" style="margin-top:26px">{btn("Start your filing", "/get-started#business")}{obtn("Book a Consultation", "/book-consultation")}{obtn("Add bookkeeping & payroll", "/financial-management")}</div></div></section>
{cta(f"Your business deserves a {gold('solid structure.')} Let’s build it.")}''')

# ============================================================ Tax Services
pages["tax-preparation"] = page("Tax Services | MKB Financial Group", "Individual and business tax preparation, tax document organization and year-round tax planning.",
  f'''<section class="hero plain"><div class="glow"></div><div class="wrap"><div class="copy" style="max-width:760px">
<span class="eyebrow gold">Tax Services</span>
<h1>Tax preparation looks back. {gold('Tax planning looks ahead.')}</h1>
<p class="lead">MKB helps clients organize tax preparation while keeping the bigger financial picture in view. Choose your pathway.</p>
<div class="tiles"><a href="#individual"><b>Individual</b><span>Personal tax preparation and document organization →</span></a><a href="#business"><b>Business</b><span>Business returns supported by organized books →</span></a></div>
<div class="actions" style="margin-top:28px">{btn("Start your tax prep", "/get-started#tax")}{obtn("Book a Consultation", "/book-consultation")}{obtn("Free tax calculator", "/tax-calculator")}</div>
<div class="place">LOUISIANA<i>•</i>TEXAS<i>•</i>VIRTUAL</div>
</div></div></section>
<section class="sec cream on-light" id="individual"><div class="wrap split" style="align-items:start"><div>{head("Pathway 01 — Individuals", "Individual tax preparation.", "Professional preparation and guidance based on your circumstances and MKB’s return scope.")}
<div class="actions">{btn("Start your tax prep", "/get-started#tax")}{obtn("Estimate my refund", "/tax-calculator")}</div></div>
<div class="card"><span class="num">HOW WE HELP</span><ul class="ticks"><li>Preparation of your personal return within MKB’s return scope.</li><li>Help understanding which documents you need — and gathering what’s missing.</li><li>A review of your return with you before it’s filed.</li><li>Your documents and return kept organized in your secure client portal.</li></ul></div></div></section>
<section class="sec dark2" id="business"><div class="wrap split" style="align-items:start"><div>{head("Pathway 02 — Business owners", f"Business tax preparation, {gold('built on organized books.')}", "Business tax preparation supported by organized financial information and documentation.")}
<div class="actions">{btn("Start your tax prep", "/get-started#tax")}{obtn("Bookkeeping & payroll", "/financial-management")}</div></div>
<div>{lines([("01", "Business returns", "Preparation of your business return using organized financial information."), ("02", "Tax document organization", "Help understanding the information and documentation needed for preparation."), ("03", "Better books, easier tax time", "When books are organized throughout the year, tax preparation doesn’t have to begin with reconstructing what happened months ago.")])}</div></div></section>
<section class="sec charcoal"><div class="wrap split"><div class="portrait framed" style="max-width:460px"><img src="{M}founder-reading.webp" alt="The founder of MKB Financial Group reviewing documents" loading="lazy" width="1024" height="1536" style="aspect-ratio:4/4.2;object-position:center 18%"></div>
<div>{head("Tax planning & strategy", f"Don’t wait until tax season to {gold('think about taxes.')}", "Understand what is affecting your tax position, think through relevant financial decisions, and keep information organized for filing.", rule=True)}</div></div></section>
<section class="sec cream on-light"><div class="wrap">{head("The tax process", "Three clear steps.", center=True)}{cards([("01", "Get Started", "Tell us about yourself and/or your business."), ("02", "Organize & Review", "Gather documentation and address missing information."), ("03", "Prepare & File", "Complete preparation, final review, approval, and filing.")], 3)}</div></section>
{cta(f"Your taxes are part of your business. {gold('Let’s treat them that way.')}")}''')

# ============================================================ MKB Record Relief (Louisiana only)
RR_FAQ = [
  ("Which states do you serve for record relief?", "Right now, MKB Record Relief is available for Louisiana records only. If your record is in another state, we aren’t able to help with it at this time."),
  ("Can you tell me if I’m eligible?", "No. We can’t determine eligibility or give legal advice. Eligibility is decided under the law that applies to your record, by the court or agency involved. For advice about your situation, consult a licensed attorney."),
  ("Do you guarantee my record will be expunged?", "No. Courts and agencies make their own decisions, and we cannot promise any outcome."),
  ("How long does it take?", "It depends on the agencies and courts involved, including how long records requests take. We can’t promise a timeframe, but you can follow your progress in your client portal."),
  ("Are you a law firm?", "No. MKB Financial Group is not a law firm and does not provide legal advice or representation. We provide administrative assistance and document preparation."),
  ("Will you go to court with me?", "No. We don’t represent anyone in court or before an agency. If you need representation, we’ll recommend that you contact a licensed attorney."),
  ("How do I send you my documents?", "Through your secure client portal. Please don’t email or text copies of your records — we’ll send you a portal invitation once you’re a client."),
  ("What does it cost?", "We’ll go over our fees before any work begins. Court and agency fees, if any, are separate."),
]
pages["record-expungement"] = page("MKB Record Relief | MKB Financial Group", "Administrative assistance and document preparation for people seeking a record expungement in Louisiana. MKB is not a law firm and does not give legal advice.",
  hero("MKB Record Relief", f"Your next chapter deserves a {gold('clear path forward.')}", "MKB Record Relief provides administrative assistance and document preparation for people pursuing a record expungement in Louisiana. We help you gather your information, request your records and prepare your paperwork — and we keep you updated along the way.", btn("Start your paperwork", "/get-started#record-relief") + obtn("Book a Consultation", "/book-consultation") + obtn("How it works", "#how"), photo="founder-reading.webp", place=False)
  + f'''<section class="band"><div class="wrap"><div><strong>Louisiana records</strong><span>Currently the only state we serve</span></div><div><strong>Administrative help</strong><span>Not legal advice or representation</span></div><div><strong>Secure portal</strong><span>Documents and updates in one place</span></div></div></section>

<section class="sec dark2"><div class="wrap split" style="align-items:start"><div>{head("Overview", "Organized help for a paperwork-heavy process.", "Record relief involves forms, records requests, deadlines and follow-up. We handle the administrative side so you can stay focused on moving forward.")}</div>
<div>{lines([("01", "Who it’s for", "People with an arrest or conviction record in Louisiana who want help organizing the paperwork."), ("02", "What we provide", "Administrative assistance, records requests and document preparation from the information you give us."), ("03", "What we don’t", "Legal advice, eligibility decisions or representation in court — those require a licensed attorney.")])}</div></div></section>

<section class="sec cream on-light" id="states"><div class="wrap"><div class="card statebox"><div class="seal">LOUISIANA<br>ONLY</div><div><span class="eyebrow gold">State-specific availability</span><h3 style="font-size:32px">We currently assist with Louisiana records only.</h3><p>MKB Record Relief is available for records in Louisiana. If your record is in another state — including Texas — we aren’t able to assist with it at this time. If that changes, we’ll update this page.</p></div></div></div></section>

<section class="sec light on-light"><div class="wrap split" style="align-items:start"><div>{head("Administrative assistance", "What we take off your plate.", "")}
<ul class="ticks"><li>Organizing your information and case details in one place.</li><li>Helping you request the records and court documents your paperwork needs.</li><li>Preparing your documents from the information you provide, for you to review before anything is used.</li><li>Keeping track of what’s been requested, received and prepared.</li><li>Status updates in your client portal, step by step.</li></ul></div>
<div class="card"><span class="num">DOCUMENT ORGANIZATION</span><h3>What to have ready</h3><ul class="ticks"><li>A government-issued photo ID.</li><li>Your current contact information.</li><li>Any court papers, case numbers or arrest records you already have.</li><li>The parish and approximate dates of the record you&rsquo;re asking about.</li><li>Your questions — write them down so we can go over them together.</li></ul><p style="margin-top:14px">Don&rsquo;t have everything? That&rsquo;s okay — helping you request what&rsquo;s missing is part of the process.</p></div></div></section>

<section class="sec dark2" id="how"><div class="wrap">{head("Intake process", "Step by step, with you informed at every stage.", "", center=True)}
<div class="timeline">''' + "".join(f'<div class="card"><div class="step"><b>{n}</b>{icon(ic, 32)}</div><h3>{t}</h3><p>{b}</p></div>' for n, ic, t, b in [("1", "clarity", "Consultation", "We confirm your record is in Louisiana, explain what we can and can’t do, and go over fees."), ("2", "tax", "Secure intake", "You complete your intake and upload what you have through your secure client portal."), ("3", "structure", "Records & preparation", "We help request missing records and prepare your documents for your review."), ("4", "ahead", "Updates", "You follow each step in your portal, and we let you know when your paperwork is ready.")]) + f'''</div></div></section>

<section class="sec charcoal"><div class="wrap split"><div class="portrait framed" style="max-width:460px"><img src="{M}founder-headshot.webp" alt="The founder of MKB Financial Group" loading="lazy" width="583" height="572"></div>
<div><span class="eyebrow gold">Secure document collection</span><h2>Your records stay {gold("private.")}</h2><p class="lead">Your court papers and personal records are sensitive. We collect them only through your secure client portal — never through a public website form, email or text.</p><ul class="ticks"><li>You get a private portal invitation once you’re a client.</li><li>Upload documents straight from your phone or computer.</li><li>See what we’ve requested and what’s still needed.</li></ul><div class="actions" style="margin-top:28px"><a class="portal" href="{PORTAL}">{LOCK}Client Portal Sign In</a></div></div></div></section>

<section class="sec light on-light"><div class="wrap split" style="align-items:start"><div>{head("Attorney referral process", "When you need a lawyer, we’ll tell you.", "Some questions can only be answered by a licensed attorney — like whether you’re eligible, what to do about a denial, or anything that needs representation.")}</div>
<div>{lines([("01", "We flag it", "If your situation needs legal advice or representation, we’ll tell you plainly instead of guessing."), ("02", "We point you to a licensed attorney", "We’ll recommend that you contact a licensed Louisiana attorney. The Louisiana State Bar Association can help you find one."), ("03", "Your paperwork stays organized", "With your permission, we can provide the documents we’ve organized to the attorney you choose.")])}
<p class="note">MKB does not receive referral fees and does not partner with attorneys. Louisiana State Bar Association: <a href="https://www.lsba.org" target="_blank" rel="noopener noreferrer" style="color:#8A5F1D;font-weight:600">lsba.org</a></p></div></div></section>

<section class="sec dark"><div class="wrap" style="max-width:920px"><span class="eyebrow gold">Service limitations</span>{notice("What we do — and what we don’t", ["MKB Financial Group provides administrative assistance and document preparation. MKB is not a law firm and does not provide legal advice or representation.", "We do not decide whether you are eligible for an expungement, and completing our intake does not mean you are eligible. Courts and agencies make their own determinations, and we cannot promise an outcome or a timeline.", "We currently assist with Louisiana records only.", "For legal advice about your situation, please consult a licensed attorney."])}</div></section>

<section class="sec cream on-light"><div class="wrap">{head("Questions", "Frequently asked questions.", center=True)}<div style="display:grid;justify-items:center">{faq(RR_FAQ)}</div></div></section>
{cta(f"Ready to get your paperwork {gold('organized?')}", "Start your paperwork", "/get-started#record-relief")}''')

pages["contact"] = page("Contact | MKB Financial Group", "Have a question for MKB Financial Group? Send a message — no appointment needed. We reply within one business day.",
  hero("Contact MKB", f"Let’s talk about {gold('your business.')}", "Have a question? Send us a message — no appointment needed. We’ll reply within one business day. Ready to talk through our services? Book a consultation call.", btn("Book a Consultation", "/book-consultation") + f'<a class="btn-outline" href="tel:8333793320">Call {PHONE}</a><a class="btn-outline" href="mailto:{EMAIL}">{EMAIL}</a>', photo="founder-standing.webp", short=True)
  + f'''<section class="sec cream on-light"><div class="wrap">{head("Ask a question", "Send us a message.", f"No appointment needed — we’ll reply within one business day. Prefer to call? {PHONE} · {EMAIL}", center=True)}
<div class="formbox"><div data-mkb-widget="form" data-form="contact"></div></div></div></section>''')


pages["book-consultation"] = page("Book a Consultation | MKB Financial Group", "Request a consultation with MKB Financial Group. Tell us when works for you and we'll reach out within one business day to confirm a time.",
  hero2("Book a Consultation", f"Let’s find a time to {gold('talk.')}", "Schedule a call to discuss our services and what your business needs. Tell us what you’d like to talk about and when works best — we’ll reach out within one business day to confirm your consultation time.",
        btn("Request my consultation", "#request") + f'<a class="btn-outline" href="tel:8333793320">Call {PHONE}</a>', "founder-headshot.webp", tag=("Phone or video", "Louisiana, Texas and virtual clients."))
  + f'''<section class="sec dark2"><div class="wrap split" style="align-items:start"><div>{head("What to expect", "Three simple steps.", "No obligation — the consultation is a call to discuss your business and the MKB services that fit.")}<p class="lead">Just have a quick question? <a href="/contact" style="color:#E8C46B;font-weight:600">Send us a message instead →</a></p></div>
<div>{lines([("01", "Send your request", "Choose what you’d like to talk about and the days and times that work for you."), ("02", "We confirm a time", "We reach out by phone or email within one business day to confirm your consultation."), ("03", "Meet with MKB", "We talk through your business, answer your questions and recommend next steps.")])}</div></div></section>
<section class="sec cream on-light" id="request"><div class="wrap">{head("Request a consultation", "When works for you?", f"Prefer to call? {PHONE} · {EMAIL}", center=True)}
<div class="formbox"><div data-mkb-widget="form" data-form="consultation-request"></div></div>
<p class="note center">Please don’t include Social Security numbers, account numbers or case details here — we’ll collect anything sensitive securely in your client portal.</p></div></section>''')


START = [("tax", "Tax preparation", "tax", "start-tax-prep", "We email you a private link to your secure tax interview."),
         ("bookkeeping", "Bookkeeping", "books", "start-bookkeeping", "We email you a private link to your secure bookkeeping intake."),
         ("payroll", "Payroll", "payroll", "start-payroll", "We reach out within one business day to set up payroll."),
         ("business", "Business Solutions", "biz", "start-business-solutions", "We confirm what’s needed and the state fees before filing."),
         ("record-relief", "Record Relief", "relief", "start-record-relief", "Louisiana records. We reach out to talk through next steps.")]
START_JS = """<script>(function(){var ids=%s;function show(k,scroll){ids.forEach(function(i){var b=document.getElementById("tab-"+i),p=document.getElementById(i);if(!b||!p)return;var on=i===k;b.setAttribute("aria-selected",on?"true":"false");p.hidden=!on;});if(scroll){var g=document.getElementById("start");if(g)g.scrollIntoView({behavior:"smooth",block:"start"});}}
document.querySelectorAll("[data-path]").forEach(function(b){b.addEventListener("click",function(){show(b.getAttribute("data-path"),false);history.replaceState(null,"","#"+b.getAttribute("data-path"));});});
function fromHash(){var k=location.hash.slice(1);if(ids.indexOf(k)>-1)show(k,true);}window.addEventListener("hashchange",fromHash);fromHash();})();</script>""" % ("[" + ",".join(f'"{k}"' for k, *_ in START) + "]")

pages["get-started"] = page("Get Started | MKB Financial Group", "Start tax preparation, bookkeeping, payroll, business filings or Record Relief with MKB Financial Group. Secure intake links are emailed to you — nothing sensitive is collected on this page.",
  f'''<section class="hero plain"><div class="glow"></div><div class="wrap"><div class="copy" style="max-width:820px">
<span class="eyebrow gold">Get Started</span>
<h1>Ready to begin? {gold('Start here.')}</h1>
<p class="lead">Choose your service and tell us how to reach you. For tax preparation and bookkeeping, your private, secure intake link arrives by email within minutes — sensitive details are only ever collected there, never on a public page.</p>
<div class="tiles three">''' + "".join(f'<a href="#{k}"><b>{t}</b><span>{d}</span></a>' for k, t, _, _, d in START) + f'''</div>
<div class="place">LOUISIANA<i>•</i>TEXAS<i>•</i>VIRTUAL</div>
</div></div></section>
<section class="sec cream on-light" id="start"><div class="wrap">{head("Start a service", "Which service are you starting?", "Not ready to start? <a href=\"/book-consultation\" style=\"color:#8A5F1D;font-weight:600\">Book a consultation</a> or <a href=\"/contact\" style=\"color:#8A5F1D;font-weight:600\">send us a question</a>.", center=True)}
<div class="tabs" role="tablist">''' + "".join(f'<button type="button" role="tab" id="tab-{k}" data-path="{k}" aria-selected="{"true" if i == 0 else "false"}">{t}</button>' for i, (k, t, _, _, _) in enumerate(START)) + '''</div>
<div class="formbox">''' + "".join(f'<div class="pane" id="{k}" role="tabpanel"{"" if i == 0 else " hidden"}><div data-mkb-widget="form" data-form="{slug}"></div></div>' for i, (k, _, _, slug, _) in enumerate(START)) + f'''</div></div></section>
{START_JS}''')


EFFECTIVE = "November 12, 2026"
def policy(slug, title, desc, eyebrow, h1, lead, body):
  pages[slug] = page(f"{title} | MKB Financial Group", desc,
    f'''<section class="hero plain short"><div class="glow"></div><div class="wrap"><div class="copy" style="max-width:820px">
<span class="eyebrow gold">{eyebrow}</span><h1>{h1}</h1><p class="lead">{lead}</p><p class="place" style="margin-top:22px">EFFECTIVE {EFFECTIVE.upper()}</p></div></div></section>
<section class="sec light on-light"><div class="wrap"><div class="prose">{body}</div></div></section>''')

policy("privacy", "Privacy Policy", "How MKB Financial Group collects, uses, protects and shares your information, including text messaging.", "Privacy Policy", f"Your information, {gold('handled with care.')}",
  "How MKB Financial Group collects, uses, protects and shares personal information — on our website, in our client portal, and by email and text.", f'''
<h2>Who we are</h2>
<p>MKB Financial Group (“MKB,” “we,” “us”) provides business financial management (bookkeeping and payroll), business solutions, tax services and record relief administrative assistance to clients in Louisiana, Texas and virtually. You can reach us at <a href="tel:8333793320">{PHONE}</a> or <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>

<h2>Information we collect</h2>
<ul>
<li><b>Information you give us on our website:</b> your name, email, phone number, business name and details, the services you&rsquo;re interested in, and anything you write in a form.</li>
<li><b>Information you give us to provide our services:</b> through your secure client portal or a private intake link, such as tax, payroll, bookkeeping, business and identity information and documents. Sensitive numbers (for example Social Security numbers, EINs and bank account numbers) are encrypted when stored.</li>
<li><b>Communication preferences:</b> whether you agreed to receive marketing emails or text messages, and when and how you agreed or opted out.</li>
<li><b>Basic technical information:</b> such as your browser type and pages visited, and whether a marketing email was opened or a link in it was clicked.</li>
</ul>

<h2>How we use information</h2>
<ul>
<li>To respond to your requests and provide, manage and bill for the services you engage us for.</li>
<li>To send service messages, such as intake links, document requests, reminders, receipts and replies to your questions.</li>
<li>To send marketing emails and text messages — only as described below, and you can opt out at any time.</li>
<li>To protect our clients and our business, and to meet legal, tax and regulatory obligations.</li>
</ul>

<h2>Text messaging</h2>
<div class="box">
<p><b>No mobile information will be shared with third parties or affiliates for marketing or promotional purposes.</b> Information sharing with subcontractors in support services, such as customer service, is permitted. All other categories in this policy exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.</p>
</div>
<p>We send marketing text messages only to people who agreed to receive them, for example by checking the optional text consent box on our website forms or by texting START to our number. Message frequency varies. Message and data rates may apply. Reply <b>HELP</b> for help or <b>STOP</b> to opt out at any time. See our <a href="/text-terms">Text Message Terms</a>.</p>

<h2>How we share information</h2>
<p>We do not sell your personal information. We share it only:</p>
<ul>
<li>With service providers who help us operate — for example secure hosting, email and text message delivery, payment processing, and tax and accounting software — and only as needed to provide their services to us.</li>
<li>With government agencies, courts or others when you ask us to file or request something on your behalf, or when required by law.</li>
<li>With your permission, for example with an attorney or another professional you ask us to work with.</li>
</ul>
<p>Tax return information is kept confidential and is used or disclosed only as federal law allows, or with your written consent.</p>

<h2>How we protect information</h2>
<p>We use encryption, access controls, sign-in verification and activity logs to protect your information. Sensitive documents are shared through your secure client portal — we never ask you to email Social Security numbers, bank account numbers or tax documents. No system is perfectly secure, so please contact us right away if you believe your information has been misused.</p>

<h2>Your choices</h2>
<ul>
<li><b>Email:</b> use the unsubscribe link in any marketing email.</li>
<li><b>Text messages:</b> reply STOP to any message. Reply START to resubscribe.</li>
<li><b>Your information:</b> contact us to review, correct or ask us to delete your information. Some records must be kept for a period of time by law.</li>
</ul>

<h2>Keeping information</h2>
<p>We keep information as long as needed to provide our services and to meet legal, tax and professional record-keeping requirements, then securely delete it.</p>

<h2>Children</h2>
<p>Our website and services are not directed to children under 13, and we do not knowingly collect their information online.</p>

<h2>Changes to this policy</h2>
<p>We may update this policy. The effective date at the top shows when it last changed.</p>

<h2>Contact us</h2>
<p>MKB Financial Group · <a href="tel:8333793320">{PHONE}</a> · <a href="mailto:{EMAIL}">{EMAIL}</a></p>
''')

policy("text-terms", "Text Message Terms", "Terms for MKB Financial Group text messages: what we send, how often, HELP and STOP.", "Text Message Terms", f"Text messages from {gold('MKB Financial Group.')}",
  "What to expect when you agree to get text messages from us — and how to get help or stop them at any time.", f'''
<div class="box">
<p><b>MKB Financial Group text messages.</b> Message frequency varies (typically 2–4 messages per month). Message and data rates may apply. Reply <b>HELP</b> for help. Reply <b>STOP</b> to cancel at any time.</p>
</div>

<h2>What we send</h2>
<p>Tax season and deadline reminders, tips for business owners, offers for our services, and replies to questions you send us by text.</p>

<h2>How you sign up</h2>
<p>By checking the optional text consent box on one of our website forms (for example at <a href="/get-started">mkbfinancialgroup.com/get-started</a>), or by texting <b>START</b> to our number. Agreeing to receive text messages is not a condition of buying any service.</p>

<h2>How to stop</h2>
<p>Reply <b>STOP</b> to any message (STOPALL, UNSUBSCRIBE, CANCEL, END and QUIT also work). You&rsquo;ll get one message confirming you&rsquo;re unsubscribed, and no more messages after that. To start again, reply <b>START</b>.</p>

<h2>How to get help</h2>
<p>Reply <b>HELP</b> to any message, call <a href="tel:8333793320">{PHONE}</a>, or email <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>

<h2>Costs and delivery</h2>
<p>Message and data rates may apply according to your mobile plan. Carriers are not liable for delayed or undelivered messages.</p>

<h2>Privacy</h2>
<p>No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. Text messaging opt-in data and consent will not be shared with any third parties. Read our full <a href="/privacy">Privacy Policy</a>.</p>
''')

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
