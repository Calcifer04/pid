#!/usr/bin/env python3
"""
πD icon — quiet luxury (Apple-grade), not neon malware.

- Full-bleed opaque square (iOS applies squircle)
- Real typography (πD), matte mark, no bloom
- Subtle material depth only
"""
from __future__ import annotations

import hashlib
import math
import struct
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
PUBLIC.mkdir(exist_ok=True)

# Quiet luxury palette
BG_TOP = (18, 18, 20)
BG_BOT = (8, 8, 10)
MARK = (90, 247, 142)  # brand green, matte — no glow
MARK_SOFT = (72, 210, 120)


def find_font(size: int) -> ImageFont.FreeTypeFont:
    # Prefer clean modern UI faces
    for path in (
        r"C:\Windows\Fonts\segoeuib.ttf",   # Segoe UI Bold
        r"C:\Windows\Fonts\seguisb.ttf",    # Semibold
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ):
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            continue
    return ImageFont.load_default()  # type: ignore


def vertical_gradient(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        # ease
        t = t * t * (3 - 2 * t)
        r = int(BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * t)
        for x in range(size):
            px[x, y] = (r, g, b)
    return img


def soft_vignette(img: Image.Image, strength: float = 0.22) -> Image.Image:
    size = img.size[0]
    cx = cy = size / 2
    maxr = math.hypot(cx, cy)
    base = img.convert("RGB")
    px = base.load()
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy) / maxr
            t = max(0.0, d - 0.35) / 0.65
            t = t * t
            shade = 1.0 - strength * t
            r, g, b = px[x, y]
            px[x, y] = (int(r * shade), int(g * shade), int(b * shade))
    return base


def squircle_mask(size: int, n: float = 5.0) -> Image.Image:
    """
    iOS-like continuous corner (superellipse / squircle).
    n≈5 approximates Apple's app-icon shape better than a plain rounded-rect.
    """
    mask = Image.new("L", (size, size), 0)
    px = mask.load()
    c = (size - 1) / 2.0
    # slight inset so edge AA doesn't clip
    rad = c * 0.995
    for y in range(size):
        ny = abs(y - c) / rad
        for x in range(size):
            nx = abs(x - c) / rad
            # |x|^n + |y|^n <= 1
            if nx**n + ny**n <= 1.0:
                px[x, y] = 255
            else:
                # soft AA band
                v = nx**n + ny**n
                if v < 1.04:
                    t = (v - 1.0) / 0.04
                    px[x, y] = int(255 * (1.0 - t))
    # slight blur for premium AA on large masters
    if size >= 128:
        mask = mask.filter(ImageFilter.GaussianBlur(radius=max(0.4, size * 0.0012)))
    return mask


def apply_squircle(rgb: Image.Image) -> Image.Image:
    """RGB tile -> RGBA squirled app icon (transparent outside)."""
    size = rgb.size[0]
    rgba = rgb.convert("RGBA")
    mask = squircle_mask(size)
    r, g, b, _ = rgba.split()
    return Image.merge("RGBA", (r, g, b, mask))


