#!/usr/bin/env python3
"""Procedural stills, scrub clips, a loop, and audio for the demo skin.

Nothing here is traced from another site. Run `python3 tools/render_media.py`
after `pip install -r tools/requirements.txt`. Needs ffmpeg on PATH.
"""

from __future__ import annotations

import argparse
import math
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "public" / "media"

INK = (28, 25, 21, 255)
PAPER = (243, 234, 215, 255)
CREAM = (255, 248, 238, 255)
TOMATO = (226, 59, 47, 255)
TOMATO_DEEP = (176, 42, 36, 255)
LEAF = (31, 122, 69, 255)
LEAF_DEEP = (16, 86, 48, 255)
LEAF_LIGHT = (138, 190, 96, 255)
EGGPLANT = (92, 61, 122, 255)
LEMON = (242, 193, 78, 255)
LEMON_DEEP = (214, 150, 40, 255)
CARROT = (224, 122, 42, 255)
CARROT_DEEP = (184, 78, 24, 255)
PINK = (244, 168, 176, 255)
PINK_DEEP = (214, 112, 126, 255)
WOOD = (186, 124, 72, 255)
WOOD_DEEP = (128, 76, 40, 255)
SOIL = (112, 70, 42, 255)
SOIL_DEEP = (74, 46, 30, 255)
TEAL = (232, 236, 234, 255)
TEAL_DEEP = (186, 204, 202, 255)
NIGHT = (18, 42, 52, 255)
NIGHT_2 = (36, 78, 88, 255)
STAGE = (92, 58, 36, 255)
CURTAIN = (176, 36, 48, 255)
CURTAIN_DEEP = (120, 22, 36, 255)
DISC = (24, 18, 16, 255)
GROOVE = (68, 56, 48, 255)
SKY = (255, 186, 138, 255)
SKY_2 = (255, 228, 196, 255)
HILL = (118, 176, 104, 255)
HILL_2 = (42, 132, 74, 255)
BLUSH = (255, 214, 196, 255)
TILE = (255, 236, 224, 255)
COPPER = (196, 122, 72, 255)
SOUP = (214, 92, 48, 255)


def clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return lo if value < lo else hi if value > hi else value


def smooth(value: float) -> float:
    value = clamp(value)
    return value * value * (3 - 2 * value)


def seg(value: float, start: float, end: float) -> float:
    if end <= start:
        return 1.0 if value >= start else 0.0
    return smooth(clamp((value - start) / (end - start)))


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


class Frame:
    def __init__(self, width: int, height: int, image: Image.Image | None = None) -> None:
        self.w = width
        self.h = height
        self.im = image if image is not None else Image.new("RGBA", (width, height), (0, 0, 0, 0))
        self.m = float(min(width, height))

    @property
    def portrait(self) -> bool:
        return self.h > self.w

    def draw(self) -> ImageDraw.ImageDraw:
        return ImageDraw.Draw(self.im)

    def at(self, x: float, y: float) -> tuple[float, float]:
        return (x * self.w, y * self.h)

    def u(self, amount: float) -> float:
        return amount * self.m


def stroke(fr: Frame) -> float:
    return max(2.0, fr.m * 0.012)


def gradient(fr: Frame, top: tuple[int, int, int, int], bottom: tuple[int, int, int, int]) -> None:
    column = Image.new("RGBA", (1, fr.h))
    pixels = column.load()
    for y in range(fr.h):
        t = y / max(fr.h - 1, 1)
        pixels[0, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(4))
    fr.im.alpha_composite(column.resize((fr.w, fr.h), Image.Resampling.BILINEAR))


def ellipse(
    fr: Frame,
    cx: float,
    cy: float,
    rx: float,
    ry: float,
    fill: tuple[int, int, int, int],
    ink: bool = True,
) -> None:
    if rx < 0.5 or ry < 0.5:
        return
    box = [cx - rx, cy - ry, cx + rx, cy + ry]
    pen = fr.draw()
    if ink:
        pad = min(stroke(fr), min(rx, ry) * 0.22)
        pen.ellipse([box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad], fill=INK)
    pen.ellipse(box, fill=fill)


def rect(fr: Frame, x0: float, y0: float, x1: float, y1: float, fill: tuple[int, int, int, int]) -> None:
    fr.draw().rectangle([x0, y0, x1, y1], fill=fill)


def rrect(
    fr: Frame,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    radius: float,
    fill: tuple[int, int, int, int],
    ink: bool = False,
) -> None:
    pen = fr.draw()
    rad = max(0.0, radius)
    if ink:
        pad = stroke(fr)
        pen.rounded_rectangle([x0 - pad, y0 - pad, x1 + pad, y1 + pad], radius=rad + pad, fill=INK)
    pen.rounded_rectangle([x0, y0, x1, y1], radius=rad, fill=fill)


def poly(fr: Frame, pts: list[tuple[float, float]], fill: tuple[int, int, int, int], ink: bool = False) -> None:
    if len(pts) < 3:
        return
    pen = fr.draw()
    if ink:
        pen.line(pts + [pts[0]], fill=INK, width=int(stroke(fr) * 1.6), joint="curve")
    pen.polygon(pts, fill=fill)


