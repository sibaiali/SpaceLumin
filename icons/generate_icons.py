"""
generate_icons.py
Converts icon.svg into all required PNG sizes for Play Store / PWA.
Requires: pip install cairosvg  OR  pip install Pillow
Falls back to a pure-Pillow approach if cairosvg is unavailable.
"""
import os, sys, struct, zlib, math

SIZES   = [72, 96, 128, 144, 152, 192, 384, 512]
SRC_SVG = os.path.join(os.path.dirname(__file__), 'icon.svg')
OUT_DIR = os.path.dirname(__file__)

def try_cairosvg():
    try:
        import cairosvg
        for size in SIZES:
            out = os.path.join(OUT_DIR, f'icon-{size}.png')
            cairosvg.svg2png(url=SRC_SVG, write_to=out,
                             output_width=size, output_height=size)
            print(f'  [cairosvg] {size}x{size} → {os.path.basename(out)}')
        return True
    except ImportError:
        return False

def try_pillow():
    try:
        from PIL import Image
        import xml.etree.ElementTree as ET
        # Pillow can't render SVG natively — use the rsvg CLI if available
        import subprocess, shutil
        if shutil.which('rsvg-convert'):
            for size in SIZES:
                out = os.path.join(OUT_DIR, f'icon-{size}.png')
                subprocess.run(['rsvg-convert', '-w', str(size), '-h', str(size),
                                '-o', out, SRC_SVG], check=True)
                print(f'  [rsvg]     {size}x{size} → {os.path.basename(out)}')
            return True
        print('  Pillow found but cannot render SVG without rsvg-convert.')
        return False
    except ImportError:
        return False

def make_placeholder_png(size, out_path):
    """
    Write a minimal valid navy-blue square PNG (pure Python, no deps).
    Replace with real icons later.
    """
    def make_chunk(name, data):
        crc = zlib.crc32(name + data) & 0xFFFFFFFF
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', crc)

    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    ihdr = make_chunk(b'IHDR', ihdr_data)

    # IDAT — solid dark-navy (#0a0a1a) with a cyan diamond
    rows = []
    cx, cy, r = size // 2, size // 2, size // 3
    for y in range(size):
        row = [0]   # filter byte
        for x in range(size):
            # Simple diamond shape
            if abs(x - cx) + abs(y - cy) < r:
                row += [0x22, 0xd3, 0xee]  # cyan
            elif abs(x - cx) + abs(y - cy) < r + max(2, size // 40):
                row += [0x0a, 0xc8, 0xb9]  # teal border
            else:
                row += [0x0a, 0x0a, 0x1a]  # navy bg
        rows.append(bytes(row))

    raw = b''.join(rows)
    idat = make_chunk(b'IDAT', zlib.compress(raw))
    iend = make_chunk(b'IEND', b'')

    with open(out_path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + ihdr + idat + iend)

    print(f'  [fallback]  {size}x{size} -> {os.path.basename(out_path)} (placeholder)')

# ── Main ──────────────────────────────────────────────────────────────
print('Generating Lumin Flow icons...')
os.makedirs(OUT_DIR, exist_ok=True)

if not try_cairosvg():
    if not try_pillow():
        print('  No SVG renderer found — writing placeholder PNGs.')
        print('  Install cairosvg:   pip install cairosvg')
        print('  Or use maskable.app/editor to export all sizes from icon.svg')
        for size in SIZES:
            out = os.path.join(OUT_DIR, f'icon-{size}.png')
            make_placeholder_png(size, out)

# Also copy 512 as maskable
src512  = os.path.join(OUT_DIR, 'icon-512.png')
mask512 = os.path.join(OUT_DIR, 'icon-512-maskable.png')
if os.path.exists(src512) and not os.path.exists(mask512):
    import shutil
    shutil.copy2(src512, mask512)
    print('  Copied icon-512.png -> icon-512-maskable.png')

print('Done.')
print()
print('NEXT STEP: If icons look like navy squares, replace them with')
print('real PNGs exported from https://maskable.app/editor using icon.svg')
