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

async function updateComponentData() {
  console.log(
    "🚀 Starting component data update with bbox and extends fields..."
  );

  try {
    // Read the symbols index file
    const symbolsPath = path.join(
      process.cwd(),
      "symbols_index_with_pins.json"
    );
    const symbolsData: Record<string, SymbolEntry[]> = JSON.parse(
      await fs.readFile(symbolsPath, "utf-8")
    );

    let totalUpdated = 0;
    let totalProcessed = 0;
    let totalSkipped = 0;

    // Process each category
    for (const [category, symbols] of Object.entries(symbolsData)) {
      console.log(
        `\n📁 Processing category: ${category} (${symbols.length} symbols)`
      );

      // Process symbols in batches to avoid overwhelming the database
      const batchSize = 25;
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        console.log(
          `  Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            symbols.length / batchSize
          )}`
        );

        // Process each symbol in the batch
        for (const symbol of batch) {
          try {
            totalProcessed++;

            // Check if component exists in database
            const { data: existingComponent, error: fetchError } =
              await supabase
                .from("components")
                .select("id, name, bbox, extends")
                .eq("name", symbol.id)
                .single();

            if (fetchError && fetchError.code !== "PGRST116") {
              // PGRST116 = not found
              console.error(
                `❌ Error fetching ${symbol.id}:`,
                fetchError.message
              );
              continue;
            }

            if (!existingComponent) {
              totalSkipped++;
              if (totalSkipped % 100 === 0) {
                console.log(
                  `  ⏭️  Skipped ${totalSkipped} components (not found in DB)...`
                );
              }
              continue;
            }

            // Prepare update data
            const updateData: any = {};

            // Add bbox if it exists and is different
            if (
              symbol.bbox &&
              JSON.stringify(symbol.bbox) !==
                JSON.stringify(existingComponent.bbox)
            ) {
              updateData.bbox = symbol.bbox;
            }

            // Add extends if it exists and is different
            if (
              symbol.extends &&
              symbol.extends !== existingComponent.extends
            ) {
              updateData.extends = symbol.extends;
            }

            // Only update if we have new data to add
            if (Object.keys(updateData).length > 0) {
              const { error: updateError } = await supabase
                .from("components")
                .update(updateData)
                .eq("id", existingComponent.id);

              if (updateError) {
                console.error(
                  `❌ Error updating ${symbol.id}:`,
                  updateError.message
                );
              } else {
                totalUpdated++;
                if (totalUpdated % 50 === 0) {
                  console.log(
                    `  ✅ Updated ${totalUpdated} components so far...`
                  );
                }
              }
            } else {
              totalSkipped++;
            }
          } catch (error) {
            console.error(
              `❌ Unexpected error processing ${symbol.id}:`,
              error
            );
          }
        }

        // Small delay between batches to be gentle on the database
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    console.log(`\n✅ Update complete!`);
    console.log(`📊 Total symbols processed: ${totalProcessed}`);
    console.log(`📈 Total components updated: ${totalUpdated}`);
    console.log(`⏭️  Total components skipped: ${totalSkipped}`);
  } catch (error) {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  }
}

// Run the update
updateComponentData();
