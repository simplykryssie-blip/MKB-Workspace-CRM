"""Builds the vault intro images from the owner's photo (orig.png, 1672x941):
  plate.jpg  - the room with the open door removed (doorway frame completed by mirroring)
  door.png   - a closed, front-facing door made from the photo's own frame ring, metal and hand wheel
  wheel.png  - the photo's hand wheel, straightened (spins separately)
  inner.png  - the photographed door face, straightened (back of the swinging door)
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

im = Image.open("orig.png").convert("RGB")
A = np.asarray(im).astype(np.float32)
H, W = A.shape[:2]
CX, CY = 1097.0, 470.0  # doorway centre


def bilinear(img, xs, ys):
    xs = np.clip(xs, 0, img.shape[1] - 1.001); ys = np.clip(ys, 0, img.shape[0] - 1.001)
    x0 = np.floor(xs).astype(int); y0 = np.floor(ys).astype(int); fx = (xs - x0)[..., None]; fy = (ys - y0)[..., None]
    a = img[y0, x0]; b = img[y0, x0 + 1]; c = img[y0 + 1, x0]; d = img[y0 + 1, x0 + 1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy

# ---------------------------------------------------------------- clean plate
plate = A.copy()
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
left = xx < CX
src_x = 2 * CX - xx
wall = left & (src_x > W - 2)
mir = left & ~wall
plate[mir] = bilinear(A, src_x[mir], yy[mir])
# far-left wall: repeat the right-hand wall strip (x 1606..1670), ping-pong to hide seams
strip0, sw = 1606, 64
k = ((W - 2 - src_x[wall]) % (2 * sw)); k = np.where(k > sw, 2 * sw - k, k)
plate[wall] = bilinear(A, strip0 + k, yy[wall])
# soften the seam between mirrored and repeated wall
p = Image.fromarray(plate.clip(0, 255).astype(np.uint8))
seam = Image.new("L", (W, H), 0); ImageDraw.Draw(seam).rectangle((int(2 * CX - W) - 14, 0, int(2 * CX - W) + 14, H), fill=255)
p = Image.composite(p.filter(ImageFilter.GaussianBlur(6)), p, seam.filter(ImageFilter.GaussianBlur(8)))
p.save("plate.jpg", quality=86)

# ---------------------------------------------------------------- closed door (front)
R = 430
S = 2 * R
dy, dx = np.mgrid[0:S, 0:S].astype(np.float32)
dx -= R; dy -= R
r = np.hypot(dx, dy); th = np.degrees(np.arctan2(dy, dx))  # 0 = right, -90 = top
# Source angle: ping-pong over the frame's clean right-hand arc (-95deg .. +40deg).
# Every quarter of the door mirrors the frame's cleanest quarter (top-right): seamless and symmetric.
t = (th + 90) % 180; t = np.where(t > 90, 180 - t, t); th_s = np.radians(-90 + t)

def sample_ring(rs):
    return bilinear(A, CX + rs * np.cos(th_s), CY + rs * np.sin(th_s))

out = np.zeros((S, S, 3), np.float32)
# outer bolted ring: a copy of the doorway frame (lip, metal, bolts)
ring = r >= 318
rs = 398 + (r - 318) * (503 - 398) / (430 - 318)
out[ring] = sample_ring(rs)[ring]
# groove
g = (r >= 300) & (r < 318)
out[g] = sample_ring(np.full_like(r, 425.0))[g] * 0.22
# inner plate: smooth concentric brushed metal in the frame's own colour, with the conic sheen brushed metal has
inner = r < 300
ringcol = sample_ring(np.full_like(r, 470.0))[r >= 318].reshape(-1, 3)
base = np.median(ringcol, axis=0) * np.array([1.06, 0.94, 0.78], np.float32)
rng = np.random.default_rng(7)
grain = np.convolve(rng.normal(0, 1, 2000), np.ones(3) / 3, mode="same")
gr = grain[np.clip(r * 3, 0, 1999).astype(int)]
sheen = 0.50 + 0.42 * np.abs(np.cos(np.radians(th - 45))) ** 3 + 0.08 * np.cos(np.radians(th + 135))
plate_v = base[None, None, :] * (sheen * (1 + 0.035 * gr))[..., None] * (0.86 + 0.14 * (r / 300))[..., None]
out[inner] = plate_v[inner]
# a second bolt circle on the plate (copied bolts from the frame, scaled down)
door = Image.fromarray(out.clip(0, 255).astype(np.uint8))
bolt = im.crop((1182, 17, 1230, 65))  # one frame bolt
bm = Image.new("L", bolt.size, 0); ImageDraw.Draw(bm).ellipse((2, 2, 45, 45), fill=255); bm = bm.filter(ImageFilter.GaussianBlur(1.2))
for i in range(16):
    a = np.radians(i * 22.5 - 90)
    bx, by = R + 262 * np.cos(a), R + 262 * np.sin(a)
    b2 = bolt.resize((36, 36), Image.LANCZOS); m2 = bm.resize((36, 36))
    door.paste(b2, (int(bx - 18), int(by - 18)), m2)
# overall light: brighter upper-left, darker lower-right, edge falloff
yy2, xx2 = np.mgrid[0:S, 0:S].astype(np.float32)
light = 0.78 + 0.32 * (1 - ((xx2 + yy2) / (2 * S)))
light *= np.clip(1.08 - (r / R) ** 6 * 0.25, 0, 1.1)
d = np.asarray(door).astype(np.float32) * light[..., None]
door = Image.fromarray(d.clip(0, 255).astype(np.uint8)).convert("RGBA")
mask = Image.new("L", (S, S), 0); ImageDraw.Draw(mask).ellipse((0, 0, S - 1, S - 1), fill=255)
door.putalpha(mask.filter(ImageFilter.GaussianBlur(0.8)))
door.save("door.png")

# ---------------------------------------------------------------- hand wheel (straightened)
wx, wy, wa, wb = 657, 461, 50, 132
raw = np.asarray(im.crop((wx - wa, wy - wb, wx + wa, wy + wb)).resize((2 * wb, 2 * wb), Image.LANCZOS)).astype(np.float32)
# Rebuild it perfectly round: every 45deg sector mirrors the cleanest spoke (pointing left), so it can spin without wobbling.
n = 2 * wb; c0x, c0y = 138.0, 130.0
yv, xv = np.mgrid[0:n, 0:n].astype(np.float32)
ox, oy = xv - (n - 1) / 2, yv - (n - 1) / 2
rr = np.hypot(ox, oy) * (128.0 / ((n - 1) / 2)); ph = np.degrees(np.arctan2(oy, ox))
dd = np.abs(((ph + 22.5) % 45) - 22.5)
phs = np.radians(180 + dd)
wv = bilinear(raw, c0x + rr * 1.08 * np.cos(phs), c0y + rr * 1.08 * np.sin(phs))  # spokes reach the rim
# The rim: a polished gold ring (dark edges, bright crest), lit from the upper left like the photo.
t = np.clip((rr - 97) / 21, 0, 1)
crest = np.clip(np.sin(np.pi * t), 0, 1) ** 0.7
lightw = 0.72 + 0.38 * np.clip(np.cos(np.radians(ph + 135)), -1, 1)
dark, mid, hi = np.array([55, 28, 4], np.float32), np.array([214, 140, 40], np.float32), np.array([255, 236, 178], np.float32)
v = np.clip(crest * lightw, 0, 1.2)[..., None]
rim = np.where(v < 0.75, dark + (mid - dark) * (v / 0.75), mid + (hi - mid) * np.clip((v - 0.75) / 0.45, 0, 1))
blend = np.clip((rr - 95) / 3, 0, 1)[..., None]
wv = wv * (1 - blend) + rim * blend
wheel = Image.fromarray(wv.clip(0, 255).astype(np.uint8)).convert("RGBA")
# See-through between the spokes (dark gaps become transparent so the door shows through); hub and rim stay solid.
lum = wv.mean(axis=-1)
alpha = np.where((rr > 24) & (rr < 96), np.clip((lum - 58) / 45, 0, 1), 1.0)
alpha = np.where(rr > 118, 0.0, alpha)
_shadow = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
wm = Image.new("L", wheel.size, 0); _e = int(round((2 * wb) * (1 - 120 / 128.0) / 2)); ImageDraw.Draw(wm).ellipse((_e, _e, 2 * wb - 1 - _e, 2 * wb - 1 - _e), fill=255)
from PIL import ImageChops
wheel.putalpha(ImageChops.multiply(_shadow, wm.filter(ImageFilter.GaussianBlur(1))))
wheel.save("wheel.png")

# ---------------------------------------------------------------- photographed door face (back of the swinging door)
cx, cy, a, b = 482, 467, 250, 456
face = im.crop((cx - a, cy - b, cx + a, cy + b)).resize((S, S), Image.LANCZOS).convert("RGBA")
face.putalpha(mask)
face.save("inner.png")

# preview: plate + door + wheel at doorway
prev = p.copy()
prev.paste(door, (int(CX - R), int(CY - R)), door)
wl = wheel.resize((340, 340))
prev.paste(wl, (int(CX - 170), int(CY - 170)), wl)
prev.save("preview_closed.jpg", quality=85)
print("ok")