def spin(fr: Frame, cx: float, cy: float, degrees: float, painter) -> None:
    layer = Image.new("RGBA", fr.im.size, (0, 0, 0, 0))
    painter(Frame(fr.w, fr.h, layer))
    rotated = layer.rotate(-degrees, resample=Image.Resampling.BICUBIC, center=(cx, cy))
    fr.im.alpha_composite(rotated)


def face(fr: Frame, cx: float, cy: float, size: float) -> None:
    if size < 14:
        return
    pen = fr.draw()
    eye = max(1.6, size * 0.075)
    pen.ellipse([cx - size * 0.22 - eye, cy - eye, cx - size * 0.22 + eye, cy + eye], fill=INK)
    pen.ellipse([cx + size * 0.22 - eye, cy - eye, cx + size * 0.22 + eye, cy + eye], fill=INK)
    pen.arc(
        [cx - size * 0.22, cy - size * 0.02, cx + size * 0.22, cy + size * 0.28],
        18,
        162,
        fill=INK,
        width=max(2, int(size * 0.055)),
    )


def tomato(fr: Frame, cx: float, cy: float, radius: float) -> None:
    if radius < 2:
        return
    ellipse(fr, cx, cy, radius, radius * 0.94, TOMATO)
    ellipse(fr, cx - radius * 0.28, cy - radius * 0.28, radius * 0.22, radius * 0.14, (255, 196, 176, 150), ink=False)
    ellipse(fr, cx, cy - radius * 0.78, radius * 0.16, radius * 0.18, LEAF)
    ellipse(fr, cx - radius * 0.28, cy - radius * 0.62, radius * 0.2, radius * 0.1, LEAF_DEEP)
    ellipse(fr, cx + radius * 0.28, cy - radius * 0.62, radius * 0.2, radius * 0.1, LEAF_DEEP)


def lemon(fr: Frame, cx: float, cy: float, radius: float) -> None:
    if radius < 2:
        return
    ellipse(fr, cx, cy, radius * 1.2, radius * 0.86, LEMON)
    ellipse(fr, cx, cy - radius * 0.78, radius * 0.1, radius * 0.16, LEMON_DEEP)
    ellipse(fr, cx - radius * 0.32, cy - radius * 0.16, radius * 0.16, radius * 0.1, (255, 236, 190, 160), ink=False)


def eggplant(fr: Frame, cx: float, cy: float, radius: float) -> None:
    if radius < 2:
        return
    ellipse(fr, cx, cy + radius * 0.12, radius * 0.7, radius, EGGPLANT)
    ellipse(fr, cx - radius * 0.18, cy - radius * 0.2, radius * 0.16, radius * 0.28, (150, 120, 176, 90), ink=False)
    ellipse(fr, cx, cy - radius * 0.92, radius * 0.28, radius * 0.16, LEAF)
    ellipse(fr, cx + radius * 0.24, cy - radius * 1.02, radius * 0.16, radius * 0.1, LEAF_LIGHT)


def radish(fr: Frame, cx: float, cy: float, radius: float, with_face: bool = True) -> None:
    if radius < 2:
        return
    ellipse(fr, cx + radius * 0.08, cy + radius * 1.05, radius * 0.14, radius * 0.42, PINK_DEEP)
    ellipse(fr, cx, cy, radius * 0.82, radius, PINK)
    ellipse(fr, cx - radius * 0.24, cy - radius * 0.28, radius * 0.18, radius * 0.12, (255, 226, 226, 150), ink=False)
    ellipse(fr, cx - radius * 0.08, cy - radius * 1.15, radius * 0.16, radius * 0.42, LEAF)
    ellipse(fr, cx + radius * 0.22, cy - radius * 1.22, radius * 0.14, radius * 0.36, LEAF_DEEP)
    if with_face:
        face(fr, cx, cy + radius * 0.08, radius)


def beet(fr: Frame, cx: float, cy: float, radius: float) -> None:
    ellipse(fr, cx, cy, radius, radius * 0.92, (150, 28, 58, 255))
    ellipse(fr, cx, cy, radius * 0.62, radius * 0.55, (186, 48, 72, 255), ink=False)
    ellipse(fr, cx, cy - radius * 0.95, radius * 0.12, radius * 0.28, LEAF)
    ellipse(fr, cx - radius * 0.22, cy - radius * 0.82, radius * 0.18, radius * 0.1, LEAF_LIGHT)


def carrot(fr: Frame, cx: float, cy: float, length: float, angle: float) -> None:
    def paint(ghost: Frame) -> None:
        tip = (cx, cy + length * 0.55)
        left = (cx - length * 0.16, cy - length * 0.15)
        right = (cx + length * 0.16, cy - length * 0.15)
        poly(ghost, [left, right, tip], CARROT, ink=True)
        ellipse(ghost, cx - length * 0.08, cy - length * 0.28, length * 0.08, length * 0.22, LEAF)
        ellipse(ghost, cx + length * 0.1, cy - length * 0.34, length * 0.07, length * 0.2, LEAF_DEEP)
    spin(fr, cx, cy, angle, paint)


