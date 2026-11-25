"""Build the in-game WebP atlases from the local Fosta sheets (sources aren't shipped)."""
import argparse
from io import BytesIO
import json
import math
from pathlib import Path
import re
from zipfile import ZipFile

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
CELL = 128
HUD_CELL = 96
HUD = (
    "star coin prestige brain people happy power water crane move demo checklist",
    "story flask policy social crew commands settings sound",
    "mute cloud cloud-off help gift mail look center",
    "sun heat storm moon pulse plus minus close rotate chat",
)
SHEETS = {
    **dict(zip(("hud-test", "hud-actions", "hud-utility", "hud-weather-controls"), HUD)),
    "ui-surfaces": "button button-active button-danger badge pill meter tool-tab tool-tab-off dialog header tray card",
    "events-tet-trung-thu": "tet-small tet-large tet-peach trung-thu-small trung-thu-large trung-thu-rabbit",
    "events-quoc-khanh-giang-sinh": "quoc-khanh-small quoc-khanh-large giang-sinh-small giang-sinh-large",
    "events-weekly-flash": "pho-xanh-small cho-phien-small xom-vui-small rush-hour-large pho-xanh-large cho-phien-large xom-vui-large weekend-market-large",
    "events-tokens": "tet trung-thu quoc-khanh giang-sinh pho-xanh cho-phien xom-vui rush-hour weekend-market wreath",
    "pedestrian-emotions": "joy happy ok sad angry scared sick hot sleepy love",
    "markers-crisis": "blackout water_leak collapse traffic_jam fire trash_pile flu_outbreak cyber_attack",
    "markers-rewards": "coin gem know coin-token gem-token know-token",
    "vfx-construction-celebration": "dust-small dust-medium smoke-light sparkle-gold star sparkle-mint ring-gold ring-mint confetti-clay confetti-blue confetti-sage confetti-gold",
    "vfx-incidents-weather": "flame smoke-dark water-spray arc fumes medical interference rain",
    "scaffolding-stages": "stage1 stage2 stage3 stage4",
    "terrain-grass": "grass1 grass2 grass3 locked1 locked2 locked3",
    "terrain-props": "tree1 tree2 tree3 grass-tuft flowers lamp lock light-pool",
    "terrain-edge": "soil-left soil-right seam-left seam-right",
}
DIRECTIONAL = {
    "traffic-light": "bike1 bike2 car1 car2",
    "traffic-cars": "car3 car4 taxi1",
    "traffic-heavy": "bus1 bus2 truck1 truck2",
    "pedestrians-adults": "adult1 adult2 adult3 adult4",
    "pedestrians-families": "old1 old2 kid1 kid2",
    "pedestrians-rain": "rain1 rain2 rain3 rain4",
}
for team in ("electric", "water", "fire", "police", "construction", "waste", "medical", "cyber"):
    DIRECTIONAL["crew-" + team] = "foot bicycle scooter truck van repair"
for key, names in DIRECTIONAL.items():
    SHEETS[key] = " ".join(name + "-" + side for name in names.split() for side in ("front", "rear"))


def boundaries(alpha, count, horizontal):
    dim = alpha.height if horizontal else alpha.width
    cross = alpha.width if horizontal else alpha.height
    ink = [
        sum(alpha.crop((0, i, cross, i + 1) if horizontal else (i, 0, i + 1, cross)).histogram()[96:])
        for i in range(dim)
    ]
    cuts = [0]
    for n in range(1, count):
        center = n * dim / count
        pad = dim / count * .32
        cuts.append(min(range(round(center - pad), round(center + pad)),
                        key=lambda i: (sum(ink[i - 3:i + 4]), abs(i - center))))
    return cuts + [dim]


def crew_crops(source, cols, rows):
    alpha = np.array(source.getchannel("A"))
    labels, count = ndimage.label(alpha > 0, np.ones((3, 3), dtype=bool))
    weights = np.bincount(labels.ravel(), weights=alpha.ravel(), minlength=count + 1)
    cells = [[] for _ in range(cols * rows)]
    height, width = alpha.shape
    for index, region in enumerate(ndimage.find_objects(labels), 1):
        if weights[index] < 12 * 255:
            continue
        y, x = region
        col = min(cols - 1, int((x.start + x.stop) * cols / (2 * width)))
        row = min(rows - 1, int((y.start + y.stop) * rows / (2 * height)))
        cells[row * cols + col].append((index, x, y))
    for parts in cells:
        if not parts:
            yield None
            continue
        cutoff = max(weights[index] for index, _, _ in parts) * .02
        parts = [(index, x, y) for index, x, y in parts if weights[index] >= cutoff]
        left, top = min(x.start for _, x, _ in parts), min(y.start for _, _, y in parts)
        right, bottom = max(x.stop for _, x, _ in parts), max(y.stop for _, _, y in parts)
        area = np.s_[top:bottom, left:right]
        keep = np.isin(labels[area], [index for index, _, _ in parts])
        crop = source.crop((left, top, right, bottom))
        crop.putalpha(Image.fromarray(np.where(keep, alpha[area], 0)))
        yield crop


