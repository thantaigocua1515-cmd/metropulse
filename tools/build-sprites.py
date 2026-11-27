#!/usr/bin/env python3
"""Convert building sprites from city-buildings-v2 or a Cloud City sheet ZIP."""
import argparse
import io
import json
from pathlib import Path
from zipfile import ZipFile

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
CLOUD_FACING = ("SW", "NW", "NE", "SE")
CLOUD_ROADS = ("SE", "SW", "NW", "NE")
SKINS = ("tet", "noel", "cyberpunk", "sakura", "desert", "jungle", "ocean", "steampunk")


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


def write_metadata(metadata):
    (PUBLIC / "js" / "sprites.js").write_text(
        '"use strict";\n// Sinh bởi tools/build-sprites.py — kích thước và điểm neo (đơn vị: điểm ảnh game ở zoom 1).\n'
        "const SPRITES = " + json.dumps(metadata, separators=(",", ":")) + ";\n", encoding="utf-8"
    )


def cloud_frames(archive, asset, directions, first=1, last=LEVELS):
    info = json.loads(archive.read(asset["frames"]))
    with Image.open(io.BytesIO(archive.read(asset["sheet"]))) as sheet:
        height = (last - first + 1) * 192
        if sheet.mode != "RGBA" or sheet.size != (768, height):
            raise ValueError(f"{asset['id']}: expected a 768 × {height} RGBA sheet")
        frames = {}
        for level in range(first, last + 1):
            for rotation, direction in enumerate(directions):
                key = f"L{level:02d}_{direction}"
                entry = info["frames"][key]
                x, y, w, h = (entry["frame"][name] for name in ("x", "y", "w", "h"))
                pivot = entry["pivot"]
                if ((x, y, w, h) != (("SE", "SW", "NW", "NE").index(direction) * 192, (level - first) * 192, 192, 192)
                    or entry["rotated"] or entry["trimmed"] or (pivot["x"] * w, pivot["y"] * h) != (96, 137)):
                    raise ValueError(f"{asset['id']} {key}: unexpected cell geometry")
                frame = sheet.crop((x, y, x + w, y + h))
                alpha = frame.getchannel("A")
                box = alpha.getbbox()
                if not box or alpha.getextrema()[0] != 0 or not (0 < box[0] < box[2] < w and 0 < box[1] < box[3] < h):
                    raise ValueError(f"{asset['id']} {key}: missing transparency or artwork touches a cell edge")
                frames[level, rotation] = frame, box
    return frames


