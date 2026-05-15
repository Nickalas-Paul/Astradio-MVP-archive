"""Apply Phase 3 outer-planet in-house placement rewrites (Saturn, Uranus, Neptune, Pluto)."""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from phase3_neptune_houses_data import UPDATES as NEPTUNE_UPDATES  # noqa: E402
from phase3_pluto_houses_data import UPDATES as PLUTO_UPDATES  # noqa: E402
from phase3_saturn_houses_data import UPDATES as SATURN_UPDATES  # noqa: E402
from phase3_uranus_houses_data import UPDATES as URANUS_UPDATES  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
HOUSE_PATH = ROOT / "vnext/projection/insight-library/insight-library-placements-house.ts"


def escape_ts(s: str) -> str:
    return s.replace("\\", "\\\\").replace("`", "\\`")


def replace_field(block: str, field: str, value: str) -> str:
    pattern = rf"(    {field}: `)(?:[^`\\]|\\.)*(`)"
    repl = rf"\1{escape_ts(value)}\2"
    new_block, n = re.subn(pattern, repl, block, count=1, flags=re.DOTALL)
    if n != 1:
        raise ValueError(f"Failed to replace {field} in block")
    return new_block


def apply_updates(path: Path, updates: dict[str, dict[str, str]]) -> int:
    text = path.read_text(encoding="utf-8")
    for key, fields in updates.items():
        m = re.search(rf"  {key}: \{{(.*?)\n  \}},", text, re.DOTALL)
        if not m:
            raise SystemExit(f"Entry not found: {key} in {path.name}")
        block = m.group(0)
        for field in ("core", "behavioral", "feed", "sonic"):
            block = replace_field(block, field, fields[field])
        text = text[: m.start()] + block + text[m.end() :]
    path.write_text(text, encoding="utf-8")
    return len(updates)


def main() -> None:
    merged = {**SATURN_UPDATES, **URANUS_UPDATES, **NEPTUNE_UPDATES, **PLUTO_UPDATES}
    n = apply_updates(HOUSE_PATH, merged)
    print(f"Updated {n} outer-planet house entries in {HOUSE_PATH.name}")


if __name__ == "__main__":
    main()