def draw_master(size: int = 1024) -> Image.Image:
    """Returns RGBA squirled icon (Apple app shape)."""
    # Supersample for crisp type + smooth squircle
    ss = 2 if size >= 256 else 4
    S = size * ss

    bg = vertical_gradient(S)
    bg = soft_vignette(bg, 0.18)

    # Very subtle top edge light (material, not neon)
    light = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ld = ImageDraw.Draw(light)
    for i in range(S // 3):
        a = int(16 * (1 - i / (S / 3)))
        ld.line([(0, i), (S, i)], fill=(255, 255, 255, a))
    canvas = Image.alpha_composite(bg.convert("RGBA"), light)

    # Typography — slightly smaller so mark sits inside squircle safe zone
    text = "πD"
    font = find_font(int(S * 0.40))

    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (S - tw) / 2 - bbox[0]
    y = (S - th) / 2 - bbox[1] - S * 0.02

    # Tiny contact shadow (depth, not glow)
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.text((x, y + S * 0.012), text, font=font, fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(1, S // 80)))
    canvas = Image.alpha_composite(canvas, shadow)

    # Matte mark
    d.text((x, y), text, font=font, fill=(*MARK, 255))
    canvas = Image.alpha_composite(canvas, layer)

    # Downscale first (cheaper), then squircle at target res for clean edges
    out = canvas.resize((size, size), Image.Resampling.LANCZOS)
    flat = Image.new("RGB", (size, size), BG_BOT)
    flat.paste(out.convert("RGB"), (0, 0))
    flat = ImageEnhance.Contrast(flat).enhance(1.03)
    return apply_squircle(flat)


def make_bmp_ico(images: list[Image.Image], path: Path) -> None:
    parts = []
    for im in images:
        im = im.convert("RGBA")
        w, h = im.size
        if w > 256:
            continue
        pix = im.load()
        xor = bytearray()
        for y in range(h - 1, -1, -1):
            for x in range(w):
                r, g, b, a = pix[x, y]
                xor += bytes((b, g, r, a))
        row_and = ((w + 31) // 32) * 4
        and_mask = bytes(row_and * h)
        bih = struct.pack(
            "<IIIHHIIIIII", 40, w, h * 2, 1, 32, 0, len(xor), 0, 0, 0, 0
        )
        parts.append((w, h, bih + bytes(xor) + and_mask))

    count = len(parts)
    offset = 6 + 16 * count
    out = struct.pack("<HHH", 0, 1, count)
    blobs = b""
    for w, h, blob in parts:
        wb = 0 if w >= 256 else w
        hb = 0 if h >= 256 else h
        out += struct.pack("<BBBBHHII", wb, hb, 0, 0, 1, 32, len(blob), offset)
        offset += len(blob)
        blobs += blob
    path.write_bytes(out + blobs)
    print(f"ICO {path.name}: {path.stat().st_size} bytes, {count} sizes")


def write_svg(path: Path) -> None:
    # Superellipse-ish clip via rounded rect (SVG approximation of squircle)
    path.write_text(
        """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#121214"/>
      <stop offset="100%" stop-color="#08080A"/>
    </linearGradient>
    <clipPath id="squircle">
      <rect x="0" y="0" width="1024" height="1024" rx="228" ry="228"/>
    </clipPath>
  </defs>
  <g clip-path="url(#squircle)">
    <rect width="1024" height="1024" fill="url(#bg)"/>
    <text x="512" y="590" text-anchor="middle"
          font-family="Segoe UI, system-ui, -apple-system, sans-serif"
          font-size="410" font-weight="700" fill="#5AF78E">πD</text>
  </g>
</svg>
""",
        encoding="utf-8",
    )


def main() -> None:
    print("rendering Apple-squircle master 1024...")
    # Build large master then derive sizes (preserves AA)
    master = draw_master(1024)
    master.save(PUBLIC / "icon-1024.png", format="PNG", optimize=True)

    sizes = {
        16: "icon-16.png",
        32: "icon-32.png",
        48: "icon-48.png",
        64: "icon-64.png",
        120: "icon-120.png",
        128: "icon-128.png",
        152: "icon-152.png",
        167: "icon-167.png",
        180: "apple-touch-icon.png",
        192: "icon-192.png",
        256: "icon-256.png",
        512: "icon-512.png",
        1024: "icon-1024.png",
    }

    rendered: dict[int, Image.Image] = {}
    for s, name in sizes.items():
        if s == 1024:
            im = master
        else:
            # re-render small sizes natively so squircle AA stays sharp
            im = draw_master(s) if s <= 64 else master.resize(
                (s, s), Image.Resampling.LANCZOS
            )
        im.save(PUBLIC / name, format="PNG", optimize=True)
        rendered[s] = im.convert("RGBA")
        print(f"  {name}")

    rendered[32].save(PUBLIC / "favicon.png", format="PNG", optimize=True)
    rendered[24] = draw_master(24)

    make_bmp_ico(
        [rendered[s] for s in (16, 24, 32, 48, 64, 128, 256)],
        PUBLIC / "icon.ico",
    )

    h = hashlib.sha1((PUBLIC / "icon.ico").read_bytes()).hexdigest()[:10]
    hashed = PUBLIC / f"pid-icon-{h}.ico"
    hashed.write_bytes((PUBLIC / "icon.ico").read_bytes())
    (PUBLIC / ".icon-hash").write_text(h, encoding="utf-8")
    print("hashed ico:", hashed.name)

    write_svg(PUBLIC / "icon.svg")

    # preview on dark gray so squircle silhouette is obvious
    strip = Image.new("RGB", (1000, 300), (48, 48, 52))
    x = 20
    for s in (32, 48, 64, 128, 180, 256):
        im = rendered[s]
        # composite onto preview bg
        tile = Image.new("RGBA", (s, s), (48, 48, 52, 255))
        tile = Image.alpha_composite(tile, im)
        strip.paste(tile.convert("RGB"), (x, (300 - s) // 2))
        x += s + 16
    strip.save(PUBLIC / "_icon-preview.png")
    print("DONE")


if __name__ == "__main__":
    main()
