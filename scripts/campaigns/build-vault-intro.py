"""Intro images from the two photos of the same vault (closed.png, orig.png = open):
  vault-room.webp      closed photo with the door cut out (transparent), laid over the open-room plate
  vault-door2.webp     the door from the closed photo (disc + hinge arms), left edge = hinge axis
  vault-wheel2.webp    the door's spoked wheel (spins)
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
closed = Image.open("closed.png").convert("RGB")
W, H = closed.size
HX, DCX, DCY, DR, WR = 615, 1092, 438, 420, 292   # hinge axis, door centre, door radius, wheel radius
HUB = (1095, 437)

def door_mask(feather=1.5):
    m = Image.new("L", (W, H), 0); d = ImageDraw.Draw(m)
    d.ellipse((DCX - DR, DCY - DR, DCX + DR, DCY + DR), fill=255)
    d.polygon([(HX - 6, 160), (885, 165), (912, 255), (HX - 6, 255)], fill=255)
    d.polygon([(HX - 6, 625), (912, 625), (885, 725), (HX - 6, 725)], fill=255)
    return m.filter(ImageFilter.GaussianBlur(feather))

m = door_mask()
# Room: the closed photo without its door (the open-room plate shows through the doorway)
room = closed.convert("RGBA"); room.putalpha(Image.eval(m, lambda v: 255 - v))
room.save("room.png")
# Door: crop from the hinge axis to the right edge of the door
box = (HX, DCY - DR - 2, DCX + DR + 4, DCY + DR + 2)
door = closed.convert("RGBA"); door.putalpha(m); door = door.crop(box); door.save("door2.png")
# Wheel: a disc around the hub
wm = Image.new("L", (W, H), 0); ImageDraw.Draw(wm).ellipse((HUB[0] - WR, HUB[1] - WR, HUB[0] + WR, HUB[1] + WR), fill=255)
wheel = closed.convert("RGBA"); wheel.putalpha(wm.filter(ImageFilter.GaussianBlur(1.2)))
wheel.crop((HUB[0] - WR, HUB[1] - WR, HUB[0] + WR, HUB[1] + WR)).save("wheel2.png")
print("door box", box, "door size", door.size)
# Previews: door removed (room over plate), and the plate alone
plate = Image.open("plate.jpg").convert("RGBA")
prev = plate.copy(); prev.alpha_composite(room); prev.convert("RGB").resize((836, 470)).save("prev_removed.jpg")
