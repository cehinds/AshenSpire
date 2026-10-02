"""Normalize the eight approved 7x4 bow sheets into 640px outfit frames.

The source sheets live in art/bow-attack-source. Each row is one outfit and
each column is one step of the draw, release, and recovery cycle.
"""

from pathlib import Path
import sys
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art" / "bow-attack-source"
OUTPUT = ROOT / "assets" / "animations" / "bow"
MOBILE = ROOT / "assets-mobile" / "animations" / "bow"
GROUPS = {
    "reaver-a": ["reaver", "reaver-vigil", "reaver-oathsworn", "reaver-warden"],
    "reaver-b": ["reaver-gutterLeathers", "reaver-nightweave", "reaver-riteVestments", "reaver-wayfarerPlate"],
    "herald-a": ["herald", "herald-emberhabit", "herald-ossuary", "herald-pilgrim"],
    "herald-b": ["herald-gutterLeathers", "herald-nightweave", "herald-riteVestments", "herald-wayfarerPlate"],
    "rogue-a": ["rogue", "rogue-duelist", "rogue-nightveil", "rogue-shadow"],
    "rogue-b": ["rogue-gutterLeathers", "rogue-nightweave", "rogue-riteVestments", "rogue-wayfarerPlate"],
    "starseer-a": ["starseer", "starseer-astral", "starseer-eclipse", "starseer-starlit"],
    "starseer-b": ["starseer-gutterLeathers", "starseer-nightweave", "starseer-riteVestments", "starseer-wayfarerPlate"],
}


def main():
    for sheet_name, outfits in GROUPS.items():
        sheet = Image.open(SOURCE / f"{sheet_name}.png").convert("RGBA")
        if sheet.size != (1659, 948):
            raise ValueError(f"{sheet_name}: expected 1659x948, got {sheet.size}")
        for row, outfit in enumerate(outfits):
            directory = OUTPUT / outfit
            mobile_directory = MOBILE / outfit
            directory.mkdir(parents=True, exist_ok=True)
            mobile_directory.mkdir(parents=True, exist_ok=True)
            for col in range(7):
                cell = sheet.crop((col * 237, row * 237, (col + 1) * 237, (row + 1) * 237))
                # Match the shared 640px combat canvas while retaining the
                # same position for every pose in a row.
                figure = cell.resize((520, 520), Image.Resampling.LANCZOS)
                canvas = Image.new("RGBA", (640, 640))
                canvas.alpha_composite(figure, (60, 70))
                if "--mobile-only" not in sys.argv:
                    canvas.save(directory / f"BOW-{col + 1:02d}.webp", "WEBP", quality=88, method=2)
                canvas.resize((64, 64), Image.Resampling.LANCZOS).save(
                    mobile_directory / f"BOW-{col + 1:02d}.webp", "WEBP", quality=5, method=2
                )
    print(f"bow-animation-import: wrote {len(GROUPS) * 4 * 7} frames")


if __name__ == "__main__":
    main()
