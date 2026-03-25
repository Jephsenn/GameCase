"""
Generates GameCase mobile assets:
  - assets/icon.png   (1024x1024) — purple rounded square with white "G"
  - assets/splash.png (2048x2048) — dark themed splash screen
"""

import math
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ASSETS_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets')
os.makedirs(ASSETS_DIR, exist_ok=True)

# ── Palette ────────────────────────────────────────────────────────────────────
DARK_BG      = (15, 23, 42)          # #0f172a  slate-900
PURPLE       = (124, 58, 237)        # #7c3aed  violet-600
PURPLE_LIGHT = (167, 139, 250)       # #a78bfa  violet-400
PINK         = (236, 72, 153)        # #ec4899  pink-500
WHITE        = (255, 255, 255)
CARD_BG      = (30, 41, 59, 200)     # #1e293b  slate-800 semi-transparent


# ── Helper: draw rounded rectangle ────────────────────────────────────────────
def rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    draw.rectangle([x0 + radius, y0, x1 - radius, y1], fill=fill)
    draw.rectangle([x0, y0 + radius, x1, y1 - radius], fill=fill)
    draw.ellipse([x0, y0, x0 + radius * 2, y0 + radius * 2], fill=fill)
    draw.ellipse([x1 - radius * 2, y0, x1, y0 + radius * 2], fill=fill)
    draw.ellipse([x0, y1 - radius * 2, x0 + radius * 2, y1], fill=fill)
    draw.ellipse([x1 - radius * 2, y1 - radius * 2, x1, y1], fill=fill)


# ── Helper: vertical gradient fill ────────────────────────────────────────────
def gradient_rect(img, xy, color_top, color_bot):
    x0, y0, x1, y1 = xy
    h = y1 - y0
    for i in range(h):
        t = i / max(h - 1, 1)
        r = int(color_top[0] + (color_bot[0] - color_top[0]) * t)
        g = int(color_top[1] + (color_bot[1] - color_top[1]) * t)
        b = int(color_top[2] + (color_bot[2] - color_top[2]) * t)
        img.paste((r, g, b), [x0, y0 + i, x1, y0 + i + 1])


