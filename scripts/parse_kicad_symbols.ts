import type { Dirent } from "fs";

import { promises as fs } from "fs";
import * as path from "path";

/**
 * Strips all possible KiCad symbol suffixes to get the base symbol name.
 * Handles comprehensive list of variations in order of specificity.
 */
function stripSymbolSuffixes(symbolId: string): string {
  // Most specific patterns first (combinations)
  const compoundPatterns = [
    /_unit[0-9A-Za-z]+_demorgan$/,
    /_unit[0-9A-Za-z]+_alternate$/,
    /_unit[0-9A-Za-z]+_alt$/,
  ];

  for (const pattern of compoundPatterns) {
    if (pattern.test(symbolId)) {
      return symbolId.replace(pattern, "");
    }
  }

  // Unit-related suffixes
  const unitPatterns = [/_unit[0-9A-Za-z]+$/, /_unitP$/];

  for (const pattern of unitPatterns) {
    if (pattern.test(symbolId)) {
      return symbolId.replace(pattern, "");
    }
  }

  // Single suffixes in order of specificity
  const singleSuffixes = [
    "_demorgan",
    "_alternate",
    "_alt",
    "_pwr",
    "_mech",
    "_graphical",
    "_outline",
    "_iec",
    "_ansi",
    "_reverse",
    "_mirrored",
    "_flipped",
    "_soic",
    "_dip",
    "_qfn",
    "_tssop",
    "_package",
    "_template",
    "_legacy",
    "_deprecated",
    "_test",
  ];

  for (const suffix of singleSuffixes) {
    if (symbolId.endsWith(suffix)) {
      return symbolId.slice(0, -suffix.length);
    }
  }

  return symbolId;
}

interface Pin {
  name: string;
  number: string;
  electrical_type: string;
  x: number;
  y: number;
  orientation: number;
}

interface SymbolData {
  kicad_sym_raw: string;
  pins: Pin[];
  bbox?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  extends?: string;
}

interface SymbolIndexEntry {
  category: string;
  id: string;
  name: string;
  path: string;
  pins?: Pin[];
  kicad_sym_raw?: string;
  bbox?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  extends?: string;
}

// --- Configuration ---
// This now points to YOUR local folder with the curated .kicad_sym files
const KICAD_SYMBOLS_PATH = "./symbols";
const SYMBOLS_INDEX_PATH = "./symbols_index_with_pins.json";
const OUTPUT_JSON_PATH = "./symbols_index_with_pins.json";
// --- End Configuration ---

