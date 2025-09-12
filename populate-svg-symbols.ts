import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface ComponentMapping {
  filename: string;
  componentName: string;
  category: string;
  svgPath: string;
}

/**
 * Parse filename to extract component information
 * Examples:
 * - 4001_unit1.svg → { name: "4001", category: "Logic_IC" }
 * - 74HC00_unit1.svg → { name: "74HC00", category: "74xx" }
 * - LED_RED_unit1.svg → { name: "LED_RED", category: "LED" }
 */
function parseComponentInfo(filename: string, folderPath: string): ComponentMapping | null {
  const nameWithoutExt = filename.replace('.svg', '');
  const parts = nameWithoutExt.split('_');

  if (parts.length < 2) return null;

  // Extract component name (everything before first underscore)
  const componentName = parts[0];

  // Determine category from folder name
  const categoryMap: Record<string, string> = {
    '4xxx': 'Logic_IC',
    '74xx': '74xx',
    'Connector': 'Connector',
    'Device': 'Device',
    'Diode': 'Diode',
    'LED': 'LED',
    'MCU_ATmega': 'MCU',
    'MCU_STM32F1': 'MCU',
    'Memory_EEPROM': 'Memory',
    'OpAmp': 'OpAmp',
    'Oscillator': 'Oscillator',
    'Power': 'Power',
    'Regulator_Linear': 'Regulator',
    'Regulator_Switching': 'Regulator',
    'Relay': 'Relay',
    'Sensor_Motion': 'Sensor',
    'Sensor_Optical': 'Sensor',
    'Sensor_Temperature': 'Sensor',
    'Switch': 'Switch',
    'Timer': 'Timer',
    'Transistor_BJT': 'Transistor',
    'Transistor_FET': 'Transistor'
  };

  const folderName = path.basename(folderPath);
  const category = categoryMap[folderName] || folderName;

  return {
    filename,
    componentName,
    category,
    svgPath: path.join(folderPath, filename)
  };
}

/**
 * Read SVG content from file
 */
function readSvgContent(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`❌ Error reading ${filePath}:`, error);
    return null;
  }
}

/**
 * Find component in database by name
 */
async function findComponentByName(componentName: string) {
  const { data, error } = await supabase
    .from('components')
    .select('id, name, category, symbol_svg')
    .or(`name.ilike.%${componentName}%,part_number.ilike.%${componentName}%`)
    .limit(5);

  if (error) {
    console.error(`❌ Database error for ${componentName}:`, error);
    return null;
  }

  return data;
}

/**
 * Update component with SVG content
 */
async function updateComponentSvg(componentId: string, svgContent: string, componentName: string) {
  const { error } = await supabase
    .from('components')
    .update({
      symbol_svg: svgContent,
      updated_at: new Date().toISOString()
    })
    .eq('id', componentId);

  if (error) {
    console.error(`❌ Error updating ${componentName}:`, error);
    return false;
  }

  console.log(`✅ Updated ${componentName} with SVG (${svgContent.length} chars)`);
  return true;
}

/**
 * Process all SVG files in a directory recursively
 */
async function processDirectory(dirPath: string): Promise<void> {
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Recursively process subdirectories
      await processDirectory(fullPath);
    } else if (item.endsWith('.svg')) {
      // Process SVG file
      const componentInfo = parseComponentInfo(item, dirPath);

      if (!componentInfo) {
        console.log(`⚠️ Skipping ${item} - couldn't parse filename`);
        continue;
      }

      console.log(`🔍 Processing: ${componentInfo.componentName} (${componentInfo.category})`);

      // Read SVG content
      const svgContent = readSvgContent(componentInfo.svgPath);
      if (!svgContent) continue;

      // Find matching component in database
      const matchingComponents = await findComponentByName(componentInfo.componentName);

      if (!matchingComponents || matchingComponents.length === 0) {
        console.log(`⚠️ No matching component found for ${componentInfo.componentName}`);
        continue;
      }

      // Update the first matching component
      const component = matchingComponents[0];
      await updateComponentSvg(component.id, svgContent, componentInfo.componentName);

      // If multiple matches, log them for manual review
      if (matchingComponents.length > 1) {
        console.log(`ℹ️ Multiple matches for ${componentInfo.componentName}:`);
        matchingComponents.slice(1).forEach(comp => {
          console.log(`  - ${comp.name} (${comp.id})`);
        });
      }
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  const symbolsDir = path.join(process.cwd(), 'starter_symbols');

  if (!fs.existsSync(symbolsDir)) {
    console.error(`❌ Symbols directory not found: ${symbolsDir}`);
    process.exit(1);
  }

  console.log('🚀 Starting SVG import process...');
  console.log(`📁 Processing directory: ${symbolsDir}`);

  try {
    await processDirectory(symbolsDir);
    console.log('✅ SVG import process completed!');
  } catch (error) {
    console.error('❌ Error during import process:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);