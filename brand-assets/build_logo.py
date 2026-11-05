"""Solid-letter MKB logo for light (and dark) backgrounds.

The plain brightness cutout makes the darker gold streaks inside the letters
semi-transparent. Here we build a letter-shape mask instead: threshold the
bright gold, close small gaps (fills internal streaks), grow by a few px to
keep the dark bevel outline, and anti-alias. Inside the mask the original
colors are kept fully opaque; the background glow outside is dropped.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

src, out_dir, core, close, grow, deepen = sys.argv[1], sys.argv[2], float(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), float(sys.argv[6])
im = Image.open(src).convert("RGB")
a = np.asarray(im).astype(np.float32)
L = a.max(axis=2)

# Letter pixels are saturated orange-gold (almost no blue) or near-white bevel
# highlights; the background glow is a duller, grayer brown.
R, B = a[:, :, 0], a[:, :, 2]
letter = ((R > core) & (B < 0.25 * R)) | (L > 240)
m = Image.fromarray((letter * 255).astype(np.uint8), "L")
# Close gaps strongly in the big MKB letters, gently in the small text below.
SPLIT = 690
top = m.crop((0, 0, m.width, SPLIT)).filter(ImageFilter.MaxFilter(close)).filter(ImageFilter.MinFilter(close))
if grow > 1:  # keep the dark bevel outline on the big letters only
    top = top.filter(ImageFilter.MaxFilter(grow))
top = top.filter(ImageFilter.GaussianBlur(1.2))
# Small "FINANCIAL GROUP" text: gold only, no outline, softer edge.
bot = Image.fromarray((((a[:, :, 0] > 150) & (a[:, :, 2] < 0.45 * a[:, :, 0])) * 255).astype(np.uint8)[SPLIT:], "L")
bot = bot.filter(ImageFilter.GaussianBlur(0.8))
m = Image.new("L", m.size); m.paste(top, (0, 0)); m.paste(bot, (0, SPLIT))
alpha = np.asarray(m).astype(np.float32)

rgb = a * deepen  # slightly richer gold for contrast on white
rgba = np.dstack([np.clip(rgb, 0, 255), alpha]).astype(np.uint8)
full = Image.fromarray(rgba, "RGBA")

def crop(img, thresh=40, pad=4):
    al = np.asarray(img)[:, :, 3]
    ys, xs = np.where(al > thresh)
    return img.crop((max(xs.min() - pad, 0), max(ys.min() - pad, 0), xs.max() + pad + 1, ys.max() + pad + 1))

def fit_w(img, w):
    return img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)

sidebar = fit_w(crop(full.crop((0, 0, full.width, 765))), 480)
mono = crop(full.crop((0, 0, full.width, 690)))
mono = mono.resize((round(mono.width * 96 / mono.height), 96), Image.LANCZOS)
lockup = fit_w(crop(full), 1200)
sidebar.save(f"{out_dir}/mkb-logo-sidebar.png")
mono.save(f"{out_dir}/mkb-monogram.png")
lockup.save(f"{out_dir}/mkb-logo-full.png")
print("sidebar", sidebar.size, "mono", mono.size)

# previews on white and on dark rail
for name, bgc in [("white", (255, 255, 255, 255)), ("dark", (16, 26, 46, 255))]:
    bg = Image.new("RGBA", (sidebar.width + 40, sidebar.height + 40), bgc)
    bg.alpha_composite(sidebar, (20, 20))
    bg.convert("RGB").save(f"{out_dir}/prev-{name}.png")
