import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
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

interface Pin {
  name: string;
  number: string;
  electrical_type: string;
  x: number;
  y: number;
  orientation: number;
}

interface SymbolIndexEntry {
  id: string;
  name: string;
  category: string;
  relativePath: string;
  pins: Pin[];
  kicad_sym_raw: string;
}

interface ComponentInsert {
  name: string;
  type: string;
  category: string;
  description?: string;
  pin_configuration: Record<string, any>;
  kicad_sym_raw: Record<string, any>;
  kicad_library_source: string;
  is_verified: boolean;
  // Enhanced metadata from KiCad
  datasheet_url?: string | null;
  keywords?: string[];
  footprint_filters?: string[];
  default_footprint?: string | null;
  reference_designator?: string | null;
}

async function migrateSymbolsToSupabase() {
  console.log("🚀 Starting KiCad symbols migration to Supabase...");

  try {
    // Check current database state
    const { count: existingCount, error: countError } = await supabase
      .from('components')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.log('⚠️  Could not check existing components:', countError.message);
    } else {
      console.log(`📊 Current database: ${existingCount || 0} existing components`);
    }

    // Read the enriched symbols data
    console.log("📖 Reading symbols_index_with_pins.json...");
    const jsonPath = path.join(process.cwd(), "symbols_index_with_pins.json");
    const jsonContent = await fs.readFile(jsonPath, "utf-8");
    const symbolsData: Record<string, SymbolIndexEntry[]> = JSON.parse(jsonContent);

    // Flatten all symbols from all categories
    const allSymbols = Object.values(symbolsData).flat();

    console.log(`📊 Found ${allSymbols.length} symbols to migrate`);

    // Filter symbols: include those with pins OR unit variants OR extends variants
    const symbolsWithPins = allSymbols.filter(
      (symbol) => symbol.pins && symbol.pins.length > 0
    );

    // Also include unit variants (e.g., "40106_unit2") that don't have pins but are valid components
    const unitVariants = allSymbols.filter(
      (symbol) => (!symbol.pins || symbol.pins.length === 0) && /_unit\d+$/.test(symbol.name)
    );

    // Also include extends variants (symbols that extend base symbols)
    const extendsVariants = allSymbols.filter(
      (symbol) => (!symbol.pins || symbol.pins.length === 0) &&
                  !/_unit\d+$/.test(symbol.name) &&
                  symbol.kicad_sym_raw &&
                  symbol.kicad_sym_raw.includes("(extends ")
    );

    const allValidSymbols = [...symbolsWithPins, ...unitVariants, ...extendsVariants];

    console.log(`✅ Found ${symbolsWithPins.length} symbols with pin data`);
    console.log(`✅ Found ${unitVariants.length} unit variants`);
    console.log(`✅ Found ${extendsVariants.length} extends variants`);
    console.log(`📦 Total valid symbols to migrate: ${allValidSymbols.length}`);

    // Helper function to get pin configuration for a symbol
    const getPinConfiguration = (symbol: SymbolIndexEntry) => {
      if (symbol.pins && symbol.pins.length > 0) {
        return {
          pins: symbol.pins,
          total_pins: symbol.pins.length,
        };
      }

      // For unit variants, try to extract from base symbol
      const unitMatch = symbol.name.match(/^(.+)_unit(\d+)$/);
      if (unitMatch) {
        const baseName = unitMatch[1];
        const unitNumber = parseInt(unitMatch[2]);

        // Find the base symbol
        const baseSymbol = allSymbols.find(s => s.name === baseName && s.pins && s.pins.length > 0);
        if (baseSymbol && baseSymbol.pins) {
          return {
            pins: baseSymbol.pins,
            total_pins: baseSymbol.pins.length,
            is_unit_variant: true,
            base_symbol: baseName,
            unit_number: unitNumber,
          };
        }
      }

      // For symbols using extends pattern, find the base symbol
      if (symbol.kicad_sym_raw && symbol.kicad_sym_raw.includes("(extends ")) {
        const extendsMatch = symbol.kicad_sym_raw.match(/\(extends "([^"]+)"\)/);
        if (extendsMatch) {
          const baseName = extendsMatch[1];
          // Find the base symbol
          const baseSymbol = allSymbols.find(s => s.name === baseName && s.pins && s.pins.length > 0);
          if (baseSymbol && baseSymbol.pins) {
            return {
              pins: baseSymbol.pins,
              total_pins: baseSymbol.pins.length,
              is_extends_variant: true,
              base_symbol: baseName,
            };
          }
        }
      }

      return {
        pins: [],
        total_pins: 0,
      };
    };

    // Helper function to extract metadata from kicad_sym_raw
    const extractMetadata = (kicadSymRaw: string) => {
      const metadata: any = {
        datasheet_url: null,
        description: null,
        keywords: [],
        footprint_filters: [],
        default_footprint: null,
        reference_designator: null,
      };

      if (!kicadSymRaw) return metadata;

      // Extract properties using regex
      const propertyMatches = kicadSymRaw.matchAll(/\(property "([^"]+)" "([^"]*)"/g);
      for (const match of propertyMatches) {
        const propName = match[1];
        const propValue = match[2];

        switch (propName) {
          case 'Datasheet':
            metadata.datasheet_url = propValue;
            break;
          case 'Description':
            metadata.description = propValue;
            break;
          case 'ki_keywords':
            metadata.keywords = propValue.split(/\s+/).filter(k => k.length > 0);
            break;
          case 'ki_fp_filters':
            metadata.footprint_filters = propValue.split(/\s+/).filter(f => f.length > 0);
            break;
          case 'Footprint':
            metadata.default_footprint = propValue || null;
            break;
          case 'Reference':
            metadata.reference_designator = propValue;
            break;
        }
      }

      return metadata;
    };

    // Transform data to match components table schema
    const componentsToInsert: ComponentInsert[] = allValidSymbols.map(
      (symbol) => {
        const pinConfig = getPinConfiguration(symbol);
        const metadata = extractMetadata(symbol.kicad_sym_raw);

        return {
          name: symbol.name,
          type: "electronic_component", // Default type
          category: symbol.category,
          description: metadata.description || `KiCad symbol: ${symbol.name}`,
          pin_configuration: pinConfig,
          kicad_sym_raw: {
            definition: symbol.kicad_sym_raw,
            symbol_id: symbol.id,
          },
          kicad_library_source: "KiCad Official Library",
          is_verified: true, // Mark as verified since it's from official KiCad library
          // Enhanced metadata
          datasheet_url: metadata.datasheet_url,
          keywords: metadata.keywords,
          footprint_filters: metadata.footprint_filters,
          default_footprint: metadata.default_footprint,
          reference_designator: metadata.reference_designator,
        };
      }
    );

    // Insert in batches to avoid timeouts
    const BATCH_SIZE = 100;
    let successCount = 0;
    let errorCount = 0;

    console.log(
      `📤 Inserting ${componentsToInsert.length} components in batches of ${BATCH_SIZE}...`
    );

    for (let i = 0; i < componentsToInsert.length; i += BATCH_SIZE) {
      const batch = componentsToInsert.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(componentsToInsert.length / BATCH_SIZE);

      console.log(
        `🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} components)...`
      );

      try {
        // Check which components already exist
        const componentNames = batch.map(comp => comp.name);
        const { data: existingComponents, error: checkError } = await supabase
          .from('components')
          .select('name')
          .in('name', componentNames);

        if (checkError) {
          console.error(`❌ Batch ${batchNumber} check failed:`, checkError);
          errorCount += batch.length;
          continue;
        }

        const existingNames = new Set(existingComponents?.map(c => c.name) || []);

        // Separate into new components (to insert) and existing (to update)
        const newComponents = batch.filter(comp => !existingNames.has(comp.name));
        const existingComponentsData = batch.filter(comp => existingNames.has(comp.name));

        let batchSuccessCount = 0;

        // Insert new components
        if (newComponents.length > 0) {
          const { data: insertData, error: insertError } = await supabase
            .from("components")
            .insert(newComponents)
            .select("id, name");

          if (insertError) {
            console.error(`❌ Batch ${batchNumber} insert failed:`, insertError);
          } else {
            batchSuccessCount += insertData?.length || 0;
          }
        }

        // Update existing components
        if (existingComponentsData.length > 0) {
          for (const component of existingComponentsData) {
            const { error: updateError } = await supabase
              .from('components')
              .update({
                description: component.description,
                pin_configuration: component.pin_configuration,
                kicad_sym_raw: component.kicad_sym_raw,
                kicad_library_source: component.kicad_library_source,
                datasheet_url: component.datasheet_url,
                keywords: component.keywords,
                footprint_filters: component.footprint_filters,
                default_footprint: component.default_footprint,
                reference_designator: component.reference_designator,
                updated_at: new Date().toISOString()
              })
              .eq('name', component.name);

            if (updateError) {
              console.error(`❌ Batch ${batchNumber} update failed for ${component.name}:`, updateError);
            } else {
              batchSuccessCount += 1;
            }
          }
        }

        if (batchSuccessCount > 0) {
          console.log(
            `✅ Batch ${batchNumber} successful: processed ${batchSuccessCount} components (${newComponents.length} new, ${existingComponentsData.length} updated)`
          );
          successCount += batchSuccessCount;
        } else {
          console.error(`❌ Batch ${batchNumber} failed: no components processed`);
          errorCount += batch.length;
        }
      } catch (batchError) {
        console.error(`💥 Batch ${batchNumber} error:`, batchError);
        errorCount += batch.length;
      }

      // Small delay between batches to avoid overwhelming the database
      if (i + BATCH_SIZE < componentsToInsert.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log("\n🎉 Migration completed!");
    console.log(`✅ Successfully processed: ${successCount} components`);
    console.log(`❌ Failed to process: ${errorCount} components`);
    console.log(`📊 Total processed: ${successCount + errorCount} components`);

    if (errorCount > 0) {
      console.log(
        "\n⚠️  Some components failed to insert. Check the errors above."
      );
    }
  } catch (error) {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  }
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateSymbolsToSupabase()
    .then(() => {
      console.log("🏁 Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Migration script failed:", error);
      process.exit(1);
    });
}

export { migrateSymbolsToSupabase };