def eighth(fr: Frame, cx: float, cy: float, size: float, color: tuple[int, int, int, int]) -> None:
    if size < 2:
        return
    ellipse(fr, cx, cy, size * 0.46, size * 0.32, color)
    pen = fr.draw()
    width = max(2, int(size * 0.14))
    stem_x = cx + size * 0.36
    pen.line([(stem_x, cy - size * 0.02), (stem_x, cy - size * 1.45)], fill=color, width=width)
    pen.polygon(
        [
            (stem_x - width * 0.3, cy - size * 1.45),
            (stem_x + size * 0.85, cy - size * 1.05),
            (stem_x + size * 0.62, cy - size * 0.82),
            (stem_x - width * 0.3, cy - size * 1.05),
        ],
        fill=color,
    )


def vinyl(fr: Frame, cx: float, cy: float, radius: float, angle: float, label: tuple[int, int, int, int] = TOMATO) -> None:
    if radius < 4:
        return
    ellipse(fr, cx, cy, radius, radius, DISC)
    pen = fr.draw()
    for scale in (0.84, 0.72, 0.6, 0.48):
        pen.ellipse(
            [cx - radius * scale, cy - radius * scale, cx + radius * scale, cy + radius * scale],
            outline=GROOVE,
            width=max(1, int(radius * 0.018)),
        )
    ellipse(fr, cx, cy, radius * 0.33, radius * 0.33, label)
    theta = math.radians(angle)
    wedge = []
    for delta in (-0.55, 0.55):
        wedge.append((cx + math.cos(theta + delta) * radius * 0.3, cy + math.sin(theta + delta) * radius * 0.3))
    wedge.append((cx + math.cos(theta) * radius * 0.02, cy + math.sin(theta) * radius * 0.02))
    pen.polygon(wedge, fill=CREAM)
    ellipse(fr, cx, cy, radius * 0.055, radius * 0.055, DISC)


def leaf_bit(fr: Frame, cx: float, cy: float, radius: float, angle: float = -30) -> None:
    def paint(ghost: Frame) -> None:
        ellipse(ghost, cx, cy, radius * 0.42, radius, LEAF)
        ghost.draw().line(
            [(cx, cy + radius * 0.7), (cx, cy - radius * 0.7)],
            fill=LEAF_DEEP,
            width=max(1, int(radius * 0.12)),
        )
    spin(fr, cx, cy, angle, paint)


def can(fr: Frame, cx: float, cy: float, size: float, angle: float) -> None:
    def paint(ghost: Frame) -> None:
        rrect(ghost, cx - size * 0.42, cy - size * 0.22, cx + size * 0.28, cy + size * 0.32, size * 0.12, (64, 150, 168, 255), ink=True)
        poly(
            ghost,
            [
                (cx + size * 0.2, cy - size * 0.08),
                (cx + size * 0.78, cy - size * 0.28),
                (cx + size * 0.86, cy - size * 0.12),
                (cx + size * 0.24, cy + size * 0.08),
            ],
            (64, 150, 168, 255),
            ink=True,
        )
        ellipse(ghost, cx + size * 0.84, cy - size * 0.2, size * 0.1, size * 0.1, (40, 110, 126, 255))
        pen = ghost.draw()
        pen.arc(
            [cx - size * 0.72, cy - size * 0.28, cx - size * 0.18, cy + size * 0.36],
            100,
            260,
            fill=INK,
            width=max(3, int(size * 0.07)),
        )
    spin(fr, cx, cy, angle, paint)


def drops(fr: Frame, x0: float, y0: float, t: float) -> None:
    for index in range(5):
        phase = (t * 1.3 + index * 0.18) % 1
        if phase < 0.12:
            continue
        x = x0 + phase * fr.u(0.08)
        y = y0 + phase * phase * fr.u(0.28)
        ellipse(fr, x, y, fr.u(0.012), fr.u(0.018), (120, 196, 220, 230), ink=False)


def checker(fr: Frame, first: tuple[int, int, int, int], second: tuple[int, int, int, int], size: float) -> None:
    pen = fr.draw()
    row = 0
    y = 0.0
    while y < fr.h:
        col = 0
        x = 0.0
        while x < fr.w:
            pen.rectangle([x, y, x + size + 1, y + size + 1], fill=first if (row + col) % 2 == 0 else second)
            x += size
            col += 1
        y += size
        row += 1


