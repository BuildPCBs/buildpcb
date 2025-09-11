import type { Dirent } from "fs";

import { promises as fs } from "fs";
import * as path from "path";

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
}

interface SymbolIndexEntry {
  category: string;
  id: string;
  name: string;
  path: string;
  pins?: Pin[];
  kicad_sym_raw?: string;
}

// --- Configuration ---
// This now points to YOUR local folder with the curated .kicad_sym files
const KICAD_SYMBOLS_PATH = "./symbols";
const SYMBOLS_INDEX_PATH = "./symbols_index.json";
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
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      
      if (parenCount === 0) {
        symbolEnd = pos + 1;
        break;
      }
      pos++;
    }
    
    if (symbolEnd === -1) continue; // Malformed symbol
    
    const fullSymbolDefinition = fileContent.substring(symbolStart, symbolEnd);
    const symbolBody = fullSymbolDefinition.substring(startMatch[0].length, fullSymbolDefinition.length - 1);
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
      const subSymbolRegex = /\(\s*symbol\s+"[^"]+_\d+_\d+"\s*([\s\S]*?)\n\s*\)/g;
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

    symbolsMap.set(symbolId, {
      kicad_sym_raw: fullSymbolDefinition,
      pins: pins,
    });
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
  const requiredSymbolIds = new Set(allEntries.map((entry) => entry.id));
  console.log(`Identified ${requiredSymbolIds.size} symbols that need pin data.`);

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
      if (requiredSymbolIds.has(cleanId)) {
        foundSymbolsData.set(cleanId, data);
        requiredSymbolIds.delete(cleanId);
        console.log(
          `-> Found: ${cleanId} (${requiredSymbolIds.size} remaining)`
        );
      }
    });
  }

  if (requiredSymbolIds.size > 0) {
    console.warn(
      `\n⚠️ Could not find pin data for ${requiredSymbolIds.size} symbols:`,
      [...requiredSymbolIds]
    );
  }

  console.log("\nMerging found pin data into the index...");
  let matchCount = 0;
  allEntries.forEach((entry) => {
    if (foundSymbolsData.has(entry.id)) {
      const symbolData = foundSymbolsData.get(entry.id)!;
      entry.pins = symbolData.pins;
      entry.kicad_sym_raw = symbolData.kicad_sym_raw;
      matchCount++;
    }
  });
  console.log(
    `Successfully merged pin data for ${matchCount} of ${
      allEntries.length
    } symbols.`
  );

  await fs.writeFile(OUTPUT_JSON_PATH, JSON.stringify(symbolsIndex, null, 2));
  console.log(`\n✅ Success! Enriched data saved to: ${OUTPUT_JSON_PATH}`);
}

main().catch((error) => {
  console.error("An error occurred:", error);
});