# ══════════════════════════════════════════════════════════════════════════════
#  ICON  1024 × 1024
# ══════════════════════════════════════════════════════════════════════════════
def make_icon():
    SIZE = 1024
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded square background — purple gradient
    RADIUS = 220
    PAD = 0

    # Draw gradient background manually on a temp image then paste
    bg = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)

    # Fill gradient: purple top → deeper purple/indigo bottom
    for y in range(SIZE):
        t = y / SIZE
        r = int(124 + (79 - 124) * t)   # 7c3aed → 4f46e5
        g = int(58 + (70 - 58) * t)
        b = int(237 + (229 - 237) * t)
        bg_draw.line([(0, y), (SIZE, y)], fill=(r, g, b, 255))

    # Mask to rounded rect
    mask = Image.new('L', (SIZE, SIZE), 0)
    mask_draw = ImageDraw.Draw(mask)
    rounded_rect(mask_draw, [PAD, PAD, SIZE - PAD, SIZE - PAD], RADIUS, 255)
    bg.putalpha(mask)
    img.alpha_composite(bg)

    # Subtle inner glow ring
    glow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    for offset, alpha in [(2, 30), (6, 20), (12, 10)]:
        glow_draw.ellipse(
            [SIZE // 2 - 300 - offset, SIZE // 2 - 300 - offset,
             SIZE // 2 + 300 + offset, SIZE // 2 + 300 + offset],
            outline=(167, 139, 250, alpha), width=3
        )
    img.alpha_composite(glow)

    # Draw the "G" letter
    draw = ImageDraw.Draw(img)

    # Try to use a bold system font, fall back to default
    font = None
    font_paths = [
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/Arial Bold.ttf",
        "C:/Windows/Fonts/calibrib.ttf",
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, 620)
                break
            except Exception:
                pass

    letter = "G"
    if font:
        bbox = draw.textbbox((0, 0), letter, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        # Center the glyph
        tx = (SIZE - tw) // 2 - bbox[0]
        ty = (SIZE - th) // 2 - bbox[1] - 20  # slight upward nudge
        draw.text((tx, ty), letter, font=font, fill=WHITE)
    else:
        # Fallback: draw a geometric "G" shape
        cx, cy, R, stroke = SIZE // 2, SIZE // 2, 300, 80
        # Outer arc (270° → 90°) — open on the right side for G crossbar notch
        draw.arc([cx - R, cy - R, cx + R, cy + R], start=40, end=320, fill=WHITE, width=stroke)
        # Crossbar
        bar_y = cy + 30
        bar_x0 = cx
        bar_x1 = cx + R - stroke // 2
        draw.rectangle([bar_x0, bar_y - stroke // 2, bar_x1, bar_y + stroke // 2], fill=WHITE)
        # Right vertical stroke going up from crossbar
        draw.rectangle([bar_x1 - stroke, bar_y - 130, bar_x1, bar_y + stroke // 2], fill=WHITE)

    img.save(os.path.join(ASSETS_DIR, 'icon.png'))
    print("icon.png saved (1024x1024)")


# ══════════════════════════════════════════════════════════════════════════════
#  SPLASH  2048 × 2048
# ══════════════════════════════════════════════════════════════════════════════
def make_splash():
    W, H = 2048, 2048
    img = Image.new('RGB', (W, H), DARK_BG)
    draw = ImageDraw.Draw(img)

    # ── Background: subtle radial glow at center ──────────────────────────────
    cx, cy = W // 2, H // 2
    glow_layer = Image.new('RGB', (W, H), DARK_BG)
    glow_draw = ImageDraw.Draw(glow_layer)

    # Purple glow blob behind center
    for radius in range(700, 0, -10):
        t = radius / 700
        alpha_ratio = (1 - t) ** 2
        r = int(DARK_BG[0] + (80 - DARK_BG[0]) * alpha_ratio)
        g = int(DARK_BG[1] + (30 - DARK_BG[1]) * alpha_ratio)
        b = int(DARK_BG[2] + (120 - DARK_BG[2]) * alpha_ratio)
        glow_draw.ellipse([cx - radius, cy - radius - 100, cx + radius, cy + radius - 100],
                          fill=(r, g, b))

    img = Image.blend(img, glow_layer, 0.85)
    draw = ImageDraw.Draw(img)

    # ── Decorative grid lines (subtle) ────────────────────────────────────────
    grid_color = (30, 40, 60)
    grid_spacing = 120
    for x in range(0, W, grid_spacing):
        draw.line([(x, 0), (x, H)], fill=grid_color, width=1)
    for y in range(0, H, grid_spacing):
        draw.line([(0, y), (W, y)], fill=grid_color, width=1)

    # ── Corner accent glows ───────────────────────────────────────────────────
    accent_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    accent_draw = ImageDraw.Draw(accent_layer)
    # Top-left purple
    for r in range(400, 0, -20):
        a = int(60 * (1 - r / 400) ** 1.5)
        accent_draw.ellipse([-r, -r, r, r], fill=(124, 58, 237, a))
    # Bottom-right pink
    for r in range(400, 0, -20):
        a = int(60 * (1 - r / 400) ** 1.5)
        accent_draw.ellipse([W - r, H - r, W + r, H + r], fill=(236, 72, 153, a))

    img_rgba = img.convert('RGBA')
    img_rgba.alpha_composite(accent_layer)
    img = img_rgba.convert('RGB')
    draw = ImageDraw.Draw(img)

    # ── Decorative circles (game-controller aesthetic) ────────────────────────
    circles = [
        (350, 400, 180, (124, 58, 237, 15)),
        (1700, 300, 220, (167, 139, 250, 12)),
        (1800, 1700, 260, (236, 72, 153, 12)),
        (250, 1750, 200, (124, 58, 237, 15)),
        (1024, 200, 120, (167, 139, 250, 10)),
    ]
    circ_layer = img.convert('RGBA')
    circ_draw = ImageDraw.Draw(circ_layer)
    for (ox, oy, r, color) in circles:
        for stroke_r in range(r, r - 40, -4):
            a = int(color[3] * (1 - abs(stroke_r - r) / 40))
            circ_draw.ellipse([ox - stroke_r, oy - stroke_r, ox + stroke_r, oy + stroke_r],
                              outline=(*color[:3], a), width=2)
    img = circ_layer.convert('RGB')
    draw = ImageDraw.Draw(img)

    # ── Load fonts ────────────────────────────────────────────────────────────
    font_bold_lg = None
    font_bold_md = None
    font_regular = None
    font_sm = None

    bold_paths = [
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/calibrib.ttf",
        "C:/Windows/Fonts/segoeuib.ttf",
    ]
    reg_paths = [
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibri.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
    ]

    for fp in bold_paths:
        if os.path.exists(fp):
            try:
                font_bold_lg = ImageFont.truetype(fp, 160)
                font_bold_md = ImageFont.truetype(fp, 90)
                font_sm      = ImageFont.truetype(fp, 55)
                break
            except Exception:
                pass

    for fp in reg_paths:
        if os.path.exists(fp):
            try:
                font_regular = ImageFont.truetype(fp, 60)
                break
            except Exception:
                pass

    # ── Icon "G" badge at top center ─────────────────────────────────────────
    badge_size = 180
    badge_x = cx - badge_size // 2
    badge_y = 520

    badge_layer = img.convert('RGBA')
    badge_draw = ImageDraw.Draw(badge_layer)
    rounded_rect(badge_draw,
                 [badge_x, badge_y, badge_x + badge_size, badge_y + badge_size],
                 42, (*PURPLE, 255))

    img = badge_layer.convert('RGB')
    draw = ImageDraw.Draw(img)

    if font_bold_lg:
        g_font = ImageFont.truetype(bold_paths[0] if os.path.exists(bold_paths[0]) else reg_paths[0], 120)
        bbox = draw.textbbox((0, 0), "G", font=g_font)
        gw = bbox[2] - bbox[0]
        gh = bbox[3] - bbox[1]
        draw.text(
            (badge_x + (badge_size - gw) // 2 - bbox[0],
             badge_y + (badge_size - gh) // 2 - bbox[1] - 5),
            "G", font=g_font, fill=WHITE
        )

    # ── "GameCase" title ───────────────────────────────────────────────────
    title_y = badge_y + badge_size + 60

    if font_bold_md:
        # "Game" in white
        game_text = "Game"
        tracker_text = "Tracker"
        bbox_game = draw.textbbox((0, 0), game_text, font=font_bold_md)
        bbox_tracker = draw.textbbox((0, 0), tracker_text, font=font_bold_md)
        total_w = (bbox_game[2] - bbox_game[0]) + (bbox_tracker[2] - bbox_tracker[0])
        start_x = cx - total_w // 2

        draw.text(
            (start_x - bbox_game[0], title_y - bbox_game[1]),
            game_text, font=font_bold_md, fill=WHITE
        )
        draw.text(
            (start_x + (bbox_game[2] - bbox_game[0]) - bbox_tracker[0], title_y - bbox_tracker[1]),
            tracker_text, font=font_bold_md, fill=PURPLE_LIGHT
        )

    # ── Main headline ─────────────────────────────────────────────────────────
    headline_y = title_y + 160

    if font_bold_lg:
        line1 = "Your games."
        bbox1 = draw.textbbox((0, 0), line1, font=font_bold_lg)
        w1 = bbox1[2] - bbox1[0]
        draw.text(
            (cx - w1 // 2 - bbox1[0], headline_y - bbox1[1]),
            line1, font=font_bold_lg, fill=WHITE
        )

        line2 = "All in one place."
        bbox2 = draw.textbbox((0, 0), line2, font=font_bold_lg)
        w2 = bbox2[2] - bbox2[0]
        line2_y = headline_y + (bbox1[3] - bbox1[1]) + 20

        # Draw line2 with gradient simulation: purple → pink per character
        chars = list(line2)
        total_chars = len(chars)
        pen_x = cx - w2 // 2 - bbox2[0]
        pen_y = line2_y - bbox2[1]
        for i, ch in enumerate(chars):
            t = i / max(total_chars - 1, 1)
            r = int(PURPLE_LIGHT[0] + (PINK[0] - PURPLE_LIGHT[0]) * t)
            g = int(PURPLE_LIGHT[1] + (PINK[1] - PURPLE_LIGHT[1]) * t)
            b = int(PURPLE_LIGHT[2] + (PINK[2] - PURPLE_LIGHT[2]) * t)
            draw.text((pen_x, pen_y), ch, font=font_bold_lg, fill=(r, g, b))
            cb = draw.textbbox((0, 0), ch, font=font_bold_lg)
            pen_x += cb[2] - cb[0]

    # ── Tagline ───────────────────────────────────────────────────────────────
    if font_regular:
        tagline_y = line2_y + 230 if 'line2_y' in dir() else H // 2 + 200
        tagline = "Track your games. Build your library. Discover what to play next."
        bbox_t = draw.textbbox((0, 0), tagline, font=font_regular)
        tw = bbox_t[2] - bbox_t[0]
        draw.text(
            (cx - tw // 2 - bbox_t[0], tagline_y - bbox_t[1]),
            tagline, font=font_regular, fill=(148, 163, 184)  # slate-400
        )

    # ── Stat cards ────────────────────────────────────────────────────────────
    if font_sm and font_regular:
        stats = [
            ("500K+", "Games Tracked"),
            ("1M+",   "Library Entries"),
            ("50K+",  "Active Users"),
        ]
        card_w, card_h = 320, 160
        gap = 50
        total_cards_w = len(stats) * card_w + (len(stats) - 1) * gap
        card_start_x = cx - total_cards_w // 2
        card_y = H - 480

        card_layer = img.convert('RGBA')
        card_draw = ImageDraw.Draw(card_layer)
        for i, (num, label) in enumerate(stats):
            cx_card = card_start_x + i * (card_w + gap)
            rounded_rect(card_draw,
                         [cx_card, card_y, cx_card + card_w, card_y + card_h],
                         20, (30, 41, 59, 200))
        img = card_layer.convert('RGB')
        draw = ImageDraw.Draw(img)

        for i, (num, label) in enumerate(stats):
            cx_card = card_start_x + i * (card_w + gap)

            # Number in purple-light
            bbox_n = draw.textbbox((0, 0), num, font=font_sm)
            nw = bbox_n[2] - bbox_n[0]
            draw.text(
                (cx_card + card_w // 2 - nw // 2 - bbox_n[0],
                 card_y + 25 - bbox_n[1]),
                num, font=font_sm, fill=PURPLE_LIGHT
            )
            # Label in muted
            small_font = ImageFont.truetype(
                next(p for p in reg_paths if os.path.exists(p)), 44
            )
            bbox_l = draw.textbbox((0, 0), label, font=small_font)
            lw = bbox_l[2] - bbox_l[0]
            draw.text(
                (cx_card + card_w // 2 - lw // 2 - bbox_l[0],
                 card_y + 85 - bbox_l[1]),
                label, font=small_font, fill=(100, 116, 139)  # slate-500
            )

    # ── Subtle vignette ───────────────────────────────────────────────────────
    vignette = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    v_draw = ImageDraw.Draw(vignette)
    for i in range(300):
        alpha = int(120 * (i / 300) ** 2)
        v_draw.rectangle([i, i, W - i, H - i], outline=(0, 0, 0, alpha))

    img_rgba = img.convert('RGBA')
    img_rgba.alpha_composite(vignette)
    img = img_rgba.convert('RGB')

    img.save(os.path.join(ASSETS_DIR, 'splash.png'))
    print("splash.png saved (2048x2048)")


if __name__ == '__main__':
    make_icon()
    make_splash()
    print("Done! Check packages/mobile/assets/")
