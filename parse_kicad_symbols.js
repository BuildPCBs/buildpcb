const fs = require("fs").promises;
const path = require("path");

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
  const symbolRegex = /\(\s*symbol\s+"([^"]+)"([\s\S]*?)\n\s*\)/g;

  let match;
  while ((match = symbolRegex.exec(fileContent)) !== null) {
    const symbolId = match[1];
    const symbolBody = match[2];
    const fullSymbolDefinition = match[0];
    const pins: Pin[] = [];

    const pinRegex =
      /\(\s*pin\s+([^\s]+)\s+([^\s]+)\s*([\s\S]*?)\(\s*number\s+"([^"]+)"[\s\S]*?\)/g;
    let pinMatch;
    while ((pinMatch = pinRegex.exec(symbolBody)) !== null) {
      const electricalType = pinMatch[1];
      const pinBody = pinMatch[3];
      const pinNumber = pinMatch[4];

      const atMatch = pinBody.match(
        /\(\s*at\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\)/
      );
      const nameMatch = pinBody.match(/\(\s*name\s+"([^"]+)"/);

      if (atMatch) {
        pins.push({
          name: nameMatch ? nameMatch[1] : "",
          number: pinNumber,
          electrical_type: electricalType,
          x: parseFloat(atMatch[1]),
          y: parseFloat(atMatch[2]) * -1,
          orientation: parseFloat(atMatch[3]),
        });
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
  const symbolsIndex: Record<string, SymbolIndexEntry> = JSON.parse(
    await fs.readFile(SYMBOLS_INDEX_PATH, "utf-8")
  );
  const requiredSymbolIds = new Set(
    Object.values(symbolsIndex).map((entry) => entry.id)
  );
  console.log(
    `Identified ${requiredSymbolIds.size} symbols that need pin data.`
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
  Object.values(symbolsIndex).forEach((entry) => {
    if (foundSymbolsData.has(entry.id)) {
      const symbolData = foundSymbolsData.get(entry.id)!;
      entry.pins = symbolData.pins;
      entry.kicad_sym_raw = symbolData.kicad_sym_raw;
      matchCount++;
    }
  });
  console.log(
    `Successfully merged pin data for ${matchCount} of ${
      Object.keys(symbolsIndex).length
    } symbols.`
  );

  await fs.writeFile(OUTPUT_JSON_PATH, JSON.stringify(symbolsIndex, null, 2));
  console.log(`\n✅ Success! Enriched data saved to: ${OUTPUT_JSON_PATH}`);
}

main().catch((error) => {
  console.error("An error occurred:", error);
});