def scene_sprout(fr: Frame, t: float) -> None:
    gradient(fr, SKY, SKY_2)
    sun = fr.at(0.8, 0.16 if fr.portrait else 0.2)
    ellipse(fr, sun[0], sun[1], fr.u(0.16), fr.u(0.16), LEMON)
    ellipse(fr, sun[0] - fr.u(0.04), sun[1] - fr.u(0.04), fr.u(0.05), fr.u(0.04), CREAM, ink=False)
    hill_y = 0.62 if fr.portrait else 0.72
    ellipse(fr, *fr.at(0.28, hill_y), fr.w * 0.42, fr.h * 0.16, HILL, ink=False)
    ellipse(fr, *fr.at(0.72, hill_y + 0.06), fr.w * 0.48, fr.h * 0.14, HILL_2, ink=False)
    soil_y = fr.h * (0.7 if fr.portrait else 0.78)
    rect(fr, 0, soil_y, fr.w, fr.h, SOIL)
    rect(fr, 0, soil_y, fr.w, soil_y + fr.u(0.03), SOIL_DEEP)
    seed = fr.at(0.5, 0.73 if fr.portrait else 0.83)
    split = seg(t, 0.12, 0.4) * fr.u(0.03)
    ellipse(fr, seed[0] - split, seed[1], fr.u(0.045), fr.u(0.03), EGGPLANT)
    grow = seg(t, 0.18, 0.72)
    height = grow * (fr.h * (0.32 if fr.portrait else 0.38))
    if height > 2:
        base = seed[1] - fr.u(0.02)
        top = base - height
        bend = fr.u(0.05)
        left = []
        right = []
        steps = 12
        for step in range(steps + 1):
            p = step / steps
            y = lerp(base, top, p)
            x = seed[0] + bend * math.sin(p * math.pi)
            width = lerp(fr.u(0.02), fr.u(0.007), p)
            left.append((x - width, y))
            right.append((x + width, y))
        poly(fr, left + list(reversed(right)), LEAF, ink=True)
        leaf_scale = seg(t, 0.55, 0.9)
        crown_x = seed[0] + bend * math.sin(math.pi)
        if leaf_scale > 0.02:
            leaf_bit(fr, crown_x - fr.u(0.03), top, fr.u(0.09) * leaf_scale, -55)
            leaf_bit(fr, crown_x + fr.u(0.035), top + fr.u(0.01), fr.u(0.08) * leaf_scale, 42)
    can_center = fr.at(0.2, 0.5 if fr.portrait else 0.58)
    tilt = lerp(-16, 26, seg(t, 0.08, 0.5))
    can(fr, can_center[0], can_center[1], fr.u(0.2), tilt)
    spout = (
        can_center[0] + math.cos(math.radians(tilt)) * fr.u(0.12),
        can_center[1] - fr.u(0.08) + math.sin(math.radians(tilt)) * fr.u(0.04),
    )
    drops(fr, spout[0], spout[1], t)
    note_scale = seg(t, 0.62, 0.95)
    if note_scale > 0.05:
        eighth(fr, *fr.at(0.66, 0.3 if fr.portrait else 0.34), fr.u(0.07) * note_scale, LEMON_DEEP)
        eighth(fr, *fr.at(0.74, 0.22 if fr.portrait else 0.24), fr.u(0.05) * note_scale, TOMATO)
    if seg(t, 0.7, 1) > 0.2:
        radish(fr, *fr.at(0.38, 0.66 if fr.portrait else 0.74), fr.u(0.07))


def scene_market(fr: Frame, t: float) -> None:
    rect(fr, 0, 0, fr.w, fr.h, (255, 236, 214, 255))
    stripe = max(12.0, fr.w * 0.045)
    pen = fr.draw()
    awning_bottom = fr.h * (0.16 if fr.portrait else 0.2)
    x = 0.0
    index = 0
    while x < fr.w:
        pen.rectangle([x, 0, x + stripe + 1, awning_bottom], fill=TOMATO if index % 2 == 0 else CREAM)
        x += stripe
        index += 1
    radius = stripe * 0.72
    x = 0.0
    index = 0
    while x < fr.w:
        ellipse(fr, x + radius, awning_bottom, radius, radius * 0.85, TOMATO if index % 2 == 0 else EGGPLANT)
        x += stripe
        index += 1
    counter = fr.h * (0.72 if fr.portrait else 0.78)
    rect(fr, 0, counter, fr.w, fr.h, WOOD)
    rect(fr, 0, counter, fr.w, counter + fr.u(0.02), WOOD_DEEP)
    crates = (
        (0.18, 0.05, 0.0),
        (0.42, 0.0, 0.12),
        (0.66, 0.04, 0.24),
    )
    foods = (
        lambda fr, cx, cy, s: tomato(fr, cx, cy - s * 0.2, s * 0.34),
        lambda fr, cx, cy, s: lemon(fr, cx, cy - s * 0.15, s * 0.3),
        lambda fr, cx, cy, s: eggplant(fr, cx, cy - s * 0.2, s * 0.32),
    )
    for slot, (x_frac, lift, delay) in enumerate(crates):
        rise = lerp(0.55, 1, seg(t, 0.05 + delay, 0.45 + delay))
        width = fr.w * (0.24 if fr.portrait else 0.2)
        height = fr.u(0.16)
        cx = fr.w * x_frac + width * 0.5
        bottom = counter - lerp(fr.u(0.02), height * 0.15, rise)
        top = bottom - height
        left = cx - width / 2
        rrect(fr, left, top, left + width, bottom, fr.u(0.015), WOOD_DEEP, ink=True)
        pen.line([(left + width * 0.08, top + height * 0.45), (left + width * 0.92, top + height * 0.45)], fill=WOOD, width=max(2, int(fr.u(0.01))))
        pop = lerp(0.72, 1, seg(t, 0.12 + delay, 0.58 + delay))
        foods[slot](fr, cx, top, width * pop)
    vinyl(
        fr,
        *fr.at(0.84, 0.36 if fr.portrait else 0.4),
        fr.u(0.15 if fr.portrait else 0.13),
        lerp(-18, 10, t),
        LEAF,
    )
    if seg(t, 0.55, 0.9) > 0.3:
        radish(fr, *fr.at(0.22, 0.6 if fr.portrait else 0.66), fr.u(0.055))
    eighth(fr, *fr.at(0.1, 0.32), fr.u(0.045) * seg(t, 0.4, 0.8), EGGPLANT)


