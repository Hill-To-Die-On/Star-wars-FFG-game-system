"""Render an attributed community symbol font into Dice So Nice face labels."""
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DICE = json.loads(subprocess.check_output([
    "node", "--input-type=module", "-e",
    "import {DICE} from './src/dice/core.mjs'; console.log(JSON.stringify(DICE))"
], cwd=ROOT, text=True))
FONT = ROOT / "assets/vendor/starwarsffg/EotESymbol-Regular-PLUS.otf"
GLYPHS = {"success": "s", "advantage": "a", "triumph": "x", "failure": "f",
          "threat": "t", "despair": "y", "light": "Z", "dark": "z"}
OUT = ROOT / "assets/dice"
OUT.mkdir(parents=True, exist_ok=True)
for key, die in DICE.items():
    for index, face in enumerate(die["faces"]):
        visible = dict(face)
        visible["success"] -= visible["triumph"]
        visible["failure"] -= visible["despair"]
        symbols = [key for key, count in visible.items() for _ in range(count)]
        im = Image.new("RGBA", (1024, 1024))
        draw = ImageDraw.Draw(im)
        for i, symbol in enumerate(symbols):
            glyph = GLYPHS[symbol]
            font = ImageFont.truetype(str(FONT), 700)
            box = font.getbbox(glyph)
            width = 610 if len(symbols) == 1 else 350
            scale = min(width / (box[2] - box[0]), 610 / (box[3] - box[1]))
            font = ImageFont.truetype(str(FONT), int(700 * scale))
            box = font.getbbox(glyph)
            cx = 512 if len(symbols) == 1 else 300 + i * 424
            draw.text((cx - (box[0] + box[2]) / 2, 512 - (box[1] + box[3]) / 2),
                      glyph, font=font, fill=die["ink"])
        im.resize((256, 256), Image.Resampling.LANCZOS).save(OUT / f"{key}-{index + 1}.png")
print(f"Rendered {sum(len(d['faces']) for d in DICE.values())} standard-symbol faces.")
