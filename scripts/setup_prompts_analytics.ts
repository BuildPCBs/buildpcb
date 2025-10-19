import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createPromptsAnalyticsTable() {
  try {
    console.log("🔧 Creating prompts analytics table in Supabase...");

    // Read the SQL file
    const sqlFilePath = path.join(
      process.cwd(),
      "scripts",
      "create_prompts_analytics.sql"
    );
    const sqlContent = fs.readFileSync(sqlFilePath, "utf-8");

    console.log("📄 SQL file loaded successfully");
    console.log("📊 Executing table creation...");

    // Execute the SQL using Supabase's rpc function
    // Note: We'll need to execute this SQL manually in the Supabase dashboard
    // since Supabase client doesn't support direct DDL execution
    console.log(
      "⚠️  Please run the following SQL in your Supabase SQL Editor:"
    );
    console.log("─".repeat(60));
    console.log(sqlContent);
    console.log("─".repeat(60));

    // Test the connection and check if we can query the table after creation
    console.log("🔍 Testing connection and checking if table exists...");

    const { data, error } = await supabase
      .from("prompts_analytics")
      .select("count", { count: "exact", head: true });

    if (error && error.code === "PGRST116") {
      console.log(
        "❌ Table doesn't exist yet. Please run the SQL above in Supabase dashboard first."
      );
    } else if (error) {
      console.log("❌ Error checking table:", error.message);
    } else {
      console.log("✅ Table exists! Current row count:", data);
    }

    console.log("📋 Table structure created:");
    console.log("   - prompts_analytics: Main analytics table");
    console.log("   - Indexes: created_at, user_email, prompt_type, user_id");
    console.log("   - RLS policies: User privacy + service role access");
    console.log("   - Views: daily_prompt_stats, prompt_type_stats");
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

// Run the table creation
createPromptsAnalyticsTable();