def scene_chop(fr: Frame, t: float) -> None:
    checker(fr, CREAM, TILE, max(18.0, fr.w * (0.08 if fr.portrait else 0.055)))
    board = (
        fr.w * (0.12 if fr.portrait else 0.16),
        fr.h * (0.28 if fr.portrait else 0.18),
        fr.w * (0.88 if fr.portrait else 0.84),
        fr.h * (0.7 if fr.portrait else 0.82),
    )
    slide = lerp(fr.h * 0.08, 0, seg(t, 0.0, 0.35))
    rrect(fr, board[0], board[1] + slide, board[2], board[3] + slide, fr.u(0.03), WOOD, ink=True)
    inner = fr.u(0.02)
    pen = fr.draw()
    pen.rounded_rectangle(
        [board[0] + inner, board[1] + slide + inner, board[2] - inner, board[3] + slide - inner],
        radius=fr.u(0.02),
        outline=WOOD_DEEP,
        width=max(2, int(fr.u(0.008))),
    )
    cx = (board[0] + board[2]) / 2
    cy = (board[1] + board[3]) / 2 + slide
    beet(fr, cx + fr.u(0.14), cy + fr.u(0.02), fr.u(0.11))
    for offset, height in ((-0.08, 0.2), (0.04, 0.24)):
        stand_x = cx + fr.u(offset)
        pen.line(
            [(stand_x, cy + fr.u(0.02)), (stand_x, cy - fr.u(height))],
            fill=INK,
            width=max(3, int(fr.u(0.012))),
        )
        ellipse(fr, stand_x, cy - fr.u(height), fr.u(0.055), fr.u(0.02), LEMON if offset < 0 else CARROT)
    hit = 0.0
    for center in (0.38, 0.68):
        dist = abs(t - center)
        if dist < 0.12:
            hit += math.sin((1 - dist / 0.12) * math.pi)
    carrot(fr, cx - fr.u(0.16), cy + fr.u(0.02), fr.u(0.22), lerp(-28, 8, hit))
    carrot(fr, cx - fr.u(0.05), cy + fr.u(0.04), fr.u(0.2), lerp(24, -6, hit))
    pieces = seg(t, 0.45, 0.85)
    if pieces > 0.05:
        for index, ox in enumerate((-0.18, -0.08, 0.02, 0.1)):
            tomato(fr, cx + fr.w * ox, cy + fr.u(0.12), fr.u(0.025) * pieces)
    radish(fr, board[0] + fr.u(0.1), board[1] + slide + fr.u(0.12), fr.u(0.05) * seg(t, 0.3, 0.7))


def scene_simmer(fr: Frame, t: float) -> None:
    gradient(fr, NIGHT_2, NIGHT)
    stove_top = fr.h * (0.62 if fr.portrait else 0.68)
    rect(fr, fr.w * 0.08, stove_top, fr.w * 0.92, fr.h, (28, 36, 40, 255))
    ellipse(fr, fr.w * 0.5, stove_top + fr.u(0.02), fr.u(0.16), fr.u(0.05), (48, 56, 60, 255), ink=False)
    pot_w = fr.u(0.34)
    pot_h = fr.u(0.22)
    cx, cy = fr.at(0.5, 0.5 if fr.portrait else 0.52)
    rrect(fr, cx - pot_w, cy - pot_h * 0.2, cx + pot_w, cy + pot_h, fr.u(0.04), TEAL, ink=True)
    ellipse(fr, cx, cy - pot_h * 0.15, pot_w * 1.05, pot_h * 0.42, TEAL_DEEP)
    ellipse(fr, cx, cy - pot_h * 0.12, pot_w * 0.82, pot_h * 0.28, SOUP, ink=False)
    rrect(fr, cx - pot_w - fr.u(0.06), cy + pot_h * 0.15, cx - pot_w + fr.u(0.02), cy + pot_h * 0.55, fr.u(0.02), COPPER, ink=True)
    rrect(fr, cx + pot_w - fr.u(0.02), cy + pot_h * 0.15, cx + pot_w + fr.u(0.06), cy + pot_h * 0.55, fr.u(0.02), COPPER, ink=True)
    for index, ox in enumerate((-0.35, -0.1, 0.15, 0.38, 0.0)):
        phase = (t * 1.15 + index * 0.2) % 1
        bubble_x = cx + ox * pot_w
        bubble_y = cy - pot_h * 0.12 - phase * pot_h * 0.55
        if bubble_y > cy - pot_h * 0.55:
            ellipse(fr, bubble_x, bubble_y, fr.u(0.012 + phase * 0.01), fr.u(0.01), CREAM, ink=False)
    for col in range(3):
        for step in range(7):
            phase = (t * 0.8 + step / 7 + col * 0.13) % 1
            sx = cx + (col - 1) * fr.u(0.06) + math.sin(phase * math.tau * 2) * fr.u(0.025)
            sy = cy - pot_h * 0.45 - phase * fr.h * (0.22 if fr.portrait else 0.28)
            radius = fr.u(0.012) * (1.3 - phase)
            alpha = int(170 * (1 - phase))
            ellipse(fr, sx, sy, radius, radius, (255, 248, 238, alpha), ink=False)
    def spoon(ghost: Frame) -> None:
        ghost.draw().line(
            [(cx + pot_w * 0.2, cy), (cx + pot_w * 1.35, cy - pot_h * 1.1)],
            fill=WOOD,
            width=max(4, int(fr.u(0.02))),
        )
        ellipse(ghost, cx + pot_w * 0.15, cy + pot_h * 0.05, fr.u(0.045), fr.u(0.03), WOOD_DEEP)
    spin(fr, cx, cy, lerp(18, -8, seg(t, 0.2, 0.8)), spoon)
    radish(fr, cx - pot_w * 1.25, stove_top - fr.u(0.06), fr.u(0.055))


