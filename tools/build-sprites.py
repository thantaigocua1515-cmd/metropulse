#!/usr/bin/env python3
"""Convert the city-buildings-v2 archive using its shared ground projection."""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


PUBLIC = Path(__file__).resolve().parents[1] / "public"
IDS = (
    "house_small power_plant water_tower mini_mart apartment fire_station police_station school "
    "night_market park construction_hq hospital waste_plant office_tower solar_plant mall bank "
    "cyber_hub metro_station tech_tower university trade_port wind_farm metro_wonder stadium museum airport"
).split()
ANGLES = (0, 90, 180, 270)
ROADS = ("straight", "corner", "tee", "cross", "end")
LEVELS = 10
TILE = (64, 32)
RESOLUTION = 3


def thumbnail(frame):
    art = frame.crop(frame.getchannel("A").getbbox())
    art.thumbnail((204, 168), Image.Resampling.LANCZOS)
    thumb = Image.new("RGBA", (224, 188))
    thumb.paste(art, ((thumb.width - art.width) // 2, (thumb.height - art.height) // 2))
    return thumb


def contact_sheet(path, images, rows, cols, meta, title):
    scale = 2
    cell_w = 148
    above = max(28, round(meta["ay"] * scale) + 6)
    cell_h = above + 44
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h + 26), "#dcebf0")
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 7), title, fill="#253e49")
    for i, (label, image) in enumerate(images):
        x = (i % cols) * cell_w + cell_w // 2
        y = (i // cols) * cell_h + above + 26
        w, h = (d * scale / 2 for d in TILE)
        draw.polygon([(x, y - h), (x + w, y), (x, y + h), (x - w, y)], fill="#8cae76", outline="#54744d")
        art = image.resize((round(meta["w"] * scale), round(meta["h"] * scale)), Image.Resampling.LANCZOS)
        sheet.paste(art, (round(x - meta["ax"] * scale), round(y - meta["ay"] * scale)), art)
        draw.text((x - cell_w // 2 + 6, y - above + 3), label, fill="#253e49")
    sheet.save(path)


def convert(source, gid, contact_dir):
    folder = source / gid
    info = json.loads((folder / f"{gid}.json").read_text())
    road = gid == "road"
    levels = info["levels"]
    if info["building"] != gid or tuple(info["angles_deg"]) != ANGLES:
        raise ValueError(f"{gid}: unexpected asset metadata")
    if road and (levels is not None or set(info["variants"]) != set(ROADS)):
        raise ValueError(f"{gid}: unexpected road variants")
    if not road and levels < LEVELS:
        raise ValueError(f"{gid}: expected at least {LEVELS} source levels")
    source_levels = [] if road else [round(1 + i * (levels - 1) / (LEVELS - 1)) for i in range(LEVELS)]
    camera = info["camera"]
    ox, oy = camera["ground_centre_px"]
    tw, th = camera["tile_diamond_px"]
    fx, fy = TILE[0] / tw, TILE[1] / th
    axes = ROADS if road else range(1, LEVELS + 1)
    frames, boxes, clipped = {}, {}, []
    for rot, angle in enumerate(ANGLES):
        for key in axes:
            name = info["frame_pattern"].replace("{A}", str(angle))
            name = name.replace("{variant}", key) if road else name.replace("{NN}", f"{source_levels[key - 1]:02d}")
            with Image.open(folder / name) as loaded:
                if loaded.mode != "RGBA" or loaded.size != (camera["frame_px"],) * 2:
                    raise ValueError(f"{name}: expected the documented RGBA frame")
                frame = loaded.copy()
            alpha = frame.getchannel("A")
            box = alpha.getbbox()
            if not box or alpha.getextrema()[0] != 0:
                raise ValueError(f"{name}: expected artwork on a transparent background")
            frames[key, rot], boxes[key, rot] = frame, box
            if alpha.crop((0, 0, frame.width, 1)).getextrema()[1] > 127:
                clipped.append(name)

    x0, y0, x1, y1 = (f(box[i] for box in boxes.values()) + padding
                      for i, (f, padding) in enumerate(((min, -2), (min, -2), (max, 2), (max, 2))))
    w, h = round((x1 - x0) * fx * RESOLUTION), round((y1 - y0) * fy * RESOLUTION)
    mx, my = w / (x1 - x0) / RESOLUTION, h / (y1 - y0) / RESOLUTION
    meta = {"w": round(w / RESOLUTION, 3), "h": round(h / RESOLUTION, 3),
            "ax": round((ox - x0) * mx, 3), "ay": round((oy - y0) * my, 3)}
    if not road:
        meta["tops"] = [[max(0, round((oy - boxes[level, rot][1]) * my)) for rot in range(4)] for level in axes]
    out = PUBLIC / "img" / "bld" / gid
    out.mkdir(parents=True, exist_ok=True)
    written, contact = set(), []
    for (key, rot), frame in frames.items():
        stem = f"{key}_{rot}" if road else f"{key:02d}_{rot}"
        image = frame.crop((x0, y0, x1, y1)).resize((w, h), Image.Resampling.LANCZOS)
        dest = out / f"{stem}.webp"
        image.save(dest, quality=84, method=4)
        written.add(dest)
        if contact_dir:
            label = f"{key if road else f'Lv {key:02d}'} · {ANGLES[rot]}°"
            with Image.open(dest) as saved:
                contact.append((label, saved.convert("RGBA")))
        if (key, rot) == (("straight", 0) if road else (1, 0)):
            dest = out / "thumb.webp"
            thumbnail(image).save(dest, quality=86, method=4)
            written.add(dest)
    if contact_dir:
        contact_sheet(contact_dir / f"{gid}.png", contact, len(ANGLES), len(axes), meta, f"{info['name_vi']} / {gid}")
    print(f"{gid}: {len(frames)} frames, source levels {source_levels or 'n/a'}")
    for name in clipped:
        print(f"  source art touches upper frame edge: {name}")
    return meta, written


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--contact-dir", type=Path)
    args = parser.parse_args()
    dirs = {folder.name for folder in args.source.iterdir() if folder.is_dir()}
    expected = {*IDS, "road"}
    if dirs != expected:
        parser.error(f"missing folders: {sorted(expected - dirs)}; extra folders: {sorted(dirs - expected)}")
    if args.contact_dir:
        args.contact_dir.mkdir(parents=True, exist_ok=True)
    metadata, written = {}, set()
    for gid in [*IDS, "road"]:
        metadata[gid], files = convert(args.source, gid, args.contact_dir)
        written.update(files)
    for stale in set((PUBLIC / "img" / "bld").glob("*/*.webp")) - written:
        stale.unlink()
    (PUBLIC / "js" / "sprites.js").write_text(
        '"use strict";\n// Sinh bởi tools/build-sprites.py — kích thước và điểm neo (đơn vị: điểm ảnh game ở zoom 1).\n'
        "const SPRITES = " + json.dumps(metadata, separators=(",", ":")) + ";\n", encoding="utf-8"
    )
    print(f"{len(written)} WebP files, {sum(path.stat().st_size for path in written):,} bytes")


if __name__ == "__main__":
    main()
