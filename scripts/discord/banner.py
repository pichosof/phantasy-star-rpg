"""Discord profile banner for the RPG Picho bot, in the site's Dezolis theme.

Usage: python scripts/discord/banner.py ../phantasy-star-rpg.front/src/assets/logo-mark-dark.png banner.png
Upload it as the bot banner (Discord Developer Portal → Bot, or PATCH /users/@me).
"""
import math
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1360, 480
BG_TOP, BG_BOTTOM = (4, 10, 22), (10, 21, 48)  # background → additionalBackground
CYAN, VIOLET, MINT, BORDER = (0, 200, 232), (168, 140, 255), (34, 239, 200), (43, 69, 120)

mark_path, out_path = sys.argv[1], sys.argv[2]
random.seed(7)

# Vertical gradient (the site's dark "void").
img = Image.new('RGB', (W, H))
px = img.load()
for y in range(H):
    t = y / (H - 1)
    row = tuple(round(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM))
    for x in range(W):
        px[x, y] = row
img = img.convert('RGBA')

# Soft aurora: cyan → violet glows (the site's primaryGradient).
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
g = ImageDraw.Draw(glow)
g.ellipse((560, -260, 1460, 300), fill=CYAN + (70,))
g.ellipse((860, 140, 1560, 640), fill=VIOLET + (60,))
g.ellipse((-200, 260, 500, 760), fill=MINT + (28,))
img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(120)))

# Faint hexagon lattice (echoes the Dezolis mark).
lattice = Image.new('RGBA', (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(lattice)
r = 46
dx, dy = r * math.sqrt(3), r * 1.5
for row in range(-1, int(H / dy) + 2):
    for col in range(-1, int(W / dx) + 2):
        cx = col * dx + (dx / 2 if row % 2 else 0)
        cy = row * dy
        pts = [
            (cx + r * math.cos(math.radians(60 * k - 30)), cy + r * math.sin(math.radians(60 * k - 30)))
            for k in range(6)
        ]
        fade = max(0.0, 1 - abs(cx - W * 0.62) / (W * 0.6))
        d.polygon(pts, outline=BORDER + (round(55 * fade),))
img = Image.alpha_composite(img, lattice)

# Ice sparkles.
spark = Image.new('RGBA', (W, H), (0, 0, 0, 0))
s = ImageDraw.Draw(spark)
for _ in range(90):
    x, y = random.randrange(W), random.randrange(H)
    rad = random.choice([1, 1, 1, 2])
    s.ellipse((x - rad, y - rad, x + rad, y + rad), fill=(200, 245, 255, random.randint(60, 170)))
img = Image.alpha_composite(img, spark)

# The mark, large and faded, as a watermark on the right.
mark = Image.open(mark_path).convert('RGBA').resize((420, 420), Image.LANCZOS)
alpha = mark.getchannel('A').point(lambda a: round(a * 0.22))
mark.putalpha(alpha)
img.alpha_composite(mark, (W - 440, 30))

# Text, right of the area the profile avatar covers (bottom-left).
def font(names, size):
    for n in names:
        try:
            return ImageFont.truetype(f'C:/Windows/Fonts/{n}', size)
        except OSError:
            continue
    raise SystemExit(f'No font found among {names}')

bold = font(['segoeuib.ttf', 'arialbd.ttf'], 112)
light = font(['segoeuil.ttf', 'segoeui.ttf', 'arial.ttf'], 40)
small = font(['segoeuisl.ttf', 'segoeui.ttf', 'arial.ttf'], 30)

text = Image.new('RGBA', (W, H), (0, 0, 0, 0))
t = ImageDraw.Draw(text)
x0, y0 = 420, 120
t.text((x0, y0), 'RPG', font=bold, fill=(197, 211, 224, 255))
rpg_w = t.textlength('RPG ', font=bold)

# "Companion" in the cyan → violet gradient.
word = 'Companion'
mask = Image.new('L', (W, H), 0)
ImageDraw.Draw(mask).text((x0 + rpg_w, y0), word, font=bold, fill=255)
grad = Image.new('RGBA', (W, H))
gp = grad.load()
left, right = int(x0 + rpg_w), int(x0 + rpg_w + t.textlength(word, font=bold))
for x in range(W):
    k = min(1.0, max(0.0, (x - left) / max(1, right - left)))
    c = tuple(round(a + (b - a) * k) for a, b in zip(CYAN, VIOLET)) + (255,)
    for y in range(H):
        gp[x, y] = c
text.paste(grad, (0, 0), mask)

t.text((x0 + 6, y0 + 140), '·  D E Z O L I S  ·', font=light, fill=MINT + (235,))
t.text(
    (x0 + 6, y0 + 200),
    'Phantasy Star campaign companion  ·  rpg.picho.org',
    font=small,
    fill=(122, 148, 180, 255),
)

# A gentle glow behind the title.
halo = text.filter(ImageFilter.GaussianBlur(14))
img = Image.alpha_composite(img, Image.blend(Image.new('RGBA', (W, H), (0, 0, 0, 0)), halo, 0.6))
img = Image.alpha_composite(img, text)

img.convert('RGB').save(out_path, optimize=True)
print('banner', img.size, out_path)
