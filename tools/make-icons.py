#!/usr/bin/env python3
"""Regenerate the PNG app icons in icons/. Standard library only (zlib + struct).

Each icon is a deep-teal square with a centered soft-aqua disc. Maskable icons use a
smaller disc so it stays inside the platform's safe zone when cropped to a shape.
"""
import os
import struct
import zlib

BG = (0x0E, 0x22, 0x30)
DISC = (0x9E, 0xD9, 0xCC)
SAMPLES = 4  # supersampling per axis for a smooth disc edge

ICONS = [
    ("icon-192.png", 192, 0.62),
    ("icon-512.png", 512, 0.62),
    ("icon-maskable-512.png", 512, 0.50),
    ("apple-touch-icon.png", 180, 0.62),
]


def chunk(kind, data):
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def render(size, ratio):
    center = size / 2
    radius = size * ratio / 2
    r2 = radius * radius
    step = 1 / SAMPLES
    offsets = [(i + 0.5) * step for i in range(SAMPLES)]
    rows = bytearray()
    for y in range(size):
        rows.append(0)  # filter type: none
        for x in range(size):
            hits = 0
            for oy in offsets:
                dy = y + oy - center
                for ox in offsets:
                    dx = x + ox - center
                    if dx * dx + dy * dy <= r2:
                        hits += 1
            a = hits / (SAMPLES * SAMPLES)
            for bg, fg in zip(BG, DISC):
                rows.append(round(bg + (fg - bg) * a))
            rows.append(255)  # fully opaque
    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(bytes(rows), 9))
        + chunk(b"IEND", b"")
    )


def main():
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
    os.makedirs(out_dir, exist_ok=True)
    for name, size, ratio in ICONS:
        path = os.path.normpath(os.path.join(out_dir, name))
        with open(path, "wb") as f:
            f.write(render(size, ratio))
        print(f"wrote {path} ({size}x{size})")


if __name__ == "__main__":
    main()
