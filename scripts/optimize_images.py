# encoding: utf-8
"""Optimize site images in place — resize oversized images and recompress.

Safe to run repeatedly: an idempotency ledger (scripts/.image-optim-ledger.json)
records the sha256 of every file we've already optimized, so a second run skips
them and never re-compresses (which would slowly degrade lossy formats). Drop a
new image in and re-run — only the new/changed files are processed.

File formats are preserved (so Markdown/HTML references never break):
  - JPEG  -> downscale + re-encode (quality 82, progressive)
  - PNG   -> downscale + lossless re-pack; palette-quantized only when the image
             already has <=256 colours (safe for logos/diagrams, not gradients)
  - WebP  -> downscale + re-encode (quality 80)
  - GIF / SVG / ICO -> left untouched (animation / vector)

Per-directory max widths keep small UI images small; everything else uses the
default. Usage:  python3 scripts/optimize_images.py [path ...]   (default: assets/images)
"""
import sys, os, json, hashlib, io
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEDGER = os.path.join(ROOT, "scripts", ".image-optim-ledger.json")

DEFAULT_MAX_W = 1600
JPEG_Q = 82
WEBP_Q = 80
# Narrower ceilings for images that only ever render small. Portraits render at
# ~210px in the team grid and up to 300px for the director — 600px keeps them
# crisp at 2x/retina without the graininess of the browser downscaling a much
# larger source.
DIR_MAX_W = {
    os.path.join("assets", "images", "sponsors"): 480,
    os.path.join("assets", "images", "team"): 600,
}
SKIP_EXT = {".gif", ".svg", ".ico"}
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def load_ledger():
    try:
        with open(LEDGER, encoding="utf-8") as f:
            return set(json.load(f))
    except (OSError, ValueError):
        return set()


def save_ledger(done):
    os.makedirs(os.path.dirname(LEDGER), exist_ok=True)
    with open(LEDGER, "w", encoding="utf-8") as f:
        json.dump(sorted(done), f, indent=0)


def max_width_for(relpath):
    for prefix, w in DIR_MAX_W.items():
        if relpath.startswith(prefix + os.sep):
            return w
    return DEFAULT_MAX_W


def encode(img, ext, max_w):
    """Return optimized bytes for the image, preserving format `ext`."""
    if img.width > max_w:
        h = round(img.height * max_w / img.width)
        img = img.resize((max_w, h), Image.LANCZOS)

    buf = io.BytesIO()
    if ext in (".jpg", ".jpeg"):
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        img.save(buf, "JPEG", quality=JPEG_Q, optimize=True, progressive=True)
    elif ext == ".webp":
        img.save(buf, "WEBP", quality=WEBP_Q, method=6)
    else:  # .png
        # Palette-quantize only when it is lossless-ish (already few colours).
        if img.mode in ("RGB", "RGBA", "P"):
            probe = img.convert("RGBA") if img.mode != "P" else img
            colors = probe.getcolors(256) if img.mode != "P" else True
            if colors is not None and img.mode != "P":
                img = img.convert("P", palette=Image.ADAPTIVE, colors=256)
        img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def iter_images(targets):
    for t in targets:
        if os.path.isfile(t):
            yield t
        elif os.path.isdir(t):
            for dirpath, _, names in os.walk(t):
                for n in sorted(names):
                    yield os.path.join(dirpath, n)


def main():
    targets = sys.argv[1:] or [os.path.join(ROOT, "assets", "images")]
    targets = [t if os.path.isabs(t) else os.path.join(ROOT, t) for t in targets]

    done = load_ledger()
    saved_total = 0
    n_opt = n_skip = 0

    for path in iter_images(targets):
        ext = os.path.splitext(path)[1].lower()
        if ext in SKIP_EXT or ext not in IMG_EXT:
            continue
        cur = sha256(path)
        relpath = os.path.relpath(path, ROOT)
        target_max = max_width_for(relpath)
        before = os.path.getsize(path)
        try:
            with Image.open(path) as im:
                im.load()
                if getattr(im, "is_animated", False):
                    n_skip += 1
                    continue
                # Re-process if it's new/changed OR still wider than its target —
                # so lowering a max width (or a stray oversized upload) always
                # gets resized, even if it was optimized under an older setting.
                oversized = im.width > target_max
                if cur in done and not oversized:
                    n_skip += 1
                    continue
                data = encode(im, ext, target_max)
        except Exception as e:  # corrupt/unsupported -> leave as-is
            print("  ! skip %s (%s)" % (relpath, e))
            continue

        # Replace when we saved bytes or when a resize was required; otherwise
        # keep the original but record its hash so we don't re-probe it.
        if oversized or len(data) < before:
            with open(path, "wb") as f:
                f.write(data)
            after = len(data)
            saved_total += before - after
            done.add(sha256(path))
            n_opt += 1
            print("  ✓ %-52s %6d KB -> %5d KB" % (relpath[:52], before // 1024, after // 1024))
        else:
            done.add(cur)
            n_skip += 1

    save_ledger(done)
    print("Optimized %d, skipped %d. Saved %.1f MB." % (n_opt, n_skip, saved_total / 1e6))


if __name__ == "__main__":
    main()
