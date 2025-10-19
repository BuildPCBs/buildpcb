import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { createClient } from "@supabase/supabase-js";

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

async function getPromptAnalytics() {
  try {
    console.log("📊 Fetching prompt analytics from Supabase...");

    // Get total prompt count
    const { count: totalPrompts, error: countError } = await supabase
      .from("prompts_analytics")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error("❌ Error fetching total count:", countError);
      return;
    }

    console.log(`📈 Total Prompts: ${totalPrompts || 0}`);

    // Get daily stats
    const { data: dailyStats, error: dailyError } = await supabase
      .from("daily_prompt_stats")
      .select("*")
      .limit(7); // Last 7 days

    if (dailyError) {
      console.error("❌ Error fetching daily stats:", dailyError);
    } else {
      console.log("\n📅 Daily Prompt Stats (Last 7 days):");
      console.log("─".repeat(50));
      dailyStats?.forEach((stat) => {
        console.log(
          `${stat.date}: ${stat.total_prompts} prompts, ${stat.unique_users} users`
        );
      });
    }

    // Get prompt type distribution
    const { data: typeStats, error: typeError } = await supabase
      .from("prompt_type_stats")
      .select("*");

    if (typeError) {
      console.error("❌ Error fetching type stats:", typeError);
    } else {
      console.log("\n🏷️  Prompt Types:");
      console.log("─".repeat(30));
      typeStats?.forEach((stat) => {
        console.log(
          `${stat.prompt_type}: ${stat.count} prompts (${stat.unique_users} users)`
        );
      });
    }

    // Get top users by prompt count
    const { data: topUsers, error: usersError } = await supabase
      .from("prompts_analytics")
      .select("user_email")
      .not("user_email", "is", null);

    if (usersError) {
      console.error("❌ Error fetching user stats:", usersError);
    } else {
      // Count prompts per user
      const userCounts: { [email: string]: number } = {};
      topUsers?.forEach((row) => {
        if (row.user_email) {
          userCounts[row.user_email] = (userCounts[row.user_email] || 0) + 1;
        }
      });

      const sortedUsers = Object.entries(userCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      console.log("\n👥 Top Users by Prompt Count:");
      console.log("─".repeat(35));
      sortedUsers.forEach(([email, count], index) => {
        console.log(`${index + 1}. ${email}: ${count} prompts`);
      });
    }
  } catch (error) {
    console.error("❌ Unexpected error:", error);
  }
}

// Run the analytics
getPromptAnalytics();
