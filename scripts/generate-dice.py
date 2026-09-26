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

# Dice So Nice maps square labels onto each polyhedral face. The d8's triangular
# face has a noticeably smaller safe area than the square texture. Ability pairs
# read clearly side by side, while Difficulty pairs follow the physical dice's
# stacked composition so both symbols remain centred on the triangular face.
ABILITY_D8_LAYOUT = {
    "single_width": 450,
    "multiple_width": 240,
    "height": 440,
    "multiple_centres": (370, 654),
}
DIFFICULTY_D8_LAYOUT = {
    "single_width": 450,
    "multiple_width": 240,
    "height": 440,
    "multiple_positions": ((512, 400), (512, 624)),
}
FACE_LAYOUTS = {
    "ability": ABILITY_D8_LAYOUT,
    "difficulty": DIFFICULTY_D8_LAYOUT,
}
VERSIONED_FACES = {"ability": "v2", "difficulty": "v3"}

for key, die in DICE.items():
    for index, face in enumerate(die["faces"]):
        visible = dict(face)
        visible["success"] -= visible["triumph"]
        visible["failure"] -= visible["despair"]
        symbols = [key for key, count in visible.items() for _ in range(count)]
        im = Image.new("RGBA", (1024, 1024))
        draw = ImageDraw.Draw(im)
        layout = FACE_LAYOUTS.get(key, {})
        for i, symbol in enumerate(symbols):
            glyph = GLYPHS[symbol]
            font = ImageFont.truetype(str(FONT), 700)
            box = font.getbbox(glyph)
            single = len(symbols) == 1
            width = layout.get(
                "single_width" if single else "multiple_width",
                610 if single else 350,
            )
            height = layout.get("height", 610)
            scale = min(width / (box[2] - box[0]), height / (box[3] - box[1]))
            font = ImageFont.truetype(str(FONT), int(700 * scale))
            box = font.getbbox(glyph)
            if single:
                cx, cy = 512, 512
            elif positions := layout.get("multiple_positions"):
                cx, cy = positions[i]
            else:
                centres = layout.get("multiple_centres", (300, 724))
                cx, cy = centres[i], 512
            draw.text((cx - (box[0] + box[2]) / 2, cy - (box[1] + box[3]) / 2),
                      glyph, font=font, fill=die["ink"])
        rendered = im.resize((256, 256), Image.Resampling.LANCZOS)
        rendered.save(OUT / f"{key}-{index + 1}.png")
        if suffix := VERSIONED_FACES.get(key):
            rendered.save(OUT / f"{key}-{index + 1}-{suffix}.png")
print(f"Rendered {sum(len(d['faces']) for d in DICE.values())} standard-symbol faces.")
