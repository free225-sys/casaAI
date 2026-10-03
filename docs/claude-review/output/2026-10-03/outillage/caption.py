"""Ajoute une légende visible en tête des captures « avant » (rendu réel, API simulée)."""
import sys, textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
D = Path(sys.argv[1])
B = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-SemiBold.otf", 14)
R = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-Regular.otf", 13)
for f in sorted(D.glob("avant-*.png")):
    im = Image.open(f).convert("RGB")
    if im.getpixel((2, 2)) == (138, 70, 0):  # déjà légendée
        continue
    vp = f.stem.split("--")[-1]
    head = "CAPTURE RÉELLE (avant) — rendu du code au SHA, non observé sur la QA"
    sub = (f"Chromium headless, viewport {vp}. Build Vite de 65bcde7 (code applicatif d2e9d9a). "
           "API simulée par interception réseau, données synthétiques (titres du seed versionné). Aucun backend ni base.")
    W = im.width; chars = max(30, int((W - 24) / 7.2))
    lines = [(head, B)] + [(l, R) for l in textwrap.wrap(sub, chars)]
    h = 12 + sum(20 for _ in lines) + 8
    out = Image.new("RGB", (W, im.height + h), (138, 70, 0))
    d = ImageDraw.Draw(out); y = 10
    for t, fnt in lines:
        for chunk in textwrap.wrap(t, chars) if fnt is B else [t]:
            d.text((12, y), chunk, font=fnt, fill=(255, 255, 255)); y += 20
    out = out.crop((0, 0, W, max(y + 8, h) + im.height)) if y + 8 > h else out
    out.paste(im, (0, max(y + 8, h)))
    out.save(f, optimize=True)
    print("légendée", f.name)