def scene_platter(fr: Frame, t: float) -> None:
    rect(fr, 0, 0, fr.w, fr.h, TOMATO_DEEP)
    ellipse(fr, fr.w * 0.5, fr.h * 0.52, fr.w * (0.42 if fr.portrait else 0.4), fr.h * (0.32 if fr.portrait else 0.42), WOOD)
    ellipse(fr, fr.w * 0.5, fr.h * 0.52, fr.w * (0.36 if fr.portrait else 0.34), fr.h * (0.26 if fr.portrait else 0.34), WOOD_DEEP, ink=False)
    cx, cy = fr.w * 0.5, fr.h * (0.46 if fr.portrait else 0.5)
    vinyl(fr, cx, cy, fr.u(0.18), t * 40, EGGPLANT)
    dishes = (
        (0, -1, tomato),
        (0.9, -0.35, lemon),
        (0.6, 0.85, eggplant),
        (-0.7, 0.75, lambda fr, x, y, r: radish(fr, x, y, r, False)),
        (-0.95, -0.2, beet),
    )
    for index, (dx, dy, draw_food) in enumerate(dishes):
        arrive = seg(t, 0.08 + index * 0.08, 0.4 + index * 0.08)
        dist = lerp(fr.u(0.42), fr.u(0.28), arrive)
        px = cx + dx * dist
        py = cy + dy * dist * (1.15 if fr.portrait else 0.85)
        ellipse(fr, px, py, fr.u(0.07), fr.u(0.07), CREAM)
        draw_food(fr, px, py, fr.u(0.04) * max(arrive, 0.15))
    def fork(ghost: Frame) -> None:
        length = fr.u(0.34)
        width = max(3, int(fr.u(0.016)))
        ghost.draw().line([(cx, cy), (cx + length, cy)], fill=(226, 222, 214, 255), width=width)
        for tooth in range(4):
            tx = cx + length - fr.u(0.01)
            ty = cy - fr.u(0.03) + tooth * fr.u(0.02)
            ghost.draw().line([(tx, ty), (tx + fr.u(0.045), ty)], fill=(226, 222, 214, 255), width=max(2, width // 2))
    spin(fr, cx + fr.u(0.22), cy - fr.u(0.2), lerp(-70, -18, seg(t, 0.25, 0.85)), fork)
    leaf_bit(fr, cx + fr.u(0.02), cy + fr.u(0.22), fr.u(0.04) * seg(t, 0.5, 0.9), 20)


def scene_encore(fr: Frame, t: float) -> None:
    rect(fr, 0, 0, fr.w, fr.h, (42, 20, 58, 255))
    opened = seg(t, 0.0, 0.6)
    left = lerp(fr.w * 0.52, fr.w * 0.08, opened)
    right = lerp(fr.w * 0.48, fr.w * 0.92, opened)
    rect(fr, 0, 0, left, fr.h * 0.78, CURTAIN)
    rect(fr, right, 0, fr.w, fr.h * 0.78, CURTAIN)
    pen = fr.draw()
    fold = max(8.0, fr.w * 0.02)
    x = fold
    while x < left:
        pen.line([(x, 0), (x, fr.h * 0.78)], fill=CURTAIN_DEEP, width=max(2, int(fold * 0.35)))
        x += fold * 2.2
    x = right + fold
    while x < fr.w:
        pen.line([(x, 0), (x, fr.h * 0.78)], fill=CURTAIN_DEEP, width=max(2, int(fold * 0.35)))
        x += fold * 2.2
    stage_y = fr.h * (0.58 if fr.portrait else 0.62)
    poly(
        fr,
        [(fr.w * 0.12, stage_y), (fr.w * 0.88, stage_y), (fr.w, fr.h), (0, fr.h)],
        STAGE,
        ink=False,
    )
    beam = lerp(fr.w * 0.04, fr.w * 0.22, seg(t, 0.25, 0.8))
    poly(
        fr,
        [(fr.w * 0.5, 0), (fr.w * 0.5 - beam, stage_y), (fr.w * 0.5 + beam, stage_y)],
        (255, 214, 140, 80),
        ink=False,
    )
    star = seg(t, 0.35, 0.7)
    if star > 0.05:
        radish(fr, fr.w * 0.44, stage_y - fr.u(0.02), fr.u(0.1) * star)
    mic_x = fr.w * 0.64
    rrect(fr, mic_x - fr.u(0.018), stage_y - fr.u(0.2), mic_x + fr.u(0.018), stage_y - fr.u(0.02), fr.u(0.01), CREAM, ink=True)
    ellipse(fr, mic_x - fr.u(0.02), stage_y - fr.u(0.2), fr.u(0.02), fr.u(0.055), LEAF)
    ellipse(fr, mic_x + fr.u(0.025), stage_y - fr.u(0.22), fr.u(0.016), fr.u(0.05), LEAF_DEEP)
    ellipse(fr, mic_x, stage_y - fr.u(0.26), fr.u(0.04), fr.u(0.045), DISC)
    ellipse(fr, mic_x, stage_y - fr.u(0.26), fr.u(0.018), fr.u(0.018), (90, 90, 90, 255), ink=False)
    colors = (TOMATO, LEMON, EGGPLANT, CARROT, LEAF, PINK, LEMON_DEEP)
    for index, color in enumerate(colors):
        pop = seg(t, 0.45 + index * 0.04, 0.65 + index * 0.04)
        span = fr.w * 0.8
        hx = fr.w * 0.1 + span * (index / (len(colors) - 1))
        hy = lerp(fr.h * 0.9, stage_y + fr.u(0.08), pop)
        ellipse(fr, hx, hy, fr.u(0.035), fr.u(0.035), color)
    if seg(t, 0.6, 1) > 0.2:
        eighth(fr, fr.w * 0.32, fr.h * 0.28, fr.u(0.05), LEMON)
        eighth(fr, fr.w * 0.7, fr.h * 0.22, fr.u(0.04), CREAM)


def scene_cover(fr: Frame, t: float) -> None:
    gradient(fr, PAPER, (255, 226, 196, 255))
    cx, cy = fr.at(0.56 if not fr.portrait else 0.5, 0.52)
    vinyl(fr, cx, cy, fr.u(0.28), 24 + t * 20, TOMATO)
    orbit = (
        (0.0, tomato, 0.1),
        (1.1, lemon, 0.09),
        (2.3, eggplant, 0.1),
        (3.4, lambda fr, x, y, r: carrot(fr, x, y, r * 2.2, -20), 0.08),
        (4.4, lambda fr, x, y, r: radish(fr, x, y, r), 0.09),
        (5.3, beet, 0.08),
    )
    for index, (angle, draw_food, size) in enumerate(orbit):
        theta = angle + t * 0.6
        radius = fr.u(0.42)
        x = cx + math.cos(theta) * radius
        y = cy + math.sin(theta) * radius * (0.72 if not fr.portrait else 0.9)
        draw_food(fr, x, y, fr.u(size))
    eighth(fr, *fr.at(0.16, 0.22), fr.u(0.06), EGGPLANT)
    eighth(fr, *fr.at(0.84, 0.18), fr.u(0.05), LEAF)


def scene_finale(fr: Frame, t: float) -> None:
    rect(fr, 0, 0, fr.w, fr.h, PAPER)
    spots = (
        (0.12, 0.16, tomato, 0.06),
        (0.86, 0.14, lemon, 0.055),
        (0.1, 0.84, eggplant, 0.06),
        (0.88, 0.82, beet, 0.05),
        (0.2, 0.48, lambda fr, x, y, r: eighth(fr, x, y, r * 1.6, LEAF), 0.04),
        (0.82, 0.5, lambda fr, x, y, r: eighth(fr, x, y, r * 1.4, CARROT), 0.035),
    )
    for index, (x, y, draw_food, size) in enumerate(spots):
        scale = seg(t, index * 0.05, 0.35 + index * 0.05)
        if scale <= 0.02:
            continue
        draw_food(fr, *fr.at(x, y), fr.u(size) * scale)


def scene_vinyl(fr: Frame, t: float) -> None:
    rect(fr, 0, 0, fr.w, fr.h, PAPER)
    vinyl(fr, fr.w / 2, fr.h / 2, fr.m * 0.46, t * 360, TOMATO)


SCENES = {
    "sprout": scene_sprout,
    "market": scene_market,
    "chop": scene_chop,
    "simmer": scene_simmer,
    "platter": scene_platter,
    "encore": scene_encore,
}

CUES = {
    "sprout": 392.0,
    "market": 440.0,
    "chop": 523.25,
    "simmer": 329.63,
    "platter": 587.33,
    "encore": 659.25,
    "finale": 783.99,
}


def render_image(painter, width: int, height: int, t: float, scale: int) -> Image.Image:
    frame = Frame(width * scale, height * scale)
    painter(frame, t)
    image = frame.im
    if scale != 1:
        image = image.resize((width, height), Image.Resampling.LANCZOS)
    return image.convert("RGB")


def save_webp(image: Image.Image, path: Path, quality: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "WEBP", quality=quality, method=6)


def encode_clip(painter, width: int, height: int, frames: int, fps: int, dest: Path, scale: int) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="scroll-scene-") as raw:
        folder = Path(raw)
        for index in range(frames):
            t = index / max(frames - 1, 1)
            image = render_image(painter, width, height, t, scale)
            image.save(folder / f"f{index:03d}.png", "PNG")
        command = [
            "ffmpeg",
            "-y",
            "-framerate",
            str(fps),
            "-i",
            str(folder / "f%03d.png"),
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-tune",
            "animation",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "28",
            "-g",
            "1",
            "-movflags",
            "+faststart",
            "-an",
            str(dest),
        ]
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def encode_loop(scale: int) -> None:
    dest = MEDIA / "loops" / "vinyl.mp4"
    dest.parent.mkdir(parents=True, exist_ok=True)
    frames = 24
    with tempfile.TemporaryDirectory(prefix="scroll-loop-") as raw:
        folder = Path(raw)
        for index in range(frames):
            image = render_image(scene_vinyl, 480, 480, index / frames, scale)
            image.save(folder / f"f{index:03d}.png")
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-framerate",
                "12",
                "-i",
                str(folder / "f%03d.png"),
                "-c:v",
                "libx264",
                "-preset",
                "slow",
                "-tune",
                "animation",
                "-pix_fmt",
                "yuv420p",
                "-crf",
                "26",
                "-g",
                "1",
                "-movflags",
                "+faststart",
                "-an",
                str(dest),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )


