import os
import re
import json

SYMBOLS_DIR = "../symbols"
OUTPUT_JSON = "./symbols_index_with_pins.json"

ALLOWED_DIRS = {
    "4xxx", "74xx", "Connector", "Device", "Diode", "LED",
    "MCU_ATmega", "MCU_STM32F1", "Memory_EEPROM", "OpAmp", "Oscillator",
    "Power", "Regulator_Linear", "Regulator_Switching", "Relay",
    "Sensor_Motion", "Sensor_Optical", "Sensor_Temperature",
    "Switch", "Timer", "Transistor_BJT", "Transistor_FET"
}


def find_sym_files(base_dir):
    """Find only .kicad_sym files that match allowed categories."""
    sym_files = []
    print(f"🔍 Looking in directory: {base_dir}")
    try:
        files = os.listdir(base_dir)
        print(f"📁 Found {len(files)} files total")
        for f in files:
            print(f"   Checking: {f}")
            if f.endswith(".kicad_sym"):
                # Check if filename (without extension) is in allowed dirs
                category = f.replace(".kicad_sym", "")  # Remove '.kicad_sym' extension
                print(f"   Category: {category}, Allowed: {category in ALLOWED_DIRS}")
                if category in ALLOWED_DIRS:
                    sym_files.append(os.path.join(base_dir, f))
                    print(f"   ✅ Added: {f}")
    except Exception as e:
        print(f"❌ Error: {e}")
    print(f"📊 Found {len(sym_files)} matching files")
    return sym_files


def parse_kicad_sym(content):
    """
    Parse KiCad .kicad_sym content into dict of symbols.
    Uses balanced parentheses to correctly capture full symbol blocks.
    """
    symbols = {}

    i = 0
    while i < len(content):
        if content.startswith("(symbol", i):
            start = i
            depth = 0
            while i < len(content):
                if content[i] == "(":
                    depth += 1
                elif content[i] == ")":
                    depth -= 1
                    if depth == 0:
                        i += 1
                        break
                i += 1
            block = content[start:i]

            # Extract ID
            m = re.match(r'\(symbol\s+"([^"]+)"', block)
            if not m:
                continue
            symbol_id = m.group(1)

            symbols[symbol_id] = parse_symbol_block(symbol_id, block)
        else:
            i += 1

    return symbols


def parse_symbol_block(symbol_id, block):
    """Extract pins, bbox, extends from one symbol block."""

    # Pins
    pin_regex = re.compile(
        r'\(pin\s+([^\s]+)\s+[^\s]+\s*.*?\(at\s+([-\d.]+)\s+([-\d.]+)(?:\s+([-\d.]+))?\).*?\(name\s+"([^"]+)"\).*?\(number\s+"([^"]+)"',
        re.S,
    )
    pins = []
    for m in pin_regex.finditer(block):
        pins.append({
            "electrical_type": m.group(1),
            "x": float(m.group(2)),
            "y": -float(m.group(3)),  # flip Y
            "orientation": float(m.group(4)) if m.group(4) else 0,
            "name": m.group(5),
            "number": m.group(6),
        })

    # Rectangle bbox
    bbox = None
    rect_m = re.search(r"\(rectangle\s+\(start\s+([-\d.]+)\s+([-\d.]+)\)\s+\(end\s+([-\d.]+)\s+([-\d.]+)\)", block)
    if rect_m:
        x1, y1, x2, y2 = map(float, rect_m.groups())
        bbox = {
            "minX": min(x1, x2),
            "maxX": max(x1, x2),
            "minY": min(y1, y2),
            "maxY": max(y1, y2),
        }
    else:
        # Try polyline points
        polyline_regex = re.compile(r"\(polyline\s+\(pts(.*?)\)\)", re.S)
        xy_regex = re.compile(r"\(xy\s+([-\d.]+)\s+([-\d.]+)\)")
        minX, maxX, minY, maxY = float("inf"), float("-inf"), float("inf"), float("-inf")
        for pl in polyline_regex.findall(block):
            for x, y in xy_regex.findall(pl):
                x, y = float(x), float(y)
                minX, maxX = min(minX, x), max(maxX, x)
                minY, maxY = min(minY, y), max(maxY, y)
        if minX != float("inf"):
            bbox = {"minX": minX, "maxX": maxX, "minY": minY, "maxY": maxY}

    # Extends
    m = re.search(r'\(extends\s+"([^"]+)"\)', block)
    extends = m.group(1) if m else None

    return {
        "id": symbol_id,
        "pins": pins,
        "bbox": bbox,
        "extends": extends,
        "kicad_sym_raw": block,
    }


def resolve_inheritance(symbols):
    """Fill pins/bbox from base symbol if extends is set."""
    for sym_id, sym in symbols.items():
        if sym["extends"] and sym["extends"] in symbols:
            base = symbols[sym["extends"]]
            if not sym["pins"]:
                sym["pins"] = base["pins"]
            if not sym["bbox"]:
                sym["bbox"] = base["bbox"]


def main():
    print("🔍 Searching for .kicad_sym files...")
    files = find_sym_files(SYMBOLS_DIR)
    print(f"Found {len(files)} library files.")

    all_symbols = {}
    for f in files:
        with open(f, encoding="utf-8") as fh:
            content = fh.read()
        symbols = parse_kicad_sym(content)
        all_symbols.update(symbols)

    print(f"📊 Parsed {len(all_symbols)} raw symbols.")

    resolve_inheritance(all_symbols)

    with open(OUTPUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(all_symbols, fh, indent=2)

    print(f"✅ Saved enriched symbol index to {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
