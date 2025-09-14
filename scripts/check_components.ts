import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import * as path from "path";

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface SymbolEntry {
  category: string;
  id: string;
  name: string;
  path: string;
  pins?: any[];
  kicad_sym_raw?: string;
  bbox?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  extends?: string;
}

async function analyzeComponents() {
  console.log("🔍 Starting detailed component analysis...\n");

  try {
    // Read the symbols index file
    const symbolsPath = path.join(
      process.cwd(),
      "symbols_index_with_pins.json"
    );
    const symbolsData: Record<string, SymbolEntry[]> = JSON.parse(
      await fs.readFile(symbolsPath, "utf-8")
    );

    // Flatten all symbols from categories
    const allSymbols = Object.values(symbolsData).flat();
    console.log(`📄 JSON File Analysis:`);
    console.log(`   Total symbols in JSON: ${allSymbols.length}`);

    // Group by category
    const symbolsByCategory = allSymbols.reduce((acc, symbol) => {
      acc[symbol.category] = (acc[symbol.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`   By category:`, symbolsByCategory);

    // Count symbols with bbox and extends
    const symbolsWithBbox = allSymbols.filter((s) => s.bbox).length;
    const symbolsWithExtends = allSymbols.filter((s) => s.extends).length;
    const symbolsWithPins = allSymbols.filter(
      (s) => s.pins && s.pins.length > 0
    ).length;

    console.log(`   Symbols with bbox: ${symbolsWithBbox}`);
    console.log(`   Symbols with extends: ${symbolsWithExtends}`);
    console.log(`   Symbols with pins: ${symbolsWithPins}\n`);

    // Fetch all components from database
    console.log(`🗄️  Database Analysis:`);
    const { data: allComponents, error: dbError } = await supabase
      .from("components")
      .select("id, name, category, bbox, extends, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (dbError) {
      console.error("❌ Error fetching components:", dbError.message);
      return;
    }

    console.log(`   Total components in DB: ${allComponents?.length || 0}`);

    if (!allComponents || allComponents.length === 0) {
      console.log("   ⚠️  No components found in database!");
      return;
    }

    // Group components by category
    const componentsByCategory = allComponents.reduce((acc, comp) => {
      acc[comp.category] = (acc[comp.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`   By category:`, componentsByCategory);

    // Count components with bbox and extends
    const componentsWithBbox = allComponents.filter((c) => c.bbox).length;
    const componentsWithExtends = allComponents.filter((c) => c.extends).length;

    console.log(`   Components with bbox: ${componentsWithBbox}`);
    console.log(`   Components with extends: ${componentsWithExtends}\n`);

    // Create lookup maps
    const symbolMap = new Map(allSymbols.map((s) => [s.id, s]));
    const componentMap = new Map(allComponents.map((c) => [c.name, c]));

    // Analysis: Symbols in JSON but not in DB
    const symbolsOnlyInJson = allSymbols.filter((s) => !componentMap.has(s.id));
    console.log(`📊 Migration Analysis:`);
    console.log(
      `   Symbols only in JSON (not migrated): ${symbolsOnlyInJson.length}`
    );

    // Analysis: Components in DB but not in JSON
    const componentsOnlyInDb = allComponents.filter(
      (c) => !symbolMap.has(c.name)
    );
    console.log(
      `   Components only in DB (orphaned?): ${componentsOnlyInDb.length}`
    );

    // Analysis: Components that exist in both
    const componentsInBoth = allComponents.filter((c) => symbolMap.has(c.name));
    console.log(
      `   Components in both JSON and DB: ${componentsInBoth.length}\n`
    );

    // Detailed bbox/extends analysis for components that exist in both
    console.log(`🔄 Update Status Analysis:`);
    let needsBboxUpdate = 0;
    let needsExtendsUpdate = 0;
    let fullyUpToDate = 0;

    for (const component of componentsInBoth) {
      const symbol = symbolMap.get(component.name)!;
      let needsUpdate = false;

      // Check bbox
      if (
        symbol.bbox &&
        JSON.stringify(symbol.bbox) !== JSON.stringify(component.bbox)
      ) {
        needsBboxUpdate++;
        needsUpdate = true;
      }

      // Check extends
      if (symbol.extends && symbol.extends !== component.extends) {
        needsExtendsUpdate++;
        needsUpdate = true;
      }

      if (!needsUpdate) {
        fullyUpToDate++;
      }
    }

    console.log(`   Components needing bbox update: ${needsBboxUpdate}`);
    console.log(`   Components needing extends update: ${needsExtendsUpdate}`);
    console.log(`   Components fully up-to-date: ${fullyUpToDate}\n`);

    // Inheritance analysis
    console.log(`🔗 Inheritance Analysis:`);
    const inheritanceChains = new Map<string, string[]>();

    // Build inheritance chains
    for (const symbol of allSymbols) {
      if (symbol.extends) {
        if (!inheritanceChains.has(symbol.extends)) {
          inheritanceChains.set(symbol.extends, []);
        }
        inheritanceChains.get(symbol.extends)!.push(symbol.id);
      }
    }

    console.log(`   Base symbols with inheritors: ${inheritanceChains.size}`);
    console.log(
      `   Total inheritance relationships: ${
        Array.from(inheritanceChains.values()).flat().length
      }`
    );

    // Show top inheritance relationships
    const sortedInheritance = Array.from(inheritanceChains.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5);

    console.log(`   Top 5 inheritance relationships:`);
    for (const [base, inheritors] of sortedInheritance) {
      console.log(`     ${base} → ${inheritors.length} symbols`);
    }

    // Check for broken inheritance (extends references that don't exist)
    const brokenInheritance = allSymbols.filter(
      (s) => s.extends && !symbolMap.has(s.extends)
    );
    if (brokenInheritance.length > 0) {
      console.log(
        `\n⚠️  Broken inheritance relationships: ${brokenInheritance.length}`
      );
      console.log(
        `   Symbols extending non-existent bases:`,
        brokenInheritance.slice(0, 5).map((s) => `${s.id} → ${s.extends}`)
      );
    }

    console.log(`\n✅ Analysis complete!`);
  } catch (error) {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  }
}

// Run the analysis
analyzeComponents();