async function parseKicadSymFile(
  fileContent: string
): Promise<Map<string, SymbolData>> {
  const symbolsMap = new Map<string, SymbolData>();

  // Extract symbols by finding balanced parentheses
  const symbolStartRegex = /\(\s*symbol\s+"([^"]+)"/g;
  let startMatch;

  while ((startMatch = symbolStartRegex.exec(fileContent)) !== null) {
    const symbolId = startMatch[1];
    const symbolStart = startMatch.index;

    // Find the matching closing parenthesis by counting nesting
    let parenCount = 0;
    let pos = symbolStart;
    let symbolEnd = -1;

    while (pos < fileContent.length) {
      const char = fileContent[pos];
      if (char === "(") parenCount++;
      if (char === ")") parenCount--;

      if (parenCount === 0) {
        symbolEnd = pos + 1;
        break;
      }
      pos++;
    }

    if (symbolEnd === -1) continue; // Malformed symbol

    const fullSymbolDefinition = fileContent.substring(symbolStart, symbolEnd);
    const symbolBody = fullSymbolDefinition.substring(
      startMatch[0].length,
      fullSymbolDefinition.length - 1
    );
    const pins: Pin[] = [];

    // First try to find pins directly in the symbol body
    const directPinRegex =
      /\(pin\s+([^\s]+)\s+([^\s]+)\s*[\s\S]*?\(at\s+([-\d.]+)\s+([-\d.]+)(?:\s+([-\d.]+))?\s*\)[\s\S]*?\(name\s+"([^"]+)"[\s\S]*?\)\s*[\s\S]*?\(number\s+"([^"]+)"/g;
    let pinMatch;
    while ((pinMatch = directPinRegex.exec(symbolBody)) !== null) {
      const electricalType = pinMatch[1];
      const pinName = pinMatch[6];
      const pinNumber = pinMatch[7];
      const x = parseFloat(pinMatch[3]);
      const y = parseFloat(pinMatch[4]);
      const orientation = pinMatch[5] ? parseFloat(pinMatch[5]) : 0;

      pins.push({
        name: pinName,
        number: pinNumber,
        electrical_type: electricalType,
        x: x,
        y: y * -1,
        orientation: orientation,
      });
    }

    // If no direct pins found, look for pins in sub-symbols (multi-unit symbols)
    if (pins.length === 0) {
      const subSymbolRegex =
        /\(\s*symbol\s+"[^"]+_\d+_\d+"\s*([\s\S]*?)\n\s*\)/g;
      let subSymbolMatch;
      while ((subSymbolMatch = subSymbolRegex.exec(symbolBody)) !== null) {
        const subSymbolBody = subSymbolMatch[1];

        const subPinRegex =
          /\(pin\s+([^\s]+)\s+([^\s]+)\s*[\s\S]*?\(at\s+([-\d.]+)\s+([-\d.]+)(?:\s+([-\d.]+))?\s*\)[\s\S]*?\(name\s+"([^"]+)"[\s\S]*?\)\s*[\s\S]*?\(number\s+"([^"]+)"/g;
        let subPinMatch;
        while ((subPinMatch = subPinRegex.exec(subSymbolBody)) !== null) {
          const electricalType = subPinMatch[1];
          const pinName = subPinMatch[6];
          const pinNumber = subPinMatch[7];
          const x = parseFloat(subPinMatch[3]);
          const y = parseFloat(subPinMatch[4]);
          const orientation = subPinMatch[5] ? parseFloat(subPinMatch[5]) : 0;

          pins.push({
            name: pinName,
            number: pinNumber,
            electrical_type: electricalType,
            x: x,
            y: y * -1,
            orientation: orientation,
          });
        }
      }
    }

    // NEW: Look for unit-specific symbol declarations (like "-2V5_1_1")
    if (pins.length === 0) {
      const unitSymbolRegex =
        /\(\s*symbol\s+"([^"]+_\d+_\d+)"\s*([\s\S]*?)\)\s*(?=\(\s*symbol|\s*$)/g;
      let unitSymbolMatch;
      while ((unitSymbolMatch = unitSymbolRegex.exec(symbolBody)) !== null) {
        const unitSymbolId = unitSymbolMatch[1];
        const unitSymbolBody = unitSymbolMatch[2];

        const unitPinRegex =
          /\(pin\s+([^\s]+)\s+([^\s]+)\s*[\s\S]*?\(at\s+([-\d.]+)\s+([-\d.]+)(?:\s+([-\d.]+))?\s*\)[\s\S]*?\(name\s+"([^"]+)"[\s\S]*?\)\s*[\s\S]*?\(number\s+"([^"]+)"/g;
        let unitPinMatch;
        while ((unitPinMatch = unitPinRegex.exec(unitSymbolBody)) !== null) {
          const electricalType = unitPinMatch[1];
          const pinName = unitPinMatch[6];
          const pinNumber = unitPinMatch[7];
          const x = parseFloat(unitPinMatch[3]);
          const y = parseFloat(unitPinMatch[4]);
          const orientation = unitPinMatch[5] ? parseFloat(unitPinMatch[5]) : 0;

          pins.push({
            name: pinName,
            number: pinNumber,
            electrical_type: electricalType,
            x: x,
            y: y * -1,
            orientation: orientation,
          });
        }
      }
    }

    // Extract rectangle (bounding box)
    const rectRegex =
      /\(rectangle\s+\(start\s+([-\d.]+)\s+([-\d.]+)\)\s+\(end\s+([-\d.]+)\s+([-\d.]+)\)/;
    const rectMatch = rectRegex.exec(symbolBody);
    let bbox = undefined;
    if (rectMatch) {
      const x1 = parseFloat(rectMatch[1]);
      const y1 = parseFloat(rectMatch[2]);
      const x2 = parseFloat(rectMatch[3]);
      const y2 = parseFloat(rectMatch[4]);
      bbox = {
        minX: Math.min(x1, x2),
        maxX: Math.max(x1, x2),
        minY: Math.min(y1, y2),
        maxY: Math.max(y1, y2),
      };
    }

    // If no rectangle found, try to extract bbox from polylines
    if (!bbox) {
      const polylineRegex = /\(polyline\s+\(pts([\s\S]*?)\)\s*\)/g;
      let polylineMatch;
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;

      while ((polylineMatch = polylineRegex.exec(symbolBody)) !== null) {
        const ptsContent = polylineMatch[1];
        const xyRegex = /\(xy\s+([-\d.]+)\s+([-\d.]+)\)/g;
        let xyMatch;

        while ((xyMatch = xyRegex.exec(ptsContent)) !== null) {
          const x = parseFloat(xyMatch[1]);
          const y = parseFloat(xyMatch[2]);

          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }

      if (
        minX !== Infinity &&
        maxX !== -Infinity &&
        minY !== Infinity &&
        maxY !== -Infinity
      ) {
        bbox = {
          minX,
          maxX,
          minY,
          maxY,
        };
      }
    }

    // Extract extends relationship
    const extendsRegex = /\(\s*extends\s+"([^"]+)"\s*\)/;
    const extendsMatch = extendsRegex.exec(symbolBody);
    const extendsSymbol = extendsMatch ? extendsMatch[1] : undefined;

    symbolsMap.set(symbolId, {
      kicad_sym_raw: fullSymbolDefinition,
      pins: pins,
      bbox: bbox,
      extends: extendsSymbol,
    });

    // Also extract base symbol name variants that might not have suffixes
    const baseSymbolName = stripSymbolSuffixes(symbolId);
    if (baseSymbolName !== symbolId && !symbolsMap.has(baseSymbolName)) {
      // Create an entry for the base symbol using the same data
      symbolsMap.set(baseSymbolName, {
        kicad_sym_raw: fullSymbolDefinition,
        pins: pins,
        bbox: bbox,
        extends: extendsSymbol,
      });
    }
  }
  return symbolsMap;
}

async function findSymFiles(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent: Dirent) => {
      const res = path.resolve(dir, dirent.name);
      if (dirent.isDirectory()) {
        return findSymFiles(res);
      }
      return res.endsWith(".kicad_sym") ? res : [];
    })
  );
  return Array.prototype.concat(...files);
}

async function main() {
  console.log("🚀 Parsing pin data from your local ./symbols folder...");

  console.log(`Loading your SVG index from: ${SYMBOLS_INDEX_PATH}`);
  const symbolsIndex: Record<string, SymbolIndexEntry[]> = JSON.parse(
    await fs.readFile(SYMBOLS_INDEX_PATH, "utf-8")
  );
  const allEntries = Object.values(symbolsIndex).flat();
  // Create a mapping from base symbol ID (without suffixes) to all entries with that base
  const symbolIdMapping = new Map<string, SymbolIndexEntry[]>();
  allEntries.forEach((entry) => {
    // Extract base ID by removing all possible KiCad symbol suffixes
    const baseId = stripSymbolSuffixes(entry.id);
    if (!symbolIdMapping.has(baseId)) {
      symbolIdMapping.set(baseId, []);
    }
    symbolIdMapping.get(baseId)!.push(entry);
  });

  const requiredSymbolIds = new Set(symbolIdMapping.keys());
  console.log(
    `Identified ${requiredSymbolIds.size} unique base symbols that need pin data.`
  );

  console.log(`Scanning for library files in: ${KICAD_SYMBOLS_PATH}`);
  const symFiles = await findSymFiles(KICAD_SYMBOLS_PATH);
  console.log(`Found ${symFiles.length} library files to search through.`);

  const foundSymbolsData = new Map<string, SymbolData>();
  for (const file of symFiles) {
    if (requiredSymbolIds.size === 0) {
      console.log("All required symbols have been found. Halting search.");
      break;
    }

    const content = await fs.readFile(file, "utf8");
    const symbolsInFile = await parseKicadSymFile(content);

    symbolsInFile.forEach((data, id) => {
      const cleanId = id.includes(":") ? id.split(":")[1] : id;
      const baseId = stripSymbolSuffixes(cleanId);

      // Check for exact match first
      if (requiredSymbolIds.has(cleanId)) {
        foundSymbolsData.set(cleanId, data);
        requiredSymbolIds.delete(cleanId);
        console.log(
          `-> Found exact: ${cleanId} (${requiredSymbolIds.size} remaining)`
        );
      }
      // Check for base symbol match
      else if (requiredSymbolIds.has(baseId)) {
        foundSymbolsData.set(baseId, data);
        requiredSymbolIds.delete(baseId);
        console.log(
          `-> Found base: ${baseId} from ${cleanId} (${requiredSymbolIds.size} remaining)`
        );
      }
    });
  }

  if (requiredSymbolIds.size > 0) {
    console.warn(
      `\n⚠️ Could not find pin data for ${requiredSymbolIds.size} symbols:`,
      [...requiredSymbolIds].slice(0, 10)
    );
  }

  // Handle symbol inheritance: copy pins, bbox, and graphics from base symbols
  console.log("\n🔗 Processing symbol inheritance relationships...");
  let inheritanceCount = 0;
  foundSymbolsData.forEach((symbolData, symbolId) => {
    if (symbolData.extends) {
      const baseSymbol = foundSymbolsData.get(symbolData.extends);
      if (baseSymbol) {
        // Copy pins from base symbol if not already present
        if (!symbolData.pins || symbolData.pins.length === 0) {
          symbolData.pins = [...baseSymbol.pins];
        }

        // Copy bbox from base symbol if not already present
        if (!symbolData.bbox) {
          symbolData.bbox = baseSymbol.bbox
            ? { ...baseSymbol.bbox }
            : undefined;
        }

        inheritanceCount++;
        console.log(`-> ${symbolId} inherits from ${symbolData.extends}`);
      } else {
        console.warn(
          `-> ${symbolId} extends unknown symbol: ${symbolData.extends}`
        );
      }
    }
  });
  console.log(`Processed inheritance for ${inheritanceCount} symbols.`);

  console.log("\nMerging found pin data into the index...");
  let matchCount = 0;
  foundSymbolsData.forEach((symbolData, baseId) => {
    const entries = symbolIdMapping.get(baseId);
    if (entries) {
      entries.forEach((entry) => {
        entry.pins = symbolData.pins;
        entry.kicad_sym_raw = symbolData.kicad_sym_raw;
        entry.bbox = symbolData.bbox;
        entry.extends = symbolData.extends;
        matchCount++;
      });
    }
  });
  console.log(
    `Successfully merged pin data for ${matchCount} of ${allEntries.length} symbols.`
  );

  await fs.writeFile(OUTPUT_JSON_PATH, JSON.stringify(symbolsIndex, null, 2));
  console.log(`\n✅ Success! Enriched data saved to: ${OUTPUT_JSON_PATH}`);
}

main().catch((error) => {
  console.error("An error occurred:", error);
});
