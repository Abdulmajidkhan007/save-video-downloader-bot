from PIL import Image, ImageDraw, ImageFont
import os

W, H = 640, 360
OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "welcome.png"))

img = Image.new("RGB", (W, H), (14, 19, 30))
d = ImageDraw.Draw(img)

# vertikal gradient fon
top, bottom = (26, 34, 52), (10, 14, 24)
for y in range(H):
    t = y / H
    d.line(
        [(0, y), (W, y)],
        fill=(
            int(top[0] * (1 - t) + bottom[0] * t),
            int(top[1] * (1 - t) + bottom[1] * t),
            int(top[2] * (1 - t) + bottom[2] * t),
        ),
    )

# nozik nuqtali bezak (yengil)
for gx in range(0, W, 40):
    for gy in range(0, H, 40):
        d.ellipse([gx, gy, gx + 2, gy + 2], fill=(255, 255, 255, 10))

PINK = (231, 60, 96)
WHITE = (245, 247, 250)
GRAY = (150, 161, 178)

# yumaloq nishon (badge)
cx, cy, R = 148, 180, 82
# yengil halqa
d.ellipse([cx - R - 10, cy - R - 10, cx + R + 10, cy + R + 10], outline=(231, 60, 96), width=3)
d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=PINK)

# domino niqob (anonimlik ramzi)
mw, mh = 104, 46
mx0, my0 = cx - mw // 2, cy - mh // 2 + 2
d.rounded_rectangle([mx0, my0, mx0 + mw, my0 + mh], radius=23, fill=(18, 23, 34))
eye_r = 13
d.ellipse([cx - 28 - eye_r, cy - eye_r + 2, cx - 28 + eye_r, cy + eye_r + 2], fill=PINK)
d.ellipse([cx + 28 - eye_r, cy - eye_r + 2, cx + 28 + eye_r, cy + eye_r + 2], fill=PINK)

# shriftlar
def font(sz, bold=True):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    try:
        return ImageFont.truetype(f"/usr/share/fonts/truetype/dejavu/{name}", sz)
    except Exception:
        return ImageFont.load_default()

tx = 268
d.text((tx, 118), "Anonim", font=font(46), fill=WHITE)
d.text((tx, 168), "Savollar", font=font(46), fill=PINK)
d.text((tx, 238), "Anonim savol-javob boti", font=font(22, bold=False), fill=GRAY)

img.save(OUT)
print("saved:", os.path.abspath(OUT))
