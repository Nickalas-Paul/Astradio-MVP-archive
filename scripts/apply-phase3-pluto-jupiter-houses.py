"""Apply Phase 3 Pluto in-sign and Jupiter in-house rewrites to placement TS files."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIR = Path(__file__).resolve().parent
SIGN_PATH = ROOT / "vnext/projection/insight-library/insight-library-placements-sign.ts"
HOUSE_PATH = ROOT / "vnext/projection/insight-library/insight-library-placements-house.ts"

PLUTO_DATA = DIR / "phase3-pluto-signs.json"
JUPITER_HOUSES_DATA = DIR / "phase3-jupiter-houses.json"


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
    n_p = apply_updates(SIGN_PATH, json.loads(PLUTO_DATA.read_text(encoding="utf-8")))
    print(f"Updated {n_p} Pluto sign entries in {SIGN_PATH.name}")
    n_j = apply_updates(HOUSE_PATH, json.loads(JUPITER_HOUSES_DATA.read_text(encoding="utf-8")))
    print(f"Updated {n_j} Jupiter house entries in {HOUSE_PATH.name}")


if __name__ == "__main__":
    main()