def frames(job, source):
    name = job["name"]
    if name == "hud-test":
        cols, rows = 4, 3
    else:
        cols, rows = map(int, re.search(r"(\d+)x(\d+) sprite sheet", job["prompt"]).groups())
    limit = 96 if name == "events-tokens" else 16
    a = source.getchannel("A").point(lambda v: v if v >= limit else 0)
    source.putalpha(a)
    keys = SHEETS[name].split()
    assert len(keys) == cols * rows, name
    crew = name.startswith("crew-")
    if crew:
        crops = crew_crops(source, cols, rows)
    else:
        cols_at, rows_at = boundaries(a, cols, False), boundaries(a, rows, True)
        crops = (source.crop((cols_at[c], rows_at[r], cols_at[c + 1], rows_at[r + 1]))
                 for r in range(rows) for c in range(cols))
    for key, crop in zip(keys, crops):
        if crop is None:
            print(f"  {name}/{key}: blank, keeping fallback")
            continue
        if name in DIRECTIONAL and not crew:
            alpha = np.array(crop.getchannel("A"))
            labels, count = ndimage.label(alpha > 0, np.ones((3, 3), dtype=bool))
            if count:
                areas = np.bincount(labels.ravel(), minlength=count + 1)
                tiny = areas < max(12, areas[1:].max() * .02)
                tiny[0] = True
                alpha[tiny[labels]] = 0
                crop.putalpha(Image.fromarray(alpha))
        bounds = crop.getchannel("A").getbbox()
        if bounds is None:
            print(f"  {name}/{key}: blank, keeping fallback")
            continue
        if not crew:
            strong = crop.getchannel("A").point(lambda v: 255 if v >= 96 else 0).getbbox()
            if not strong or strong[0] < 2 or strong[1] < 2 or crop.width - strong[2] < 2 or crop.height - strong[3] < 2:
                print(f"  {name}/{key}: tight gutter; review visually")
        crop = crop.crop(bounds)
        limit = HUD_CELL - 8 if name.startswith("hud-") else CELL - 12
        crop.thumbnail((limit, limit), Image.Resampling.LANCZOS)
        yield key, crop


def write_atlas(out, key, icons, data, cols=None, cell=CELL, quality=84):
    cols = cols or min(4, len(icons))
    atlas = Image.new("RGBA", (cols * cell, math.ceil(len(icons) / cols) * cell))
    for i, (name, image) in enumerate(icons):
        row, col = divmod(i, cols)
        x = col * cell + (cell - image.width) // 2
        y = row * cell + (cell - image.height) // 2
        atlas.paste(image, (x, y))
        data[name] = [key, x, y, image.width, image.height]
    atlas.save(out / (key + ".webp"), "WEBP", quality=quality, method=4)
    return atlas.size


