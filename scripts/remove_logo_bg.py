from pathlib import Path
from PIL import Image

BRAND = Path(__file__).resolve().parents[1] / "public" / "brand"
PATHS = [BRAND / "logounbosque.png", BRAND / "logodide.png"]


def remove_dark_bg(path: Path, threshold: int = 38) -> None:
    bak = path.with_suffix(".png.bak")
    if not bak.exists():
        bak.write_bytes(path.read_bytes())
        print(f"backed up {path.name}")

    img = Image.open(path).convert("RGBA")
    pixels = img.load()
    w, h = img.size
    removed = 0

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r <= threshold and g <= threshold and b <= threshold:
                pixels[x, y] = (r, g, b, 0)
                removed += 1
            elif r <= threshold + 25 and g <= threshold + 25 and b <= threshold + 25:
                lum = (r + g + b) / 3
                fade = max(0, min(255, int((lum - threshold) / 25 * 255)))
                pixels[x, y] = (r, g, b, fade)
                removed += 1

    img.save(path, optimize=True)
    print(f"{path.name}: {w}x{h}, cleared~{removed} px")


if __name__ == "__main__":
    for p in PATHS:
        remove_dark_bg(p)
    print("done")