def convert_cloud(source, contact_dir, badge=None):
    if contact_dir:
        contact_dir.mkdir(parents=True, exist_ok=True)
    with ZipFile(source) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        level_range = manifest.get("levelRange", {"min": 1, "max": LEVELS})
        first, last = level_range["min"], level_range["max"]
        if (first, last) not in ((1, LEVELS), (LEVELS + 1, 25)):
            raise ValueError(f"Unsupported Cloud City level range: {first}–{last}")
        extended = first > 1
        skin = manifest.get("skin", {}).get("id")
        if extended and skin == "default":
            skin = None
        if skin not in (*SKINS, None) or (not skin and badge):
            raise ValueError("Unsupported Cloud City skin archive")
        if skin and badge is None and not extended:
            icon = manifest["skin"].get("icon")
            if not icon:
                raise ValueError(f"{skin}: archive has no icon; supply --skin-badge")
            badge = io.BytesIO(archive.read(icon))
        assets = {entry["id"]: entry for entry in manifest["assets"]}
        if len(assets) != len(manifest["assets"]) or ((not skin or extended) and set(assets) != {*IDS, "road"}):
            raise ValueError("Missing, extra or duplicate building IDs in the Cloud City manifest")
        ids = [gid for gid in IDS if gid in assets]
        if skin or extended:
            print(f"{skin or 'default'} L{first}–{last}: {len(ids)}/{len(IDS)} building families; missing: {sorted(set(IDS) - assets.keys())}; "
                  f"unused: {sorted(assets.keys() - set(IDS))}")
        # Cloud City labels the viewpoint, whereas MetroPulse indexes the direction of the entrance.
        frames = {gid: cloud_frames(archive, assets[gid], CLOUD_ROADS if gid == "road" else CLOUD_FACING, first, last)
                  for gid in (ids if skin or extended else [*ids, "road"])}
    folder = PUBLIC / "img" / ("skins/" + skin if skin else "bld")
    metadata = {}
    for gid in ids:
        asset, cells = assets[gid], frames[gid]
        footprint, tile = asset["footprintTiles"], asset["projectedTilePx"]
        # Fit the longest side into MetroPulse's single lot, with room for the plinth thickness.
        span = max(footprint["x"], footprint["y"])
        fx, fy = TILE[0] * .91 / (span * tile["w"]), TILE[1] * .91 / (span * tile["h"])
        boxes = [box for _, box in cells.values()]
        x0, y0, x1, y1 = (f(box[i] for box in boxes) + padding
                          for i, (f, padding) in enumerate(((min, -2), (min, -2), (max, 2), (max, 2))))
        w, h = round((x1 - x0) * fx * RESOLUTION), round((y1 - y0) * fy * RESOLUTION)
        mx, my = w / (x1 - x0) / RESOLUTION, h / (y1 - y0) / RESOLUTION
        meta = metadata[gid] = {"w": round(w / RESOLUTION, 3), "h": round(h / RESOLUTION, 3),
                                "ax": round((96 - x0) * mx, 3), "ay": round((137 - y0) * my, 3)}
        meta["tops"] = [[round((137 - cells[level, rot][1][1]) * my) for rot in range(4)]
                        for level in range(first, last + 1)]
        out = folder / gid
        out.mkdir(parents=True, exist_ok=True)
        contact = []
        for (level, rot), (frame, _) in cells.items():
            image = frame.crop((x0, y0, x1, y1)).resize((w, h), Image.Resampling.LANCZOS)
            image.save(out / f"{level:02d}_{rot}.webp", quality=84, method=4)
            if (level, rot) == (1, 0):
                thumbnail(image).save(out / "thumb.webp", quality=86, method=4)
            if contact_dir:
                contact.append((f"Lv {level:02d} / {CLOUD_FACING[rot]}", image))
        if contact_dir:
            contact_sheet(contact_dir / f"{gid}.png", contact, last - first + 1, 4, meta, gid)
        print(f"{gid}: {len(cells)} frames")
    if extended:
        return skin or "default", metadata, True
    if skin:
        with Image.open(badge) as source_badge:
            logo = source_badge.convert("RGBA")
            logo = logo.crop(logo.getchannel("A").getbbox())
            logo.thumbnail((256, 256), Image.Resampling.LANCZOS)
            logo.save(folder / "badge.webp", quality=88, method=4)
        return skin, metadata, False
    road_dir = folder / "road"
    # The map renders roads procedurally. Only the straight previews have a matching new sprite.
    for rot in range(4):
        frame, box = frames["road"][1, rot]
        image = frame.crop(box)
        image.save(road_dir / f"straight_{rot}.webp", quality=84, method=4)
        if rot == 0:
            thumbnail(image).save(road_dir / "thumb.webp", quality=86, method=4)
    existing = (PUBLIC / "js" / "sprites.js").read_text(encoding="utf-8")
    metadata["road"] = json.loads(existing.split("const SPRITES = ", 1)[1].rstrip(";\n"))["road"]
    write_metadata(metadata)
    print("road: 4 straight previews and thumbnail; other variants retained")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, nargs="+")
    parser.add_argument("--contact-dir", type=Path)
    parser.add_argument("--skin-badge", type=Path, action="append")
    args = parser.parse_args()
    if args.contact_dir:
        args.contact_dir.mkdir(parents=True, exist_ok=True)
    if args.skin_badge and len(args.source) != len(args.skin_badge):
        parser.error("Provide one --skin-badge per source archive in the same order")
    if all(source.is_file() for source in args.source):
        if len(args.source) > 1:
            for source in args.source:
                with ZipFile(source) as archive:
                    if not json.loads(archive.read("manifest.json")).get("skin", {}).get("id"):
                        parser.error("Provide one base asset source, or one or more skin archives")
        dest = PUBLIC / "js" / "skin-sprites.js"
        packs = json.loads(dest.read_text(encoding="utf-8").split("const SKIN_SPRITES = ", 1)[1].rstrip(";\n")) if dest.exists() else {}
        skins_changed = False
        for source, badge in zip(args.source, args.skin_badge or [None] * len(args.source)):
            contact = args.contact_dir / source.stem if args.contact_dir and len(args.source) > 1 else args.contact_dir
            pack = convert_cloud(source, contact, badge)
            if pack:
                skin, art, extended = pack
                if extended:
                    if skin == "default":
                        base = (PUBLIC / "js" / "sprites.js").read_text(encoding="utf-8")
                        metadata = json.loads(base.split("const SPRITES = ", 1)[1].rstrip(";\n"))
                    else:
                        metadata = packs[skin]
                    for gid, higher in art.items():
                        base = metadata[gid]
                        base["tops"] = base["tops"][:LEVELS] + higher.pop("tops")
                        base["late"] = higher
                    if skin == "default":
                        write_metadata(metadata)
                        continue
                else:
                    packs[skin] = art
                skins_changed = True
        if skins_changed:
            dest.write_text('"use strict";\nconst SKIN_SPRITES = ' + json.dumps(packs, separators=(",", ":")) + ";\n",
                            encoding="utf-8")
        return
    if args.skin_badge:
        parser.error("--skin-badge requires archive files")
    if len(args.source) != 1:
        parser.error("Provide one base asset source")
    source, = args.source
    dirs = {folder.name for folder in source.iterdir() if folder.is_dir()}
    expected = {*IDS, "road"}
    if dirs != expected:
        parser.error(f"missing folders: {sorted(expected - dirs)}; extra folders: {sorted(dirs - expected)}")
    metadata, written = {}, set()
    for gid in [*IDS, "road"]:
        metadata[gid], files = convert(source, gid, args.contact_dir)
        written.update(files)
    for stale in set((PUBLIC / "img" / "bld").glob("*/*.webp")) - written:
        stale.unlink()
    write_metadata(metadata)
    print(f"{len(written)} WebP files, {sum(path.stat().st_size for path in written):,} bytes")


if __name__ == "__main__":
    main()