def contact_sheet(out, destination, data):
    groups = [("HUD", "hud", data["hud"])]
    groups += [(name, name, frames) for name, frames in data["groups"].items()]
    groups.append(("UI, backgrounds and story", None, dict.fromkeys(data["images"])))
    columns, width, height = 8, 128, 100
    sheets = Image.new("RGB", (columns * width, sum(26 + math.ceil(len(group) / columns) * height
                                                     for _, _, group in groups)), "#e9ede7")
    draw, y = ImageDraw.Draw(sheets), 0
    for title, atlas, group in groups:
        draw.text((8, y + 7), title, fill="#283c35")
        y += 26
        source = Image.open(out / (atlas + ".webp")).convert("RGBA") if atlas else None
        for i, (key, frame) in enumerate(group.items()):
            x, top = i % columns * width, y + i // columns * height
            if source:
                _, sx, sy, sw, sh = frame
                preview = source.crop((sx, sy, sx + sw, sy + sh))
            else:
                preview = Image.open(out / (key + ".webp")).convert("RGBA")
            preview.thumbnail((width - 14, height - 22), Image.Resampling.LANCZOS)
            sheets.paste(preview, (x + (width - preview.width) // 2, top), preview)
            draw.text((x + 4, top + height - 18), key, fill="#283c35")
        y += math.ceil(len(group) / columns) * height
    sheets.save(destination)


def replace_hud(pack, out, contact):
    manifest = ROOT / "public/js/art-data.js"
    prefix = '"use strict";\n\nconst ART_DATA='
    data = json.loads(manifest.read_text(encoding="utf8").removeprefix(prefix).rstrip().removesuffix(";"))
    previous = Image.open(out / "hud.webp").convert("RGBA")
    cell = data["hudCell"]
    with ZipFile(pack) as archive:
        sources = json.loads(archive.read("manifest.json"))["icons"]
        aliases = {"zoom-in": "plus", "zoom-out": "minus"}
        replacements = {}
        for name, entry in sources.items():
            key = aliases.get(name, name)
            if key not in data["hud"]:
                print(f"Unused source icon: {name}")
                continue
            icon = Image.open(BytesIO(archive.read(entry["path"]))).convert("RGBA")
            bounds = icon.getchannel("A").getbbox()
            if not bounds or bounds == (0, 0, *icon.size):
                raise ValueError(f"Expected a visible icon with transparent margins: {name}")
            icon = icon.crop(bounds)
            icon.thumbnail((cell - 8, cell - 8), Image.Resampling.LANCZOS)
            replacements[key] = icon
        if not replacements:
            raise ValueError("No matching HUD icons in the pack")

    frames = [(key, replacements.get(key, previous.crop((x, y, x+w, y+h))))
              for key, (_, x, y, w, h) in data["hud"].items()]
    data["hud"] = {}
    data["hudSize"] = write_atlas(out, "hud", frames, data["hud"], cols=8, cell=cell, quality=90)
    manifest.write_text(prefix + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf8")
    kept = sorted(data["hud"].keys() - replacements.keys())
    if contact:
        width, height, cols = 112, 76, 8
        sheet = Image.new("RGB", (width*cols, height*math.ceil(len(frames)/cols)), "#f1ecdf")
        atlas = Image.open(out / "hud.webp").convert("RGBA")
        draw = ImageDraw.Draw(sheet)
        labels = {key: f"{name} -> {key}" for name, key in aliases.items()}
        for i, (key, (_, x, y, w, h)) in enumerate(data["hud"].items()):
            image = atlas.crop((x, y, x+w, y+h))
            image.thumbnail((40, 40), Image.Resampling.LANCZOS)
            left, top = (i % cols)*width, (i // cols)*height
            sheet.paste(image, (left + (width-image.width)//2, top + (46-image.height)//2), image)
            draw.text((left+5, top+49), labels.get(key, key), fill="#283c35")
            if key in kept:
                draw.text((left+5, top+62), "Existing", fill="#87563b")
        sheet.save(contact)
    print(f"{len(replacements)} HUD icons replaced; existing frames kept: {', '.join(kept)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source", type=Path, nargs="?", help="folder containing jobs-all.json and out/")
    ap.add_argument("--hud-pack", type=Path, help="replace only HUD frames from a MetroPulse icon ZIP")
    ap.add_argument("--contact", type=Path, help="optional labeled contact-sheet PNG")
    args = ap.parse_args()
    if bool(args.source) == bool(args.hud_pack):
        ap.error("provide either a Fosta source folder or --hud-pack")
    out = ROOT / "public/img/art"
    out.mkdir(exist_ok=True, parents=True)
    if args.hud_pack:
        replace_hud(args.hud_pack, out, args.contact)
        return
    jobs = [{"name": "hud-test"}] + json.loads((args.source / "jobs-all.json").read_text())
    data, hud, opaque, assets = {}, [], [], 0
    for job in jobs:
        name = job["name"]
        path = args.source / "out" / (name + ".png")
        if not path.exists():
            continue
        try:
            source = Image.open(path).convert("RGBA")
        except OSError:
            print(f"  {name}: file not fully written yet, keeping fallback")
            continue
        if "background" in job:
            source.thumbnail((1280, 960), Image.Resampling.LANCZOS)
            source.convert("RGB").save(out / (name + ".webp"), "WEBP", quality=80, method=4)
            opaque.append(name)
        else:
            icons = list(frames(job, source))
            if name.startswith("hud-"):
                hud.extend(icons)
            elif name == "ui-surfaces":
                for tag, image in icons:
                    file = "ui-" + tag
                    image.save(out / (file + ".webp"), "WEBP", quality=86, method=4)
                    opaque.append(file)
            elif icons:
                write_atlas(out, name, icons, data.setdefault(name, {}))
        assets += 1
    hud_data = {}
    hud_size = write_atlas(out, "hud", hud, hud_data, cols=8, cell=HUD_CELL, quality=81) if hud else [0, 0]
    result = {"cell": CELL, "hudCell": HUD_CELL, "hud": hud_data, "hudSize": hud_size, "groups": data, "images": opaque}
    (ROOT / "public/js/art-data.js").write_text(
        '"use strict";\n\nconst ART_DATA=' + json.dumps(result, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf8",
    )
    if args.contact:
        contact_sheet(out, args.contact, result)
    print(f"{assets} source images; {len(hud)} HUD icons; {sum(map(len, data.values()))} canvas frames; {len(opaque)} standalone images")


if __name__ == "__main__":
    main()
