#!/usr/bin/env python3
"""Chuyển bộ render 3D (city-buildings-3d) thành sprite cho game.

  python3 tools/build-sprites.py <thư mục city-buildings-3d>

Mỗi công trình lấy 10 trong 25 cấp render, 4 góc quay, nén dọc để khớp lưới 2:1 của game,
ghi ra public/img/bld/<id>/<cấp>_<góc>.webp và bảng thông số public/js/sprites.js.
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageEnhance

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "..", "public")
R = 3.5            # điểm ảnh sprite cho mỗi điểm ảnh game ở zoom 1
GRASS = 0.985      # phần ô đất mà thảm cỏ của sprite chiếm
LAWN = np.array([142, 176, 119], float)   # màu cỏ nền của game (renderer.ground)
EL = math.radians(35.264)
# id game: (thư mục render, ortho_scale, target_z, cấp render ứng với cấp 1 trong game)
MAP = {
    "house_small": ("house", 18.0, 1.4, 1), "apartment": ("apartment", 27.0, 5.0, 4),
    "office_tower": ("office", 31.0, 6.5, 7), "mini_mart": ("shop", 20.0, 2.0, 1),
    "waste_plant": ("factory", 21.0, 2.5, 5), "hospital": ("hospital", 23.0, 3.5, 5),
    "school": ("school", 22.0, 3.0, 3), "police_station": ("police", 22.0, 3.0, 3),
    "fire_station": ("fire_station", 23.0, 3.2, 3), "power_plant": ("power_plant", 22.0, 2.5, 1),
    "water_tower": ("water_tower", 24.0, 4.2, 1), "mall": ("mall", 22.0, 2.5, 7),
}
ANGLES = [0, 90, 180, 270]


def tidy(im, front, rim):
    """Đưa ảnh render về bảng màu của game và bỏ đế đất để thảm cỏ nằm phẳng trên ô."""
    # Render gốc khá nhạt: tăng bão hòa, tương phản, hạ sáng nhẹ.
    rgb = ImageEnhance.Contrast(ImageEnhance.Color(im.convert("RGB")).enhance(1.45)).enhance(1.12)
    c = np.array(rgb, float)
    alpha = np.array(im.getchannel("A"), float)
    r, g, b = c[:, :, 0], c[:, :, 1], c[:, :, 2]
    green = np.clip((g / np.maximum(np.maximum(r, b), 1) - 1.06) / .1, 0, 1)        # cỏ, cây
    lit = (green > .99) & (alpha > 250) & (rim < -.04)
    if lit.sum() > 200:
        gain = LAWN / np.median(c[lit], axis=0)
        c = c * (1 + green[:, :, None] * (gain - 1))
    c = 255 * (np.clip(c, 0, 255) / 255) ** 1.08
    soil = (r > g) & (g > b) & (r - b > 28) & (r < 190)
    alpha = alpha * front * np.where((rim > 0) & (rim < .05) & soil, 0, 1)
    out = np.dstack([c, alpha]).round().astype(np.uint8)
    return Image.fromarray(out, "RGBA")
meta = {}
for gid, (slug, scale, tz, first) in MAP.items():
    ppu = 512 / scale
    half = 11 / math.sqrt(2) * ppu                    # nửa bề ngang thảm cỏ trên ảnh gốc
    # Camera đặt ở cao độ 35.264° nhưng ngắm vào điểm (0,0,tz) nên góc nhìn thật thấp hơn và khác nhau theo từng công trình.
    el = math.atan2(40 * math.sin(EL) - tz, 40 * math.cos(EL))
    fx = R * 32 * GRASS / half
    fy = fx * 0.5 / math.sin(el)                      # ép hình thoi mặt đất về đúng tỉ lệ 2:1 của lưới game
    oy = 256 + tz * math.cos(el) * ppu                # tâm mặt cỏ (z = 0) = tâm ô đất của game
    hh = half * math.sin(el)
    yy, xx = np.mgrid[0:512, 0:512]
    side = np.abs(xx + .5 - 256) / half
    front = np.clip(oy + hh * (1 - side) - yy, 0, 1)                  # cắt bỏ thành đế đất phía trước
    rim = (oy - yy - .5) / hh + side - 1                              # > 0: nằm ngoài hai cạnh sau của thảm cỏ
    levels = [round(first + i * (25 - first) / 9) for i in range(10)]
    frames = {(i, a): tidy(Image.open(f"{SRC}/{slug}/frames/{slug}_lv{lv:02d}_az{ang}.png").convert("RGBA"), front, rim)
              for i, lv in enumerate(levels) for a, ang in enumerate(ANGLES)}
    x0 = y0 = 512; x1 = y1 = 0; tops = []
    for i in range(10):
        top = 512
        for a in range(4):
            ys, xs = np.where(np.array(frames[i, a])[:, :, 3] > 24)
            x0, x1, y0, y1 = min(x0, xs.min()), max(x1, xs.max() + 1), min(y0, ys.min()), max(y1, ys.max() + 1)
            top = min(top, ys.min())
        tops.append(round((oy - top) * fy / R))
    x0, y0, x1, y1 = max(0, x0 - 2), max(0, y0 - 2), min(512, x1 + 2), min(512, y1 + 2)
    w, h = round((x1 - x0) * fx), round((y1 - y0) * fy)
    os.makedirs(f"{OUT}/img/bld/{gid}", exist_ok=True)
    for (i, a), im in frames.items():
        im = im.crop((x0, y0, x1, y1)).resize((w, h), Image.LANCZOS)
        im.save(f"{OUT}/img/bld/{gid}/{i + 1:02d}_{a}.webp", quality=84, method=6)
    # Ảnh nhỏ cho Kho bản vẽ: cận cảnh công trình cấp 1 thay vì cả ô đất.
    src = frames[0, 0]
    bw = 1.25 * half
    ground = 256 + tz * math.cos(el) * ppu
    bottom = ground + 0.42 * half * math.sin(el)
    ys = np.where(np.array(src)[:, 256 - int(bw * .3):256 + int(bw * .3), 3] > 24)[0]
    bh = max(bw * 94 / 112, bottom - ys.min() + 6)
    bw = bh * 112 / 94
    thumb = src.crop((round(256 - bw / 2), round(bottom - bh), round(256 + bw / 2), round(bottom))).resize((224, 188), Image.LANCZOS)
    thumb.save(f"{OUT}/img/bld/{gid}/thumb.webp", quality=86, method=6)
    meta[gid] = {"w": round(w / R, 2), "h": round(h / R, 2), "ax": round((256 - x0) * fx / R, 2),
                 "ay": round((oy - y0) * fy / R, 2), "tops": tops}
    print(gid, levels, w, h, meta[gid])
with open(f"{OUT}/js/sprites.js", "w") as f:
    f.write('"use strict";\n// Sinh bởi tools/build-sprites.py — kích thước và điểm neo (đơn vị: điểm ảnh game ở zoom 1).\n'
            "const SPRITES = " + json.dumps(meta, separators=(",", ":")) + ";\n")