def write_audio() -> None:
    audio = MEDIA / "audio"
    audio.mkdir(parents=True, exist_ok=True)
    ambient = audio / "ambient.m4a"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=220:duration=16",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=275:duration=16",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=330:duration=16",
            "-filter_complex",
            "[0][1][2]amix=inputs=3:normalize=0,lowpass=f=900,volume=0.22",
            "-c:a",
            "aac",
            "-b:a",
            "64k",
            str(ambient),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    for name, freq in CUES.items():
        dest = audio / f"cue-{name}.m4a"
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "lavfi",
                "-i",
                f"sine=frequency={freq}:duration=0.42",
                "-af",
                "afade=t=in:st=0:d=0.01,afade=t=out:st=0.08:d=0.34,lowpass=f=2400,volume=0.8",
                "-c:a",
                "aac",
                "-b:a",
                "64k",
                str(dest),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )


def build(scale: int, only: str) -> None:
    names = [only] if only else list(SCENES)
    for name in names:
        painter = SCENES[name]
        print(f"scene {name}")
        save_webp(render_image(painter, 1600, 900, 0.84, scale), MEDIA / "stills" / f"{name}.webp", 76)
        save_webp(render_image(painter, 960, 540, 0.08, 1), MEDIA / "posters" / f"{name}.webp", 68)
        encode_clip(painter, 960, 540, 36, 12, MEDIA / "clips" / f"{name}-desktop.mp4", scale)
        encode_clip(painter, 540, 960, 36, 12, MEDIA / "clips" / f"{name}-mobile.mp4", scale)
    if not only or only == "cover":
        print("cover")
        save_webp(render_image(scene_cover, 1600, 900, 0.35, scale), MEDIA / "stills" / "cover.webp", 76)
    if not only or only == "finale":
        print("finale")
        save_webp(render_image(scene_finale, 1600, 900, 1, scale), MEDIA / "stills" / "finale.webp", 76)
    if not only:
        print("loop")
        save_webp(render_image(scene_vinyl, 480, 480, 0, 1), MEDIA / "stills" / "vinyl.webp", 74)
        encode_loop(1)
        print("audio")
        write_audio()


def preview(scale: int, only: str) -> None:
    out = ROOT / "tmp" / "preview"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    names = [only] if only else list(SCENES)
    for name in names:
        painter = SCENES[name]
        for label, size in (("land", (960, 540)), ("port", (540, 960))):
            for t in (0.2, 0.55, 0.85):
                image = render_image(painter, size[0], size[1], t, scale)
                image.save(out / f"{name}-{label}-{int(t * 100)}.png")
    if not only:
        render_image(scene_cover, 960, 540, 0.35, scale).save(out / "cover.png")
        render_image(scene_finale, 960, 540, 1, scale).save(out / "finale.png")
        render_image(scene_vinyl, 480, 480, 0.25, scale).save(out / "vinyl.png")
    print(out)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", action="store_true")
    parser.add_argument("--scene", default="")
    parser.add_argument("--scale", type=int, default=2)
    args = parser.parse_args()
    if args.preview:
        preview(max(1, args.scale), args.scene)
        return
    build(max(1, args.scale), args.scene)


if __name__ == "__main__":
    main()
